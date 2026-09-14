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

// `comprarBebida` (comprar una bebida sin destinatario, vía el Edge Function
// `comprar-bebida`) se borró en E.2b, Tarea 5 — veto 1 del backlog: esa
// operación no existe en el modelo nuevo (la invitación es la compra, spec
// §3.2) y no puede volver a existir. `CompraResult` se conserva: lo sigue
// usando el stub de `app/store.tsx` hasta que E.3 reescriba esa pantalla.
