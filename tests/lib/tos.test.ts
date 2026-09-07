import { getTosAceptado, aceptarTos, TOS_VERSION } from '@/lib/tos';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));

const mockedGetUser = supabase.auth.getUser as jest.Mock;
const mockedFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

/** Encadena select().eq().eq().limit() devolviendo `rows`. */
function mockSelect(rows: unknown[], error: unknown = null) {
  const limit = jest.fn().mockResolvedValue({ data: rows, error });
  const eq2 = jest.fn(() => ({ limit }));
  const eq1 = jest.fn(() => ({ eq: eq2 }));
  const select = jest.fn(() => ({ eq: eq1 }));
  mockedFrom.mockReturnValue({ select });
  return { select, eq1, eq2, limit };
}

describe('getTosAceptado', () => {
  it('es true cuando existe una aceptación de la versión vigente', async () => {
    mockSelect([{ id: 1 }]);
    await expect(getTosAceptado()).resolves.toBe(true);
  });

  it('es false cuando no hay ninguna', async () => {
    mockSelect([]);
    await expect(getTosAceptado()).resolves.toBe(false);
  });

  it('consulta por la versión vigente, no por cualquiera', async () => {
    const m = mockSelect([]);
    await getTosAceptado();
    expect(m.eq2).toHaveBeenCalledWith('version', TOS_VERSION);
  });

  it('es false si no hay sesión', async () => {
    mockedGetUser.mockResolvedValue({ data: { user: null } });
    await expect(getTosAceptado()).resolves.toBe(false);
  });

  it('falla cerrado: ante error devuelve false y no lanza', async () => {
    mockSelect([], { message: 'sin red' });
    await expect(getTosAceptado()).resolves.toBe(false);
  });
});

describe('aceptarTos', () => {
  it('inserta el perfil y la versión vigente', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockedFrom.mockReturnValue({ insert });

    await expect(aceptarTos()).resolves.toEqual({ error: null });
    expect(insert).toHaveBeenCalledWith({ perfil_id: 'user-1', version: TOS_VERSION });
  });

  it('devuelve el error si el insert falla', async () => {
    const insert = jest.fn().mockResolvedValue({ error: { message: 'sin red' } });
    mockedFrom.mockReturnValue({ insert });

    await expect(aceptarTos()).resolves.toEqual({ error: 'sin red' });
  });

  it('devuelve error si no hay sesión, sin insertar', async () => {
    mockedGetUser.mockResolvedValue({ data: { user: null } });
    const insert = jest.fn();
    mockedFrom.mockReturnValue({ insert });

    const r = await aceptarTos();
    expect(r.error).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });
});

// Bloqueo detectado en la revision de seguridad de D.4: si getTosAceptado()
// falla de forma transitoria, el guardian devuelve a la pantalla a alguien que
// YA acepto. Al pulsar aceptar choca con el indice unico (23505) y queda
// atrapado: cada reintento da el mismo error. Que la fila exista es
// exactamente la condicion de exito, asi que se trata como tal.
describe('aceptarTos e idempotencia', () => {
  it('trata la violacion de unicidad como exito: la aceptacion ya existe', async () => {
    const insert = jest.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    mockedFrom.mockReturnValue({ insert });

    await expect(aceptarTos()).resolves.toEqual({ error: null });
  });

  it('sigue devolviendo los demas errores', async () => {
    const insert = jest.fn().mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });
    mockedFrom.mockReturnValue({ insert });

    await expect(aceptarTos()).resolves.toEqual({ error: 'permission denied' });
  });
});
