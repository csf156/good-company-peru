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
