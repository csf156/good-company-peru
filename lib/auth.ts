import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { isValidEmail } from '@/lib/validation';

// Requerido por expo-web-browser en web para cerrar el flujo de auth al volver.
WebBrowser.maybeCompleteAuthSession();

/**
 * En web, `makeRedirectUri()` de expo-auth-session arma el redirect con
 * `window.location.origin` a secas (ver SessionUrlProvider.js), ignorando el
 * sub-path del deploy (`experiments.baseUrl`, ej. `/good-company-peru` en
 * GitHub Pages). Eso manda el retorno de OAuth/OTP a un origin sin sitio de
 * Pages propio. Se arma a mano con origin + baseUrl del build.
 */
function webRedirectUri(): string {
  const baseUrl = Constants.expoConfig?.experiments?.baseUrl ?? '';
  return `${window.location.origin}${baseUrl}/`;
}

// `typeof window` no alcanza: el entorno de test (jest-expo) define un
// `window` global sin `location` (alias de `global`), y nativo real no
// define `window` en absoluto. `window.location` sí distingue web real.
function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined';
}

export type RolUsuario = 'amigo' | 'rentador';

export type AuthResult = { error: string | null; needsEmailConfirmation?: boolean };

const MIN_PASSWORD_LENGTH = 8;

// D.5: un único mensaje pase lo que pase del lado del servidor — correo
// inexistente, contraseña incorrecta o correo sin confirmar se ven todos
// iguales desde afuera. Distinguirlos es la puerta de la enumeración de
// cuentas (spec de la fase, regla de copy de seguridad).
const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos.';

function passwordError(password: string): string | null {
  return password.length < MIN_PASSWORD_LENGTH
    ? `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
    : null;
}

/**
 * Crea una cuenta con correo y contraseña. Con la confirmación de correo
 * activa (D.5, requisito de seguridad de esta fase), Supabase no deja sesión
 * iniciada tras el signup — `data.session` viene null aunque no haya error.
 */
export async function signUpWithPassword(email: string, password: string): Promise<AuthResult> {
  if (!isValidEmail(email)) {
    return { error: 'Correo inválido.' };
  }
  const pwError = passwordError(password);
  if (pwError) {
    return { error: pwError };
  }

  const { data, error } = await supabase.auth.signUp(
    isWeb()
      ? { email: email.trim(), password, options: { emailRedirectTo: webRedirectUri() } }
      : { email: email.trim(), password },
  );

  if (error) {
    return { error: error.message };
  }

  return { error: null, needsEmailConfirmation: !data.session };
}

/** Inicia sesión con correo y contraseña. */
export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  if (!isValidEmail(email) || password.length === 0) {
    return { error: CREDENCIALES_INVALIDAS };
  }

  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

  return { error: error ? CREDENCIALES_INVALIDAS : null };
}

/**
 * Pide el correo de recuperación de contraseña. Responde éxito SIEMPRE,
 * exista o no la cuenta — lo contrario permite averiguar qué correos están
 * registrados (misma regla que `signInWithPassword`).
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!isValidEmail(email)) {
    return { error: 'Correo inválido.' };
  }

  await supabase.auth.resetPasswordForEmail(
    email.trim(),
    isWeb() ? { redirectTo: webRedirectUri() } : undefined,
  );

  return { error: null };
}

/** Fija una nueva contraseña para la sesión activa (tras el enlace de recuperación). */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const pwError = passwordError(newPassword);
  if (pwError) {
    return { error: pwError };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

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
 * Extrae access_token/refresh_token de un fragmento de URL (`#token=...` o
 * `token=...`, con o sin el `#` inicial — `window.location.hash` lo trae
 * puesto, la URL de retorno de WebBrowser no). Usado tanto por el retorno de
 * Google como por el enlace de recuperación de contraseña (D.5): los dos
 * mandan la sesión nueva de la misma forma.
 */
function parseSessionFragment(fragment: string): { accessToken: string; refreshToken: string } | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

/**
 * Establece la sesión de Supabase a partir de la URL de retorno del flujo
 * OAuth (contiene access_token/refresh_token en el fragmento `#`). Separada
 * de signInWithGoogle para poder testear el parseo sin mockear WebBrowser.
 */
export async function completeGoogleSignIn(url: string): Promise<AuthResult> {
  const parsed = parseSessionFragment(url.split('#')[1] ?? '');
  if (!parsed) {
    return { error: 'No se pudo completar el ingreso con Google.' };
  }

  const { error } = await supabase.auth.setSession({
    access_token: parsed.accessToken,
    refresh_token: parsed.refreshToken,
  });

  return { error: error?.message ?? null };
}

/**
 * Establece la sesión a partir del enlace de recuperación de contraseña
 * (D.5). En web, `detectSessionInUrl: false` (lib/supabase.ts) hace que
 * Supabase NUNCA consuma solo el access_token de la URL — hay que leerlo a
 * mano de `window.location.hash` y pasarlo aquí.
 */
export async function completePasswordRecovery(fragment: string): Promise<AuthResult> {
  const parsed = parseSessionFragment(fragment);
  if (!parsed) {
    return { error: 'El enlace de recuperación no es válido o ya venció.' };
  }

  const { error } = await supabase.auth.setSession({
    access_token: parsed.accessToken,
    refresh_token: parsed.refreshToken,
  });

  return { error: error?.message ?? null };
}

/** Inicia sesión con Google: abre el navegador, espera el resultado, establece la sesión. */
export async function signInWithGoogle(): Promise<AuthResult> {
  const redirectTo = isWeb() ? webRedirectUri() : makeRedirectUri();

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
