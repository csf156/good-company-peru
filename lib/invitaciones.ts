import { supabase } from '@/lib/supabase';
import { getPublicProfile } from '@/lib/profile';

// Capa de datos de la propuesta (Fase E.3) — proponer un encuentro y
// responder a uno recibido. `getDesglose` y las lecturas de propuestas van
// DIRECTO contra la base (RLS: invitaciones_select_parte de 4.0, lista
// blanca de estados para el receptor de E.2a Tarea 2b). Crear y responder
// pasan por los Edge Functions ya desplegados (crear-invitacion,
// responder-invitacion) — el cliente nunca calcula ni mueve dinero, solo
// lee y muestra.

export type Desglose = { valorV: number; buyerFee: number; total: number };

/**
 * Desglose de comprar una bebida: valor + comisión + total, calculado en el
 * servidor (`calcular_desglose`, E.3 Tarea 2). Null si la bebida no existe o
 * está inactiva — nunca se calcula acá, ni siquiera para mostrar un estimado.
 */
export async function getDesglose(bebidaCatalogoId: string): Promise<Desglose | null> {
  const { data, error } = await supabase
    .rpc('calcular_desglose', { p_bebida_catalogo_id: bebidaCatalogoId })
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as unknown as { valor_v: number; buyer_fee: number; total: number };
  return { valorV: row.valor_v, buyerFee: row.buyer_fee, total: row.total };
}

export type CrearResult = { ok: true; invitacionId: string } | { ok: false; error: string };

/**
 * Crea una propuesta (invitación o solicitud) vía el Edge Function
 * crear-invitacion. `idempotencyKey` la genera y conserva quien llama —
 * esta función nunca la regenera: un reintento del MISMO intento con la
 * MISMA key no crea una segunda propuesta ni un segundo hold sobre la
 * tarjeta (`newIdempotencyKey`, ver `app/invitar/[receptorId].tsx`).
 */
export async function crearPropuesta(p: {
  receptorId: string;
  tipo: 'invitacion' | 'solicitud';
  bebidaCatalogoId: string | null;
  tiempoEstimadoMin: number | null;
  zonaAproximada: string | null;
  idempotencyKey: string;
}): Promise<CrearResult> {
  const { data, error } = await supabase.functions.invoke('crear-invitacion', {
    body: {
      receptorId: p.receptorId,
      tipo: p.tipo,
      bebidaCatalogoId: p.bebidaCatalogoId,
      tiempoEstimadoMin: p.tiempoEstimadoMin,
      zonaAproximada: p.zonaAproximada,
      idempotencyKey: p.idempotencyKey,
    },
  });

  if (error || !data?.invitacion?.id) {
    return { ok: false, error: error?.message ?? 'No se pudo crear la propuesta.' };
  }

  return { ok: true, invitacionId: data.invitacion.id };
}

export type ResponderResult = { ok: true; resultado: string } | { ok: false; error: string };

/**
 * Responde (acepta/rechaza) una propuesta recibida vía responder-invitacion.
 * `bebidaCatalogoId` solo aplica al aceptar una `solicitud` (el rentador
 * asigna la bebida en ese momento) — en cualquier otro caso va `null`.
 */
export async function responderPropuesta(p: {
  invitacionId: string;
  accion: 'aceptar' | 'rechazar';
  bebidaCatalogoId: string | null;
}): Promise<ResponderResult> {
  const { data, error } = await supabase.functions.invoke('responder-invitacion', {
    body: { invitacionId: p.invitacionId, accion: p.accion, bebidaCatalogoId: p.bebidaCatalogoId },
  });

  if (error || !data?.resultado) {
    return { ok: false, error: error?.message ?? 'No se pudo responder la propuesta.' };
  }

  return { ok: true, resultado: data.resultado };
}

export type Propuesta = {
  id: string;
  tipo: 'invitacion' | 'solicitud';
  estado: string;
  contraparte: { id: string; alias: string | null; fotoUrl: string | null };
  bebida: { nombre: string; valorV: number } | null;
  creadaEn: string;
};

type PropuestaRow = {
  id: string;
  tipo: 'invitacion' | 'solicitud';
  estado: string;
  created_at: string;
  bebidas_catalogo: { nombre: string; valor_v: number } | null;
};

const PROPUESTA_SELECT = 'id, tipo, estado, created_at, bebidas_catalogo(nombre, valor_v)';

async function getUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function mapPropuesta(row: PropuestaRow, contraparteId: string): Promise<Propuesta> {
  const perfil = await getPublicProfile(contraparteId);
  return {
    id: row.id,
    tipo: row.tipo,
    estado: row.estado,
    contraparte: { id: contraparteId, alias: perfil?.alias ?? null, fotoUrl: perfil?.foto_url ?? null },
    bebida: row.bebidas_catalogo
      ? { nombre: row.bebidas_catalogo.nombre, valorV: row.bebidas_catalogo.valor_v }
      : null,
    creadaEn: row.created_at,
  };
}

/**
 * Propuestas que me llegaron (soy el receptor). Excluye `preautorizando`
 * explícito, aunque la RLS ya se lo oculta al receptor (Tarea 2b de E.2a):
 * es el contrato que fija esta capa, no algo que dependa solo de la base.
 */
export async function getPropuestasRecibidas(): Promise<Propuesta[]> {
  const uid = await getUserId();
  if (!uid) {
    return [];
  }

  const { data, error } = await supabase
    .from('invitaciones')
    .select(`${PROPUESTA_SELECT}, emisor_id`)
    .eq('receptor_id', uid)
    .neq('estado', 'preautorizando')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as (PropuestaRow & { emisor_id: string })[];
  return Promise.all(rows.map((row) => mapPropuesta(row, row.emisor_id)));
}

/**
 * Propuestas que envié (soy el emisor) — TODOS los estados, incluido
 * `preautorizando`: la RLS siempre me deja ver mi propia fila. La UI (Tarea
 * 5) tiene que pintar `preautorizando` y `pendiente` igual — ver esa tarea.
 */
export async function getPropuestasEnviadas(): Promise<Propuesta[]> {
  const uid = await getUserId();
  if (!uid) {
    return [];
  }

  const { data, error } = await supabase
    .from('invitaciones')
    .select(`${PROPUESTA_SELECT}, receptor_id`)
    .eq('emisor_id', uid)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as (PropuestaRow & { receptor_id: string })[];
  return Promise.all(rows.map((row) => mapPropuesta(row, row.receptor_id)));
}

/**
 * Genera una idempotency key para un intento (crear o responder). El cliente
 * la reusa en reintentos del MISMO intento; regenerarla en cada toque del
 * botón crearía una propuesta nueva y un hold nuevo sobre la tarjeta. Movida
 * desde `lib/tienda.ts` (E.3 Tarea 1) — es donde pertenece ahora.
 */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
