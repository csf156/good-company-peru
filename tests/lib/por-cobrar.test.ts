import { getPorCobrar } from '@/lib/por-cobrar';
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
});

describe('getPorCobrar', () => {
  it('returns 0 when there is no signed-in user', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const monto = await getPorCobrar();

    expect(monto).toBe(0);
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 0 when the view has no row for this perfil (sin payouts todavía) — ausencia de fila, no un 0 explícito', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    const monto = await getPorCobrar();

    expect(monto).toBe(0);
    expect(mockedSupabase.from).toHaveBeenCalledWith('por_cobrar');
    expect(select).toHaveBeenCalledWith('por_cobrar');
    expect(eq).toHaveBeenCalledWith('perfil_id', 'user-1');
  });

  it('returns the aggregated amount when the view has a row', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const maybeSingle = jest.fn().mockResolvedValue({ data: { por_cobrar: 123.45 }, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    const monto = await getPorCobrar();

    expect(monto).toBe(123.45);
  });

  it('returns 0 on a server error instead of throwing', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    const monto = await getPorCobrar();

    expect(monto).toBe(0);
  });
});
