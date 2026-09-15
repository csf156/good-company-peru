import { getCitaDetalle, confirmarCita } from '@/lib/citas';
import { getOwnProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/profile', () => ({
  getOwnProfile: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

const mockedGetOwnProfile = getOwnProfile as jest.Mock;
const mockedSupabase = supabase as unknown as {
  from: jest.Mock;
  functions: { invoke: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getCitaDetalle', () => {
  // E.3 Tarea 3b: `bar` se eliminó en E.1 — la consulta seguía pidiéndola
  // (invitaciones → bar → bebidas_catalogo) y fallaba en silencio (`if
  // (error || !data) return null`), así que el panel entero desaparecía del
  // chat. Un mock no puede probar que la consulta REAL funcione (ver Step 4,
  // verificado contra la base) — lo único que un test con supabase mockeado
  // puede afirmar de verdad es la FORMA de la cadena que se le pasa al
  // cliente: que cuelgue bebidas_catalogo directo de invitaciones, y que
  // `bar` no aparezca en ningún lado.
  it('consulta bebidas_catalogo colgando de invitaciones, sin pasar por bar (E.1 la eliminó)', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'amigo' });
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    await getCitaDetalle('c1');

    const consulta = select.mock.calls[0]?.[0] as string;
    expect(consulta).toContain('invitaciones(');
    expect(consulta).toContain('bebidas_catalogo(nombre, valor_v)');
    expect(consulta).not.toContain('bar');
  });

  it('returns null when there is no signed-in profile', async () => {
    mockedGetOwnProfile.mockResolvedValue(null);

    const result = await getCitaDetalle('c1');

    expect(result).toBeNull();
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('marks esAmigo true when the caller is rol amigo, with the joined resumen', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'amigo' });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        estado: 'pendiente',
        zona: null,
        hora: null,
        mensaje: null,
        invitaciones: {
          tiempo_estimado_min: 60,
          bebidas_catalogo: { nombre: 'Pisco Sour', valor_v: 30 },
        },
      },
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getCitaDetalle('c1');

    expect(mockedSupabase.from).toHaveBeenCalledWith('citas');
    expect(eq).toHaveBeenCalledWith('id', 'c1');
    expect(result).toEqual({
      estado: 'pendiente',
      esAmigo: true,
      zona: null,
      hora: null,
      mensaje: null,
      bebidaNombre: 'Pisco Sour',
      valorV: 30,
      tiempoEstimadoMin: 60,
    });
  });

  it('marks esAmigo false when the caller is rol rentador', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'rentador' });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        estado: 'confirmada',
        zona: 'Barranco',
        hora: '2026-07-25T21:30:00-05:00',
        mensaje: 'Nos vemos',
        invitaciones: { tiempo_estimado_min: 45, bebidas_catalogo: { nombre: 'Vino', valor_v: 50 } },
      },
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getCitaDetalle('c1');

    expect(result?.esAmigo).toBe(false);
    expect(result?.estado).toBe('confirmada');
  });

  it('tolerates a missing bebida join (returns nulls, not an error)', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'amigo' });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        estado: 'pendiente',
        zona: null,
        hora: null,
        mensaje: null,
        invitaciones: { tiempo_estimado_min: null, bebidas_catalogo: null },
      },
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getCitaDetalle('c1');

    expect(result?.bebidaNombre).toBeNull();
    expect(result?.valorV).toBeNull();
    expect(result?.tiempoEstimadoMin).toBeNull();
  });

  it('returns null on a query error', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'amigo' });
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getCitaDetalle('c1');

    expect(result).toBeNull();
  });
});

describe('confirmarCita', () => {
  it('invokes the confirmar-cita Edge Function with the form fields', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: { resultado: 'confirmada' },
      error: null,
    });

    const result = await confirmarCita('c1', 'Barranco', '2026-07-25T21:30:00-05:00', 'Nos vemos');

    expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('confirmar-cita', {
      body: { citaId: 'c1', zona: 'Barranco', hora: '2026-07-25T21:30:00-05:00', mensaje: 'Nos vemos' },
    });
    expect(result).toEqual({ resultado: 'confirmada', error: null });
  });

  it('surfaces the Edge Function error message', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'solo el amigo puede confirmar la cita' },
    });

    const result = await confirmarCita('c1', 'Barranco', '2026-07-25T21:30:00-05:00', null);

    expect(result).toEqual({ resultado: null, error: 'solo el amigo puede confirmar la cita' });
  });
});
