// Edge Function: confirmar-cita
//
// El AMIGO de una cita pendiente captura zona/hora/mensaje y la confirma (Fase
// 4.5). "El amigo" se determina dinámicamente (join invitaciones + profiles.rol
// — NO es fijo a emisor ni a receptor: una `invitacion` de rentador tiene al
// amigo como receptor, una `solicitud` de amigo lo tiene como emisor). Esta
// fase no mueve bebidas ni escrow — solo transiciona `citas.estado`
// 'pendiente' → 'confirmada' guardando sus detalles.
//
// Toda la lógica atómica (quién es el amigo, idempotencia benigna, estados
// confirmables) vive en la función SQL confirmar_cita (pgTAP). La validación
// de FORMA del body vive en ../_shared/citas.ts (Jest). El amigo se toma de la
// sesión (no del body) para evitar suplantación.
//
// TODO(push): notificar a ambas partes al confirmar — sin infraestructura de
// push aún (ver docs/backlog.md, misma nota que 4.3).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validarConfirmarCita } from '../_shared/citas.ts';
import { corsHeaders, preflightResponse } from '../_shared/cors.ts';

// SQLSTATE personalizados que emite confirmar_cita → status HTTP.
const ERRCODE_STATUS: Record<string, number> = {
  AY400: 400, // forma inválida (defensa en profundidad)
  AY403: 403, // no eres el amigo de esta cita
  AY404: 404, // cita inexistente
  AY409: 409, // estado no confirmable
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

  const validacion = validarConfirmarCita(await req.json());
  if (!validacion.ok) {
    return Response.json({ error: validacion.error }, { status: 400, headers: cors });
  }
  const body = validacion.body;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: resultado, error } = await admin.rpc('confirmar_cita', {
    p_amigo_id: user.id,
    p_cita_id: body.citaId,
    p_zona: body.zona,
    p_hora: body.hora,
    p_mensaje: body.mensaje,
  });

  if (error) {
    const status = ERRCODE_STATUS[error.code ?? ''] ?? 500;
    const mensaje = status === 500 ? 'No se pudo confirmar la cita.' : error.message;
    return Response.json({ error: mensaje }, { status, headers: cors });
  }

  return Response.json({ resultado }, { headers: cors });
});
