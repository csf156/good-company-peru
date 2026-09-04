// Edge Function: kyc-start
//
// Recibe las rutas (ya subidas por el cliente al bucket privado `dni`) del
// DNI y la selfie, y arranca la verificación de identidad.
//
// Modo DEMO (default, sin configurar nada): aprueba de inmediato, sin tocar
// Truora. Modo TRUORA real: activarlo es solo configurar los secrets
// `KYC_PROVIDER=truora` y `TRUORA_API_KEY` en el proyecto Supabase — este
// archivo no cambia. Toda la lógica de decisión/parseo vive en
// ../_shared/kyc.ts, donde está cubierta por tests (Jest no puede correr
// este archivo directamente: usa Deno.serve y el runtime de Supabase).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildTruoraStartRequest,
  decideKycProvider,
  decideStartAction,
  isSelfOwnedStoragePath,
  runDemoVerification,
} from '../_shared/kyc.ts';
import { corsHeaders, preflightResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Antes de cualquier otra cosa: el navegador manda el preflight OPTIONS
  // sin Authorization, así que tiene que responderse antes del chequeo de
  // método/sesión — si no, un OPTIONS cae en el 405 de abajo sin cabeceras
  // CORS y el navegador nunca llega a mandar la petición real.
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  const cors = corsHeaders(req.headers.get('Origin'));

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await callerClient.auth.getUser();

  if (!user) {
    return Response.json({ error: 'No hay sesión activa.' }, { status: 401, headers: cors });
  }

  const { dniPath, selfiePath } = await req.json();
  if (typeof dniPath !== 'string' || typeof selfiePath !== 'string') {
    return Response.json(
      { error: 'dniPath y selfiePath son requeridos.' },
      { status: 400, headers: cors },
    );
  }
  // Defensa en profundidad: aunque la policy del bucket `dni` ya restringe
  // por owner, kyc-start firma URLs con service_role (bypassa esa RLS), así
  // que exigimos que ambas rutas sean exactamente `<uid>/<archivo>` — sin
  // subcarpetas ni traversal que apunten al DNI de otro usuario.
  if (
    !isSelfOwnedStoragePath(dniPath, user.id) ||
    !isSelfOwnedStoragePath(selfiePath, user.id)
  ) {
    return Response.json({ error: 'Rutas inválidas.' }, { status: 403, headers: cors });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Idempotencia: no reprocesar un usuario ya verificado, y — el caso que
  // importa en modo Truora real — no reenviar una verificación que ya está
  // en curso (evita duplicar el envío/cobro al proveedor). Un `rechazado`
  // sí puede reintentar.
  const { data: last } = await admin
    .from('kyc_verificaciones')
    .select('estado')
    .eq('perfil_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const action = decideStartAction(last?.estado ?? null);
  if (action === 'skip-verified') {
    return Response.json({ estado: 'verificado' }, { headers: cors });
  }
  if (action === 'skip-pending') {
    return Response.json({ estado: 'pendiente' }, { headers: cors });
  }

  const provider = decideKycProvider(Deno.env.toObject());

  if (provider === 'demo') {
    const result = runDemoVerification();
    await admin.from('kyc_verificaciones').insert({
      perfil_id: user.id,
      proveedor: 'demo',
      estado: result.estado,
      dni_path: dniPath,
      selfie_path: selfiePath,
    });
    await admin
      .from('profiles')
      .update({ kyc_estado: result.estado, verificado_at: result.verificadoAt })
      .eq('id', user.id);

    return Response.json({ estado: result.estado }, { headers: cors });
  }

  // Modo Truora real: el bucket `dni` es privado, Truora necesita URLs que
  // pueda descargar → signed URLs de corta duración.
  const [dniSigned, selfieSigned] = await Promise.all([
    admin.storage.from('dni').createSignedUrl(dniPath, 300),
    admin.storage.from('dni').createSignedUrl(selfiePath, 300),
  ]);
  if (dniSigned.error || selfieSigned.error) {
    return Response.json(
      { error: 'No se pudieron preparar las imágenes.' },
      { status: 500, headers: cors },
    );
  }

  const truoraRequest = buildTruoraStartRequest({
    apiKey: Deno.env.get('TRUORA_API_KEY')!,
    dniUrl: dniSigned.data.signedUrl,
    selfieUrl: selfieSigned.data.signedUrl,
    externalId: user.id,
  });

  const truoraResponse = await fetch(truoraRequest.url, {
    method: truoraRequest.method,
    headers: truoraRequest.headers,
    body: truoraRequest.body,
  });

  if (!truoraResponse.ok) {
    return Response.json(
      { error: 'No se pudo iniciar la verificación.' },
      { status: 502, headers: cors },
    );
  }

  const { validation_id: externalId } = await truoraResponse.json();

  await admin.from('kyc_verificaciones').insert({
    perfil_id: user.id,
    proveedor: 'truora',
    external_id: externalId,
    estado: 'pendiente',
    dni_path: dniPath,
    selfie_path: selfiePath,
  });

  return Response.json({ estado: 'pendiente' }, { headers: cors });
});
