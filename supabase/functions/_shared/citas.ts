// Validación de forma del body de confirmar-cita (Fase 4.5).
//
// Deliberadamente ISOMÓRFICA y sin I/O: solo chequea la FORMA del request
// (tipos, campos requeridos, hora parseable como fecha) para poder testearla
// con Jest sin el runtime de Supabase, igual que _shared/invitaciones.ts. La
// lógica de NEGOCIO real (quién es "el amigo" — determinado dinámicamente vía
// join invitaciones+profiles, no fijo a emisor/receptor —, qué estados son
// confirmables, la idempotencia benigna) NO vive acá: vive en la función SQL
// confirmar_cita, que es la única forma atómica de hacerla (mismo motivo que
// crear_invitacion/responder_invitacion). El cliente nunca decide esto.

export type ConfirmarCitaBody = {
  citaId: string;
  zona: string;
  // ISO (o cualquier string parseable por Date.parse); se envía tal cual a la
  // función SQL, que la castea a timestamptz.
  hora: string;
  // Opcional: nota adicional del amigo al confirmar. Ausente/blanco → null.
  mensaje: string | null;
};

export type ValidacionResult =
  { ok: true; body: ConfirmarCitaBody } | { ok: false; error: string };

function esUuidNoVacio(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function esStringNoVacio(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Valida y normaliza el body de confirmar-cita. El `amigoId` (actor) NO viene
 * del body: es el usuario de la sesión (anti-suplantación) — igual que
 * responder-invitacion no recibe `receptorId`. No toca la base de datos.
 */
export function validarConfirmarCita(raw: unknown): ValidacionResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Body inválido.' };
  }
  const b = raw as Record<string, unknown>;

  if (!esUuidNoVacio(b.citaId)) {
    return { ok: false, error: 'citaId es requerido.' };
  }
  if (!esStringNoVacio(b.zona)) {
    return { ok: false, error: 'zona es requerida.' };
  }
  if (!esStringNoVacio(b.hora) || Number.isNaN(Date.parse(b.hora as string))) {
    return { ok: false, error: 'hora debe ser una fecha válida.' };
  }

  let mensaje: string | null = null;
  if (b.mensaje !== undefined && b.mensaje !== null) {
    if (typeof b.mensaje !== 'string') {
      return { ok: false, error: 'mensaje debe ser texto.' };
    }
    mensaje = b.mensaje.trim() || null;
  }

  return {
    ok: true,
    body: {
      citaId: b.citaId,
      zona: (b.zona as string).trim(),
      hora: b.hora as string,
      mensaje,
    },
  };
}
