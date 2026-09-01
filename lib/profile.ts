import { supabase } from '@/lib/supabase';
import type { AuthResult } from '@/lib/auth';
import { isProfileComplete, type OwnProfile } from '@/lib/profile-complete';

export type { OwnProfile };
export { isProfileComplete };

const PROFILE_SELECT =
  'rol, nombre, alias, fecha_nacimiento, genero, profesion, foto_url, hobbies, tipo_salida, kyc_estado';

/** Returns the signed-in user's profile, or null if none exists yet. */
export async function getOwnProfile(): Promise<OwnProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .maybeSingle();

  return data as OwnProfile | null;
}

export type PublicProfile = {
  id: string;
  rol: string;
  alias: string | null;
  edad: number | null;
  genero: string | null;
  profesion: string | null;
  hobbies: string[];
  tipo_salida: string[];
  foto_url: string | null;
  kyc_estado: string;
};

/**
 * Reads another user's SAFE public fields via the `perfiles_publicos` view
 * (Fase 1.5 migration) — never the `profiles` table directly, whose RLS
 * only allows reading your own row. The view's column allowlist (not this
 * function) is what keeps nombre, saldo/nivel and other sensitive fields
 * out of reach.
 */
export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  const { data } = await supabase.from('perfiles_publicos').select('*').eq('id', id).maybeSingle();
  return data as PublicProfile | null;
}

export type ProfileFormFields = {
  nombre: string;
  alias: string;
  fecha_nacimiento: string;
  genero: string;
  profesion: string;
  hobbies: string[];
  tipo_salida: string[];
  foto_url?: string;
};

/**
 * Updates the signed-in user's editable profile fields. Only the columns
 * granted to `authenticated` (see 20260703120100_column_privileges.sql) can
 * ever be written this way — anything else is rejected server-side.
 */
export async function updateOwnProfile(fields: Partial<ProfileFormFields>): Promise<AuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No hay sesión activa.' };
  }

  const { error } = await supabase.from('profiles').update(fields).eq('id', user.id);

  return { error: error?.message ?? null };
}

export type PreferenciasSalidaFields = {
  sexo_pref?: string;
  tipo_salida?: string;
  horario?: string;
  distritos?: string[];
};

/** Creates or replaces the amigo's preferencias_salida row (1:1 with profiles). */
export async function upsertPreferenciasSalida(
  fields: PreferenciasSalidaFields,
): Promise<AuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No hay sesión activa.' };
  }

  const { error } = await supabase
    .from('preferencias_salida')
    .upsert({ perfil_id: user.id, ...fields }, { onConflict: 'perfil_id' });

  return { error: error?.message ?? null };
}
