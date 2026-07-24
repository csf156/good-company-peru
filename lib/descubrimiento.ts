import { supabase } from '@/lib/supabase';
import { getOwnProfile, type PublicProfile } from '@/lib/profile';

type Rol = 'amigo' | 'rentador';

const ROL_OPUESTO: Record<Rol, Rol> = {
  amigo: 'rentador',
  rentador: 'amigo',
};

export type Descubrimiento = {
  rolPropio: Rol;
  perfiles: PublicProfile[];
};

/**
 * Perfiles verificados del rol opuesto al propio, para el swipe de
 * descubrimiento (Fase 4.1). Sin filtros premium ni gating por nivel — eso es
 * sub-proyecto 2.
 */
export async function getPerfilesDescubrir(): Promise<Descubrimiento | null> {
  const propio = await getOwnProfile();
  if (!propio) {
    return null;
  }

  const rolBuscado = ROL_OPUESTO[propio.rol as Rol];

  const { data, error } = await supabase
    .from('perfiles_publicos')
    .select('*')
    .eq('rol', rolBuscado)
    .eq('kyc_estado', 'verificado');

  return {
    rolPropio: propio.rol as Rol,
    perfiles: error || !data ? [] : (data as PublicProfile[]),
  };
}
