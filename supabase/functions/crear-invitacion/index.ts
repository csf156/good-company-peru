// Edge Function: crear-invitacion
//
// Emite una propuesta de encuentro y, si es invitación de rentador, bloquea su
// bebida del bar (disponible→bloqueada; los fondos ya están en escrow desde la
// compra 3.1). Dos direcciones:
//   * `invitacion`: rentador → amigo, lleva una bebida de su bar.
//   * `solicitud`:  amigo → rentador, sin bebida (la pone el rentador al aceptar,
//     fase 4.3, fuera de alcance de esta función).
//
// Toda la lógica atómica (gate KYC del emisor, validación+bloqueo de la bebida,
// creación de la fila e idempotencia) vive en la función SQL crear_invitacion
// (pgTAP). La validación de FORMA del body vive en ../_shared/invitaciones.ts
// (Jest). El cliente nunca calcula ni mueve estado de escrow.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validarCrearInvitacion } from '../_shared/invitaciones.ts';

// SQLSTATE personalizados que emite crear_invitacion → status HTTP.
const ERRCODE_STATUS: Record<string, number> = {
  AY400: 400, // forma inválida (defensa en profundidad)
  AY403: 403, // emisor no verificado (KYC)
  AY409: 409, // conflicto de bebida (no existe / no es tuya / no disponible)
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
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
    return Response.json({ error: 'No hay sesión activa.' }, { status: 401 });
  }

  const validacion = validarCrearInvitacion(await req.json(), user.id);
  if (!validacion.ok) {
    return Response.json({ error: validacion.error }, { status: 400 });
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
      { status: 403 },
    );
  }

  const { data: invitacion, error } = await admin.rpc('crear_invitacion', {
    p_emisor_id: user.id,
    p_receptor_id: body.receptorId,
    p_tipo: body.tipo,
    p_bebida_bar_id: body.bebidaBarId,
    p_tiempo_estimado_min: body.tiempoEstimadoMin,
    p_zona_aproximada: body.zonaAproximada,
    p_idempotency_key: body.idempotencyKey,
  });

  if (error) {
    const status = ERRCODE_STATUS[error.code ?? ''] ?? 500;
    const mensaje = status === 500 ? 'No se pudo crear la invitación.' : error.message;
    return Response.json({ error: mensaje }, { status });
  }

  return Response.json({ invitacion });
});
