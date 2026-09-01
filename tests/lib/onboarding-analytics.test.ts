import { registrarPasoOnboarding, registrarOnboardingCompletado } from '@/lib/onboarding-analytics';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const mockedSupabase = supabase as unknown as {
  auth: { getUser: jest.Mock };
  from: jest.Mock;
};

/** `registrar` es fire-and-forget (devuelve void) — deja correr sus awaits internos. */
async function esperarMicrotareas() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('registrarPasoOnboarding', () => {
  it('inserta el paso visto para el usuario actual', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockedSupabase.from.mockReturnValue({ insert });

    registrarPasoOnboarding(3);
    await esperarMicrotareas();

    expect(mockedSupabase.from).toHaveBeenCalledWith('onboarding_eventos');
    expect(insert).toHaveBeenCalledWith({ perfil_id: 'user-1', paso: 3, evento: 'paso_visto' });
  });

  it('no hace nada si no hay sesión', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    registrarPasoOnboarding(2);
    await esperarMicrotareas();

    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('no propaga el error si el insert falla — la analítica nunca rompe el alta', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockedSupabase.from.mockReturnValue({
      insert: jest.fn().mockRejectedValue(new Error('sin red')),
    });

    expect(() => registrarPasoOnboarding(4)).not.toThrow();
    await esperarMicrotareas();
  });
});

describe('registrarOnboardingCompletado', () => {
  it('inserta el evento completado en el paso 7', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockedSupabase.from.mockReturnValue({ insert });

    registrarOnboardingCompletado();
    await esperarMicrotareas();

    expect(insert).toHaveBeenCalledWith({ perfil_id: 'user-1', paso: 7, evento: 'completado' });
  });
});
