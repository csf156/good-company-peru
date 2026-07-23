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
 * Compra una bebida vía el Edge Function `comprar-bebida`. El cliente solo
 * envía el id — el fee y el total los calcula el servidor (Fase 3.1); nunca
 * se recalculan aquí.
 */
export async function comprarBebida(bebidaId: string): Promise<CompraResult> {
  const { data, error } = await supabase.functions.invoke('comprar-bebida', {
    body: { bebidaId },
  });

  if (error) {
    return { estado: null, desglose: null, error: error.message };
  }

  return { estado: data.estado, desglose: data.desglose, error: null };
}
