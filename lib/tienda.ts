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

// `comprarBebida` (comprar una bebida sin destinatario, vía el Edge Function
// `comprar-bebida`) se borró en E.2b, Tarea 5 — veto 1 del backlog: esa
// operación no existe en el modelo nuevo (la invitación es la compra, spec
// §3.2) y no puede volver a existir. `app/store.tsx` (su único consumidor,
// junto con los tipos `CompraResult`/`Desglose` que solo existían para su
// stub) se borró en E.3, Tarea 1 — la propuesta reemplaza a la compra suelta.
// `newIdempotencyKey` vivía acá también; se mudó a `lib/invitaciones.ts` en
// la Tarea 3 — es la propuesta la que la usa ahora, no una compra suelta.
