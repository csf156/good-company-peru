import {
  registrarPasoOnboarding,
  registrarOnboardingCompletado,
  registrarPasoKyc,
  registrarKycCompletado,
} from '@/lib/onboarding-analytics';
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

/** Compartido entre todos los tests — extraído para que los de KYC puedan
 * configurarlo directo (`mockInsert.mockRejectedValueOnce(...)`) sin duplicar
 * el `mockReturnValue({ insert })` de cada `describe`. */
const mockInsert = jest.fn();

/** `registrar` es fire-and-forget (devuelve void) — deja correr sus awaits internos. */
async function esperarMicrotareas() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  mockedSupabase.from.mockReturnValue({ insert: mockInsert });
});

describe('registrarPasoOnboarding', () => {
  it('inserta el paso visto para el usuario actual', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    registrarPasoOnboarding(3);
    await esperarMicrotareas();

    expect(mockedSupabase.from).toHaveBeenCalledWith('onboarding_eventos');
    expect(mockInsert).toHaveBeenCalledWith({ perfil_id: 'user-1', paso: 3, evento: 'paso_visto' });
  });

  it('no hace nada si no hay sesión', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    registrarPasoOnboarding(2);
    await esperarMicrotareas();

    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('no propaga el error si el insert falla — la analítica nunca rompe el alta', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockInsert.mockRejectedValueOnce(new Error('sin red'));

    expect(() => registrarPasoOnboarding(4)).not.toThrow();
    await esperarMicrotareas();
  });
});

describe('registrarOnboardingCompletado', () => {
  it('inserta el evento completado en el paso 7', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    registrarOnboardingCompletado();
    await esperarMicrotareas();

    expect(mockInsert).toHaveBeenCalledWith({ perfil_id: 'user-1', paso: 7, evento: 'completado' });
  });
});

describe('analítica de KYC', () => {
  it('mapea los cuatro pasos de KYC al rango 8-11 del embudo', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    registrarPasoKyc(1);
    registrarPasoKyc(4);
    await esperarMicrotareas();

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ paso: 8, evento: 'paso_visto' }),
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ paso: 11, evento: 'paso_visto' }),
    );
  });

  it('registra el fin de KYC como completado en el paso 11', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    registrarKycCompletado();
    await esperarMicrotareas();

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ paso: 11, evento: 'completado' }),
    );
  });

  it('no lanza si el insert falla: la analítica nunca rompe el flujo', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockInsert.mockRejectedValueOnce(new Error('sin red'));

    expect(() => registrarPasoKyc(2)).not.toThrow();
    await esperarMicrotareas();
  });
});
