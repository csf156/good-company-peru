import { supabase } from '@/lib/supabase';

export type TipoInvitacion = 'divertida' | 'romantica' | 'misteriosa' | 'amigos' | 'autor';

export type Bebida = {
  id: string;
  nombre: string;
  tipo_invitacion: TipoInvitacion;
  valor_v: number;
};

/** Catálogo activo, ordenado por valor. RLS ya filtra `activo = true`. */
export async function getCatalogo(): Promise<Bebida[]> {
  const { data, error } = await supabase
    .from('bebidas_catalogo')
    .select('id, nombre, tipo_invitacion, valor_v')
    .order('valor_v', { ascending: true });

  if (error || !data) {
    return [];
  }
  return data as Bebida[];
}

export type Desglose = { valorV: number; buyerFee: number; total: number };
export type CompraResult = {
  estado: 'confirmada' | 'pendiente' | null;
  desglose: Desglose | null;
  error: string | null;
};

/**
 * Genera una idempotency key para un intento de compra. El cliente la reusa en
 * reintentos del MISMO intento (misma bebida hasta que la compra tenga éxito),
 * así un reintento no crea una segunda orden. Usa `crypto.randomUUID` si está
 * disponible (Node/algunos runtimes RN) y cae a un id de tiempo+aleatorio.
 */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Compra una bebida vía el Edge Function `comprar-bebida`. El cliente solo
 * envía el id y una idempotency key — el fee y el total los calcula el servidor
 * (Fase 3.1); nunca se recalculan aquí. La key hace idempotente la CREACIÓN de
 * la orden: un reintento con la misma key devuelve la orden existente en vez de
 * crear otra.
 */
export async function comprarBebida(
  bebidaId: string,
  idempotencyKey: string,
): Promise<CompraResult> {
  const { data, error } = await supabase.functions.invoke('comprar-bebida', {
    body: { bebidaId, idempotencyKey },
  });

  if (error) {
    return { estado: null, desglose: null, error: error.message };
  }

  return { estado: data.estado, desglose: data.desglose, error: null };
}
