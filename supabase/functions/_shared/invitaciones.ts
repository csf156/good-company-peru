// Validación de forma del body de crear-invitacion (Fase 4.2).
//
// Deliberadamente ISOMÓRFICA y sin I/O: solo chequea la FORMA del request (tipos,
// campos requeridos, coherencia tipo↔bebida) para poder testearla con Jest sin el
// runtime de Supabase, igual que _shared/pagos.ts. La validación de NEGOCIO real
// (emisor verificado, bebida disponible y del emisor, idempotencia, bloqueo
// atómico) NO vive acá: vive en la función SQL crear_invitacion, que es la única
// forma atómica de hacerla (mismo motivo que confirmar_orden_pago). El cliente
// nunca calcula ni mueve estado de dinero/escrow.

export type TipoPropuesta = 'invitacion' | 'solicitud';

export type CrearInvitacionBody = {
  receptorId: string;
  tipo: TipoPropuesta;
  // Solo en `invitacion` de rentador. En `solicitud` es null (la bebida la pone
  // el rentador al aceptar, fase 4.3).
  bebidaBarId: string | null;
  tiempoEstimadoMin: number | null;
  zonaAproximada: string | null;
  idempotencyKey: string;
};

export type ValidacionResult =
  { ok: true; body: CrearInvitacionBody } | { ok: false; error: string };

function esUuidNoVacio(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Valida y normaliza el body de crear-invitacion. `emisorId` viene de la sesión
 * (no del body) para poder rechazar la auto-invitación. Devuelve un body
 * normalizado (bebidaBarId a null en solicitud, campos opcionales a null) o el
 * primer error de forma encontrado. No toca la base de datos.
 */
export function validarCrearInvitacion(raw: unknown, emisorId: string): ValidacionResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Body inválido.' };
  }
  const b = raw as Record<string, unknown>;

  if (!esUuidNoVacio(b.receptorId)) {
    return { ok: false, error: 'receptorId es requerido.' };
  }
  if (b.tipo !== 'invitacion' && b.tipo !== 'solicitud') {
    return { ok: false, error: 'tipo debe ser invitacion o solicitud.' };
  }
  if (!esUuidNoVacio(b.idempotencyKey)) {
    return { ok: false, error: 'idempotencyKey es requerida.' };
  }
  if (b.receptorId === emisorId) {
    return { ok: false, error: 'No puedes invitarte a ti mismo.' };
  }

  const tipo = b.tipo as TipoPropuesta;

  // Coherencia tipo ↔ bebida.
  const bebidaPresente = b.bebidaBarId !== undefined && b.bebidaBarId !== null;
  if (tipo === 'invitacion') {
    if (!esUuidNoVacio(b.bebidaBarId)) {
      return { ok: false, error: 'Una invitación requiere una bebida de tu bar.' };
    }
  } else if (bebidaPresente) {
    return { ok: false, error: 'Una solicitud no lleva bebida.' };
  }

  // tiempoEstimadoMin: opcional, pero si viene debe ser un entero positivo.
  let tiempoEstimadoMin: number | null = null;
  if (b.tiempoEstimadoMin !== undefined && b.tiempoEstimadoMin !== null) {
    const t = b.tiempoEstimadoMin;
    if (typeof t !== 'number' || !Number.isInteger(t) || t <= 0) {
      return { ok: false, error: 'tiempoEstimadoMin debe ser un entero positivo.' };
    }
    tiempoEstimadoMin = t;
  }

  const zonaAproximada = typeof b.zonaAproximada === 'string' ? b.zonaAproximada : null;

  return {
    ok: true,
    body: {
      receptorId: b.receptorId,
      tipo,
      bebidaBarId: tipo === 'invitacion' ? (b.bebidaBarId as string) : null,
      tiempoEstimadoMin,
      zonaAproximada,
      idempotencyKey: b.idempotencyKey,
    },
  };
}
