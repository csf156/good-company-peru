export type AuthSegment =
  | 'carrusel'
  | 'sign-in'
  | 'recuperar'
  | 'nueva-contrasena'
  | 'select-role'
  | 'tos'
  | 'profile-setup'
  | 'kyc'
  | null;

export type ProfileStatus = 'none' | 'incomplete' | 'complete';
export type KycEstado = 'pendiente' | 'verificado' | 'rechazado';

export type RouteGuardInput = {
  hasSession: boolean;
  /** 'none' = no profiles row yet, 'incomplete' = row exists but Fase 1.3 form pending. */
  profileStatus: ProfileStatus;
  /** True si el perfil aceptó la versión VIGENTE del ToS (ver TOS_VERSION). */
  tosAceptado: boolean;
  kycEstado: KycEstado;
  /** Current screen name inside the (auth) group, or null if outside it. */
  authSegment: AuthSegment;
};

/**
 * Pure routing decision for app/_layout.tsx: given auth/profile/KYC state
 * and the current screen, returns the path to redirect to, or null to stay
 * put.
 */
export function computeRedirect({
  hasSession,
  profileStatus,
  tosAceptado,
  kycEstado,
  authSegment,
}: RouteGuardInput): string | null {
  // D.5: el enlace de recuperación de contraseña aterriza en nueva-contrasena
  // y establece la sesión ÉL MISMO (parseando el fragmento de la URL) — antes
  // de que eso termine, hasSession todavía puede ser false; después, puede
  // ser true con un perfil ya completo. En los dos casos se queda: es la
  // única pantalla que ignora el resto de la cadena de guardas.
  if (authSegment === 'nueva-contrasena') {
    return null;
  }

  if (!hasSession) {
    const allowedWhileSigningIn: AuthSegment[] = ['carrusel', 'sign-in', 'recuperar'];
    return allowedWhileSigningIn.includes(authSegment) ? null : '/(auth)/sign-in';
  }

  if (profileStatus === 'none') {
    return authSegment === 'select-role' ? null : '/(auth)/select-role';
  }

  // Va DESPUÉS de 'none' a propósito: la fila de profiles no existe hasta que
  // select-role la crea, y sin fila no hay dónde persistir la aceptación.
  if (!tosAceptado) {
    return authSegment === 'tos' ? null : '/(auth)/tos';
  }

  if (profileStatus === 'incomplete') {
    return authSegment === 'profile-setup' ? null : '/(auth)/profile-setup';
  }

  if (kycEstado !== 'verificado') {
    return authSegment === 'kyc' ? null : '/(auth)/kyc';
  }

  return authSegment !== null ? '/' : null;
}
