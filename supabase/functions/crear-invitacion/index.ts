// Edge Function: crear-invitacion
//
// Emite una propuesta de encuentro. Dos direcciones:
//   * `invitacion`: rentador → amigo, lleva una bebida del catálogo — crea su
//     orden y la preautoriza de una (spec §4).
//   * `solicitud`:  amigo → rentador, sin bebida (la pone el rentador al
//     aceptar, fase 4.3) — no hay dinero todavía, no hay nada que preautorizar.
//
// Orden obligatorio, no negociable (spec §4, plan E.2b):
//   1. RPC crear_invitacion              → invitación + orden (si es `invitacion`)
//   2. Si es `solicitud`: devolver y parar — no hay dinero todavía
//   3. Leer la orden de esa invitación
//   4. Si NO debePreautorizar(orden.estado): devolver sin llamar al proveedor
//      — es la guarda contra el doble hold: un reintento con la misma
//      idempotency_key recibe de crear_invitacion la invitación YA creada,
//      con su orden YA preautorizada.
//   5. Llamar al proveedor (mock)         → providerRef
//   6. RPC confirmar_preautorizacion(orden, ok, providerRef) — proveedor
//      PRIMERO, base DESPUÉS: al revés, un fallo del proveedor dejaría la
//      base afirmando un hold que nunca existió (dinero fantasma).
//   7. Devolver
//
// Toda la lógica atómica (gate KYC del emisor, validación de bebida,
// creación de la fila e idempotencia) vive en crear_invitacion (pgTAP). La
// validación de FORMA del body vive en ../_shared/invitaciones.ts (Jest). La
// decisión de qué RPC llamar y si hay que preautorizar vive en
// ../_shared/pagos.ts (Jest) — este archivo es cáscara: no tiene cobertura
// de ningún tipo, así que no lleva lógica de negocio propia.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validarCrearInvitacion } from '../_shared/invitaciones.ts';
import { corsHeaders, preflightResponse } from '../_shared/cors.ts';
import { debePreautorizar, mockPreautorizar } from '../_shared/pagos.ts';

// SQLSTATE personalizados que emite crear_invitacion → status HTTP.
const ERRCODE_STATUS: Record<string, number> = {
  AY400: 400, // forma inválida (defensa en profundidad)
  AY403: 403, // emisor no verificado (KYC)
  AY409: 409, // conflicto de bebida (no existe / inactiva)
};

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

  const validacion = validarCrearInvitacion(await req.json(), user.id);
  if (!validacion.ok) {
    return Response.json({ error: validacion.error }, { status: 400, headers: cors });
  }
  const body = validacion.body;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Gate temprano (optimización): evita la RPC si el emisor no está verificado.
  // La fuente de verdad del chequeo vive DENTRO de crear_invitacion (atómica y
  // testeable con pgTAP); esto solo ahorra una llamada en el caso obvio.
  const { data: perfil } = await admin
    .from('profiles')
    .select('kyc_estado')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil || perfil.kyc_estado !== 'verificado') {
    return Response.json(
      { error: 'Debes verificar tu identidad (KYC) antes de invitar.' },
      { status: 403, headers: cors },
    );
  }

  // --- 1. RPC crear_invitacion ---
  const { data: invitacion, error } = await admin.rpc('crear_invitacion', {
    p_emisor_id: user.id,
    p_receptor_id: body.receptorId,
    p_tipo: body.tipo,
    p_bebida_catalogo_id: body.bebidaCatalogoId,
    p_tiempo_estimado_min: body.tiempoEstimadoMin,
    p_zona_aproximada: body.zonaAproximada,
    p_idempotency_key: body.idempotencyKey,
  });

  if (error) {
    const status = ERRCODE_STATUS[error.code ?? ''] ?? 500;
    const mensaje = status === 500 ? 'No se pudo crear la invitación.' : error.message;
    return Response.json({ error: mensaje }, { status, headers: cors });
  }

  // --- 2. Una `solicitud` no crea orden: no hay dinero todavía ---
  if (body.tipo === 'solicitud') {
    return Response.json({ invitacion }, { headers: cors });
  }

  // --- 3. Leer la orden de esa invitación ---
  const { data: orden, error: ordenError } = await admin
    .from('ordenes_pago')
    .select('id, estado')
    .eq('invitacion_id', invitacion.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ordenError || !orden) {
    return Response.json(
      { error: 'La invitación se creó pero no se encontró su orden.' },
      { status: 500, headers: cors },
    );
  }

  // --- 4. Guarda contra el doble hold ---
  if (!debePreautorizar(orden.estado)) {
    return Response.json({ invitacion }, { headers: cors });
  }

  // --- 5. Proveedor PRIMERO ---
  const hold = mockPreautorizar(orden.id);

  // --- 6. Base DESPUÉS, con el providerRef real (nunca null si el proveedor
  // devolvió uno) ---
  const { error: confirmarError } = await admin.rpc('confirmar_preautorizacion', {
    p_orden_id: orden.id,
    p_ok: hold.ok,
    p_provider_ref: hold.ok ? hold.providerRef : null,
  });

  if (confirmarError) {
    return Response.json(
      { error: 'No se pudo registrar el resultado de la preautorización.' },
      { status: 500, headers: cors },
    );
  }

  // confirmar_preautorizacion acaba de mover la invitación (a `pendiente` si
  // el hold salió bien, a `expirada` si no) — el objeto `invitacion` de arriba
  // quedó desactualizado, sigue diciendo `preautorizando`. Se relee para no
  // devolverle al cliente un estado que la base ya dejó atrás.
  const { data: invitacionFinal } = await admin
    .from('invitaciones')
    .select('*')
    .eq('id', invitacion.id)
    .maybeSingle();

  if (!hold.ok) {
    return Response.json(
      { invitacion: invitacionFinal ?? invitacion, error: hold.motivo },
      { status: 402, headers: cors },
    );
  }

  // --- 7. Devolver ---
  return Response.json({ invitacion: invitacionFinal ?? invitacion }, { headers: cors });
});
