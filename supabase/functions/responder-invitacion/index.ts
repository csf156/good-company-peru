// Edge Function: responder-invitacion
//
// El RECEPTOR de una invitación pendiente la acepta o la rechaza (Fase 4.3):
//   * rechazar: la invitación pasa a `rechazada` y, si era una `invitacion` de
//     rentador (bebida ya bloqueada en 4.2), su bebida se libera a `disponible`.
//   * aceptar: la invitación pasa a `aceptada` y nace la `cita` (vacía, estado
//     default `pendiente`) — su sola existencia habilita el chat a las dos partes
//     vía RLS. Si es una `solicitud` de amigo, el receptor-rentador asigna una
//     bebida disponible de su bar, que se bloquea.
//
// Toda la lógica atómica (solo-receptor, gate KYC, liberar/bloquear la bebida,
// crear la cita, idempotencia benigna) vive en la función SQL responder_invitacion
// (pgTAP). La validación de FORMA del body vive en ../_shared/invitaciones.ts
// (Jest). El cliente nunca calcula ni mueve estado de escrow. El receptor se toma
// de la sesión (no del body) para evitar suplantación.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validarResponderInvitacion } from '../_shared/invitaciones.ts';

// SQLSTATE personalizados que emite responder_invitacion → status HTTP.
const ERRCODE_STATUS: Record<string, number> = {
  AY400: 400, // forma inválida (defensa en profundidad)
  AY403: 403, // no eres el receptor / receptor no verificado (KYC)
  AY404: 404, // invitación inexistente
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

  const validacion = validarResponderInvitacion(await req.json());
  if (!validacion.ok) {
    return Response.json({ error: validacion.error }, { status: 400 });
  }
  const body = validacion.body;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Sin gate KYC temprano acá (a diferencia de crear-invitacion): la función SQL
  // es la fuente de verdad y ordena el chequeo de "ya resuelta" ANTES del de KYC,
  // para que un reintento sobre una invitación ya cerrada sea siempre benigno.
  // Duplicar el gate en el Edge Function rompería ese orden en ese caso borde.
  const { data: resultado, error } = await admin.rpc('responder_invitacion', {
    p_receptor_id: user.id,
    p_invitacion_id: body.invitacionId,
    p_accion: body.accion,
    p_bebida_bar_id: body.bebidaBarId,
  });

  if (error) {
    const status = ERRCODE_STATUS[error.code ?? ''] ?? 500;
    const mensaje = status === 500 ? 'No se pudo responder la invitación.' : error.message;
    return Response.json({ error: mensaje }, { status });
  }

  return Response.json({ resultado });
});
