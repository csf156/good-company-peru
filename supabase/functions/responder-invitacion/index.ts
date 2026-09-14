// Edge Function: responder-invitacion
//
// El RECEPTOR de una invitación pendiente la acepta o la rechaza (spec §4):
//   * rechazar: la invitación pasa a `rechazada`. Si tenía un hold vivo
//     (invitación de rentador), se anula — sin ledger, no compromete escrow.
//   * aceptar una `invitacion`: el hold YA existe (lo dejó preautorizado
//     confirmar_preautorizacion, E.2a Tarea 3b) — la RPC lo captura de una,
//     abre la cita y devuelve `'aceptada'`. No hay nada que hacer acá.
//   * aceptar una `solicitud`: NO hay hold todavía (Tarea 3c: una solicitud
//     nace sin orden). La RPC solo PREPARA — crea la orden en `pendiente` y
//     deja la invitación en `preautorizando` — y devuelve `'preautorizando'`.
//     **Solo este caso** exige llamar al proveedor, mismo orden que
//     crear-invitacion: leer la orden, guarda `debePreautorizar` (doble
//     hold), proveedor PRIMERO, `confirmar_preautorizacion` con el
//     providerRef real DESPUÉS.
//
// `'ya_resuelta'` no es error y no dispara nada: es el reintento benigno de
// una invitación que ya se cerró. Tratarlo como fallo le devolvería un error
// al rentador sobre un doble clic que en realidad funcionó la primera vez.
//
// Toda la lógica atómica (solo-receptor, gate KYC solo al aceptar,
// captura/anulación del hold, creación de la cita, idempotencia benigna)
// vive en la función SQL responder_invitacion (pgTAP). La validación de
// FORMA del body vive en ../_shared/invitaciones.ts (Jest). Este archivo es
// cáscara: no tiene cobertura de ningún tipo, así que no lleva lógica de
// negocio propia — decidir si hay que preautorizar y qué RPC llamar vive en
// ../_shared/pagos.ts (Jest), igual que en crear-invitacion.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validarResponderInvitacion } from '../_shared/invitaciones.ts';
import { corsHeaders, preflightResponse } from '../_shared/cors.ts';
import { debePreautorizar, mockPreautorizar } from '../_shared/pagos.ts';

// SQLSTATE personalizados que emite responder_invitacion → status HTTP.
const ERRCODE_STATUS: Record<string, number> = {
  AY400: 400, // forma inválida (defensa en profundidad)
  AY403: 403, // no eres el receptor / receptor no verificado (KYC) / no verificado
  AY404: 404, // invitación inexistente
  AY409: 409, // conflicto de bebida (no existe / inactiva) / sin hold preautorizado / ya cobrada
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

  const validacion = validarResponderInvitacion(await req.json());
  if (!validacion.ok) {
    return Response.json({ error: validacion.error }, { status: 400, headers: cors });
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
    p_bebida_catalogo_id: body.bebidaCatalogoId,
  });

  if (error) {
    const status = ERRCODE_STATUS[error.code ?? ''] ?? 500;
    const mensaje = status === 500 ? 'No se pudo responder la invitación.' : error.message;
    return Response.json({ error: mensaje }, { status, headers: cors });
  }

  // Solo el camino `solicitud` aceptada llega acá con algo que preautorizar.
  // 'aceptada' / 'rechazada' / 'ya_resuelta' ya terminaron dentro de la RPC.
  if (resultado !== 'preautorizando') {
    return Response.json({ resultado }, { headers: cors });
  }

  const { data: orden, error: ordenError } = await admin
    .from('ordenes_pago')
    .select('id, estado')
    .eq('invitacion_id', body.invitacionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ordenError || !orden) {
    return Response.json(
      { error: 'La solicitud se aceptó pero no se encontró su orden.' },
      { status: 500, headers: cors },
    );
  }

  // Guarda contra el doble hold — mismo criterio que crear-invitacion.
  if (!debePreautorizar(orden.estado)) {
    return Response.json({ resultado }, { headers: cors });
  }

  // Proveedor PRIMERO, base DESPUÉS con el providerRef real.
  const hold = mockPreautorizar(orden.id);
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

  if (!hold.ok) {
    return Response.json({ resultado: 'pendiente', error: hold.motivo }, { status: 402, headers: cors });
  }

  return Response.json({ resultado: 'aceptada' }, { headers: cors });
});
