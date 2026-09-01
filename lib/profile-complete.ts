import type { RolUsuario } from '@/lib/auth';

export type KycEstado = 'pendiente' | 'verificado' | 'rechazado';

export type OwnProfile = {
  rol: RolUsuario;
  nombre: string | null;
  alias: string | null;
  fecha_nacimiento: string | null;
  genero: string | null;
  profesion: string | null;
  foto_url: string | null;
  hobbies: string[];
  tipo_salida: string[];
  kyc_estado: KycEstado;
};

// `profesion` sale del alta en la fase D.3: la columna sigue existiendo pero
// nadie la escribe. Dejarla aquí devolvería al usuario al wizard en bucle,
// porque route-guard nunca consideraría su perfil completo.
const REQUIRED_FIELDS = ['nombre', 'alias', 'fecha_nacimiento', 'genero', 'foto_url'] as const;

/** True once the onboarding form (Fase 1.3) has been filled in. */
export function isProfileComplete(profile: OwnProfile | null): boolean {
  if (!profile) return false;
  return REQUIRED_FIELDS.every((field) => profile[field] !== null && profile[field] !== '');
}
