import { getCatalogo, comprarBebida } from '@/lib/tienda';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

const mockedSupabase = supabase as unknown as {
  from: jest.Mock;
  functions: { invoke: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getCatalogo', () => {
  it('lists active bebidas ordered by valor_v', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        { id: 'd1', nombre: 'Cerveza', tipo_invitacion: 'divertida', valor_v: 40 },
        { id: 'd2', nombre: 'Vino', tipo_invitacion: 'romantica', valor_v: 80 },
      ],
      error: null,
    });
    const select = jest.fn().mockReturnValue({ order });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getCatalogo();

    expect(mockedSupabase.from).toHaveBeenCalledWith('bebidas_catalogo');
    expect(select).toHaveBeenCalledWith('id, nombre, tipo_invitacion, valor_v');
    expect(order).toHaveBeenCalledWith('valor_v', { ascending: true });
    expect(result).toEqual([
      { id: 'd1', nombre: 'Cerveza', tipo_invitacion: 'divertida', valor_v: 40 },
      { id: 'd2', nombre: 'Vino', tipo_invitacion: 'romantica', valor_v: 80 },
    ]);
  });

  it('returns an empty array on error instead of throwing', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const select = jest.fn().mockReturnValue({ order });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getCatalogo();

    expect(result).toEqual([]);
  });
});

describe('comprarBebida', () => {
  it('invokes comprar-bebida with only the bebidaId (no client-side amounts)', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: { estado: 'confirmada', ordenId: 'ord-1', desglose: { valorV: 40, buyerFee: 6, total: 46 } },
      error: null,
    });

    const result = await comprarBebida('d1');

    expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('comprar-bebida', {
      body: { bebidaId: 'd1' },
    });
    expect(result).toEqual({
      estado: 'confirmada',
      desglose: { valorV: 40, buyerFee: 6, total: 46 },
      error: null,
    });
  });

  it('surfaces a function invocation error (e.g. KYC no verificado, bebida no disponible)', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Debes verificar tu identidad (KYC) antes de comprar.' },
    });

    const result = await comprarBebida('d1');

    expect(result.estado).toBeNull();
    expect(result.desglose).toBeNull();
    expect(result.error).toBe('Debes verificar tu identidad (KYC) antes de comprar.');
  });
});
