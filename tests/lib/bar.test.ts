import { getMiBar, getBalance } from '@/lib/bar';
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

beforeEach(() => {
  jest.clearAllMocks();
  mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('getMiBar', () => {
  it('lists bar rows newest-first with the joined bebida info', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'bar-1',
          estado: 'disponible',
          bebidas_catalogo: { nombre: 'Cerveza', tipo_invitacion: 'divertida', valor_v: 40 },
        },
        {
          id: 'bar-2',
          estado: 'consumida',
          bebidas_catalogo: { nombre: 'Vino', tipo_invitacion: 'romantica', valor_v: 80 },
        },
      ],
      error: null,
    });
    const select = jest.fn().mockReturnValue({ order });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getMiBar();

    expect(mockedSupabase.from).toHaveBeenCalledWith('bar');
    expect(select).toHaveBeenCalledWith(
      'id, estado, bebidas_catalogo(nombre, tipo_invitacion, valor_v)',
    );
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual([
      { id: 'bar-1', estado: 'disponible', bebida: { nombre: 'Cerveza', tipoInvitacion: 'divertida', valorV: 40 } },
      { id: 'bar-2', estado: 'consumida', bebida: { nombre: 'Vino', tipoInvitacion: 'romantica', valorV: 80 } },
    ]);
  });

  it('tolerates a row whose bebida was deactivated after purchase (RLS hides it, not an error)', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [{ id: 'bar-1', estado: 'disponible', bebidas_catalogo: null }],
      error: null,
    });
    const select = jest.fn().mockReturnValue({ order });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getMiBar();

    expect(result).toEqual([{ id: 'bar-1', estado: 'disponible', bebida: null }]);
  });

  it('returns an empty array on error instead of throwing', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const select = jest.fn().mockReturnValue({ order });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getMiBar();

    expect(result).toEqual([]);
  });
});

describe('getBalance', () => {
  it("reads the signed-in user's balance from the calculated view", async () => {
    const eq = jest.fn().mockReturnValue({
      maybeSingle: jest.fn().mockResolvedValue({ data: { balance: 12.5 }, error: null }),
    });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getBalance();

    expect(mockedSupabase.from).toHaveBeenCalledWith('balance');
    expect(select).toHaveBeenCalledWith('balance');
    expect(eq).toHaveBeenCalledWith('perfil_id', 'user-1');
    expect(result).toBe(12.5);
  });

  it('returns 0 when there is no ledger activity yet (no row in the view)', async () => {
    const eq = jest.fn().mockReturnValue({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getBalance();

    expect(result).toBe(0);
  });
});
