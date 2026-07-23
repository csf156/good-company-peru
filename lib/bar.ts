import { supabase } from '@/lib/supabase';
import type { TipoInvitacion } from '@/lib/tienda';

export type EstadoBar = 'disponible' | 'bloqueada' | 'consumida';

export type BarItem = {
  id: string;
  estado: EstadoBar;
  // null si la bebida referenciada fue desactivada del catálogo después de la
  // compra — la RLS de bebidas_catalogo solo expone bebidas activas (Fase
  // 3.0), así que el join no la trae. No es un error: el stock sigue siendo
  // del rentador, solo no podemos mostrar su nombre/tipo/valor.
  bebida: { nombre: string; tipoInvitacion: TipoInvitacion; valorV: number } | null;
};

type BarRow = {
  id: string;
  estado: EstadoBar;
  bebidas_catalogo: { nombre: string; tipo_invitacion: TipoInvitacion; valor_v: number } | null;
};

/** Stock del rentador (RLS ya filtra a su propia fila). Más reciente primero. */
export async function getMiBar(): Promise<BarItem[]> {
  const { data, error } = await supabase
    .from('bar')
    .select('id, estado, bebidas_catalogo(nombre, tipo_invitacion, valor_v)')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as unknown as BarRow[]).map((row) => ({
    id: row.id,
    estado: row.estado,
    bebida: row.bebidas_catalogo
      ? {
          nombre: row.bebidas_catalogo.nombre,
          tipoInvitacion: row.bebidas_catalogo.tipo_invitacion,
          valorV: row.bebidas_catalogo.valor_v,
        }
      : null,
  }));
}

/**
 * Balance disponible, leído de la vista `balance` (Fase 3.0) — nunca un
 * número mutable suelto. Sin actividad en el ledger, la vista no tiene fila
 * para el usuario: eso es balance 0, no un error.
 */
export async function getBalance(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return 0;
  }

  const { data } = await supabase.from('balance').select('balance').eq('perfil_id', user.id).maybeSingle();

  return data?.balance ?? 0;
}
