import { getCatalogo, newIdempotencyKey } from '@/lib/tienda';
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

// comprarBebida (comprar una bebida sin destinatario) se borró entera en
// E.2b, Tarea 5 — veto 1 del backlog, no se adapta ni se repone: a
// diferencia de bar/store/wallet (E.3/E.4 las reconstruyen), esta operación
// no puede volver a existir en el modelo nuevo.

describe('newIdempotencyKey', () => {
  it('generates a non-empty unique-ish key on each call', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
