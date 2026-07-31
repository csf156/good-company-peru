import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import { isValidEmail, toE164Peru } from '@/lib/validation';

// Requerido por expo-web-browser en web para cerrar el flujo de auth al volver.
WebBrowser.maybeCompleteAuthSession();

export type Contact = { type: 'email'; value: string } | { type: 'phone'; value: string };

export type RolUsuario = 'amigo' | 'rentador';

export type AuthResult = { error: string | null };

function normalizeContact(contact: Contact): { field: 'email' | 'phone'; value: string } | null {
  if (contact.type === 'email') {
    return isValidEmail(contact.value) ? { field: 'email', value: contact.value.trim() } : null;
  }
  const e164 = toE164Peru(contact.value);
  return e164 ? { field: 'phone', value: e164 } : null;
}

const INVALID_MESSAGE: Record<Contact['type'], string> = {
  email: 'Correo inválido.',
  phone: 'Número de celular inválido.',
};

/** Sends a one-time code to the given email or Peru mobile number. */
export async function requestOtp(contact: Contact): Promise<AuthResult> {
  const normalized = normalizeContact(contact);
  if (!normalized) {
    return { error: INVALID_MESSAGE[contact.type] };
  }

  const { error } = await supabase.auth.signInWithOtp({
    [normalized.field]: normalized.value,
  } as { email: string } | { phone: string });

  return { error: error?.message ?? null };
}

/** Verifies a one-time code previously sent via requestOtp. */
export async function verifyOtp(contact: Contact, token: string): Promise<AuthResult> {
  const normalized = normalizeContact(contact);
  if (!normalized) {
    return { error: INVALID_MESSAGE[contact.type] };
  }

  const { error } = await supabase.auth.verifyOtp(
    normalized.field === 'email'
      ? { email: normalized.value, token, type: 'email' }
      : { phone: normalized.value, token, type: 'sms' },
  );

  return { error: error?.message ?? null };
}

/**
 * Bootstraps the `profiles` row for the signed-in user on first login.
 * Only (id, rol) are sent — every other column is service_role-only
 * (see supabase/migrations/20260703120100_column_privileges.sql).
 */
export async function createProfile(rol: RolUsuario): Promise<AuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No hay sesión activa.' };
  }

  const { error } = await supabase.from('profiles').insert({ id: user.id, rol });

  return { error: error?.message ?? null };
}

/**
 * Establece la sesión de Supabase a partir de la URL de retorno del flujo
 * OAuth (contiene access_token/refresh_token en el fragmento `#`). Separada
 * de signInWithGoogle para poder testear el parseo sin mockear WebBrowser.
 */
export async function completeGoogleSignIn(url: string): Promise<AuthResult> {
  const fragment = url.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return { error: 'No se pudo completar el ingreso con Google.' };
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return { error: error?.message ?? null };
}

/** Inicia sesión con Google: abre el navegador, espera el resultado, establece la sesión. */
export async function signInWithGoogle(): Promise<AuthResult> {
  const redirectTo = makeRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return { error: error?.message ?? 'No se pudo iniciar el ingreso con Google.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    return { error: 'Ingreso con Google cancelado.' };
  }

  return completeGoogleSignIn(result.url);
}
