import {
  getDesglose,
  crearPropuesta,
  responderPropuesta,
  getPropuestasRecibidas,
  getPropuestasEnviadas,
  newIdempotencyKey,
} from '@/lib/invitaciones';
import { supabase } from '@/lib/supabase';
import { getPublicProfile } from '@/lib/profile';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

jest.mock('@/lib/profile', () => ({
  getPublicProfile: jest.fn(),
}));

const mockedSupabase = supabase as unknown as {
  auth: { getUser: jest.Mock };
  from: jest.Mock;
  rpc: jest.Mock;
  functions: { invoke: jest.Mock };
};
const mockedGetPublicProfile = getPublicProfile as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getDesglose', () => {
  it('returns the desglose mapped to camelCase', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { valor_v: 40, buyer_fee: 6, total: 46 },
      error: null,
    });
    mockedSupabase.rpc.mockReturnValue({ maybeSingle });

    const result = await getDesglose('d1');

    expect(mockedSupabase.rpc).toHaveBeenCalledWith('calcular_desglose', { p_bebida_catalogo_id: 'd1' });
    expect(result).toEqual({ valorV: 40, buyerFee: 6, total: 46 });
  });

  it('returns null for an inactive or nonexistent bebida (no rows)', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    mockedSupabase.rpc.mockReturnValue({ maybeSingle });

    const result = await getDesglose('d-inactiva');

    expect(result).toBeNull();
  });

  it('returns null on a server error instead of throwing', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    mockedSupabase.rpc.mockReturnValue({ maybeSingle });

    const result = await getDesglose('d1');

    expect(result).toBeNull();
  });
});

describe('crearPropuesta', () => {
  const body = {
    receptorId: 'r1',
    tipo: 'invitacion' as const,
    bebidaCatalogoId: 'd1',
    tiempoEstimadoMin: 30,
    zonaAproximada: 'Miraflores',
    idempotencyKey: 'key-1',
  };

  it('invokes crear-invitacion with the given fields and returns the invitacionId', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: { invitacion: { id: 'inv-1' } },
      error: null,
    });

    const result = await crearPropuesta(body);

    expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('crear-invitacion', {
      body: {
        receptorId: 'r1',
        tipo: 'invitacion',
        bebidaCatalogoId: 'd1',
        tiempoEstimadoMin: 30,
        zonaAproximada: 'Miraflores',
        idempotencyKey: 'key-1',
      },
    });
    expect(result).toEqual({ ok: true, invitacionId: 'inv-1' });
  });

  it('reintenta con la MISMA idempotencyKey — nunca genera una nueva por su cuenta', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: { invitacion: { id: 'inv-1' } },
      error: null,
    });

    await crearPropuesta(body);
    await crearPropuesta(body); // mismo intento, reintento del usuario

    const keys = mockedSupabase.functions.invoke.mock.calls.map((c) => c[1].body.idempotencyKey);
    expect(keys).toEqual(['key-1', 'key-1']);
  });

  it('devuelve {ok:false} con el mensaje del servidor en vez de lanzar', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'emisor no verificado' },
    });

    const result = await crearPropuesta(body);

    expect(result).toEqual({ ok: false, error: 'emisor no verificado' });
  });
});

describe('responderPropuesta', () => {
  it('invokes responder-invitacion and returns the resultado', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: { resultado: 'aceptada' },
      error: null,
    });

    const result = await responderPropuesta({ invitacionId: 'inv-1', accion: 'aceptar', bebidaCatalogoId: null });

    expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('responder-invitacion', {
      body: { invitacionId: 'inv-1', accion: 'aceptar', bebidaCatalogoId: null },
    });
    expect(result).toEqual({ ok: true, resultado: 'aceptada' });
  });

  it('devuelve {ok:false} con el mensaje del servidor en vez de lanzar', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'la invitación no tiene un hold preautorizado' },
    });

    const result = await responderPropuesta({ invitacionId: 'inv-1', accion: 'aceptar', bebidaCatalogoId: null });

    expect(result).toEqual({ ok: false, error: 'la invitación no tiene un hold preautorizado' });
  });
});

describe('getPropuestasRecibidas', () => {
  it('returns [] when there is no signed-in user', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const result = await getPropuestasRecibidas();

    expect(result).toEqual([]);
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('maps rows to Propuesta, resolving la contraparte (el emisor)', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'yo' } } });
    mockedGetPublicProfile.mockResolvedValue({ alias: 'Rodri', foto_url: 'rodri.jpg' });
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          tipo: 'invitacion',
          estado: 'pendiente',
          created_at: '2026-09-15T00:00:00Z',
          emisor_id: 'rodri-id',
          bebidas_catalogo: { nombre: 'Pisco Sour', valor_v: 40 },
        },
      ],
      error: null,
    });
    const neq = jest.fn().mockReturnValue({ order });
    const eq = jest.fn().mockReturnValue({ neq });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getPropuestasRecibidas();

    expect(mockedSupabase.from).toHaveBeenCalledWith('invitaciones');
    expect(eq).toHaveBeenCalledWith('receptor_id', 'yo');
    expect(mockedGetPublicProfile).toHaveBeenCalledWith('rodri-id');
    expect(result).toEqual([
      {
        id: 'inv-1',
        tipo: 'invitacion',
        estado: 'pendiente',
        contraparte: { id: 'rodri-id', alias: 'Rodri', fotoUrl: 'rodri.jpg' },
        bebida: { nombre: 'Pisco Sour', valorV: 40 },
        creadaEn: '2026-09-15T00:00:00Z',
      },
    ]);
  });

  it('nunca trae una fila en preautorizando — la RLS ya las oculta al receptor, pero es contrato de la UI', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'yo' } } });
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const neq = jest.fn().mockReturnValue({ order });
    const eq = jest.fn().mockReturnValue({ neq });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    await getPropuestasRecibidas();

    expect(neq).toHaveBeenCalledWith('estado', 'preautorizando');
  });
});

describe('getPropuestasEnviadas', () => {
  it('maps rows to Propuesta, resolving la contraparte (el receptor), sin filtrar por estado', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'yo' } } });
    mockedGetPublicProfile.mockResolvedValue({ alias: 'Vale', foto_url: null });
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'inv-2',
          tipo: 'invitacion',
          estado: 'preautorizando',
          created_at: '2026-09-15T00:00:00Z',
          receptor_id: 'vale-id',
          bebidas_catalogo: { nombre: 'Chicha Morada', valor_v: 20 },
        },
      ],
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getPropuestasEnviadas();

    expect(eq).toHaveBeenCalledWith('emisor_id', 'yo');
    expect(mockedGetPublicProfile).toHaveBeenCalledWith('vale-id');
    // El emisor SÍ ve preautorizando (RLS: siempre ve su propia fila) — esta
    // función no filtra por estado, a diferencia de la de recibidas.
    expect(result[0]?.estado).toBe('preautorizando');
  });
});

describe('newIdempotencyKey', () => {
  it('generates a non-empty unique-ish key on each call', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
