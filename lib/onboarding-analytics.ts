import { supabase } from '@/lib/supabase';

/**
 * Registra el avance por el wizard de alta, para medir en qué paso se
 * abandona.
 *
 * Falla en silencio a propósito: la analítica NUNCA debe romper el alta ni
 * hacerla más lenta. Si el insert falla, el usuario no se entera y sigue.
 */
async function registrar(paso: number, evento: 'paso_visto' | 'completado'): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('onboarding_eventos').insert({ perfil_id: user.id, paso, evento });
  } catch {
    // Silencio deliberado — ver arriba.
  }
}

export function registrarPasoOnboarding(paso: number): void {
  void registrar(paso, 'paso_visto');
}

export function registrarOnboardingCompletado(): void {
  void registrar(7, 'completado');
}

/**
 * Los pasos 1-7 del embudo son el wizard de alta de perfil. La captura de KYC
 * son los cuatro siguientes: 8 intro, 9 DNI, 10 selfie, 11 resultado. Se
 * numeran corridos a propósito, para que el embudo se lea de un tirón desde el
 * registro hasta la verificación.
 */
const PRIMER_PASO_KYC = 7;

export function registrarPasoKyc(pasoKyc: 1 | 2 | 3 | 4): void {
  void registrar(PRIMER_PASO_KYC + pasoKyc, 'paso_visto');
}

export function registrarKycCompletado(): void {
  void registrar(PRIMER_PASO_KYC + 4, 'completado');
}
