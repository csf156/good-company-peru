import { render, screen, fireEvent } from '@testing-library/react-native';
import PropuestasScreen from '@/app/propuestas';
import {
  getPropuestasRecibidas,
  getPropuestasEnviadas,
  responderPropuesta,
  getDesglose,
} from '@/lib/invitaciones';
import { getCatalogo } from '@/lib/tienda';

jest.mock('@/lib/invitaciones', () => ({
  getPropuestasRecibidas: jest.fn(),
  getPropuestasEnviadas: jest.fn(),
  responderPropuesta: jest.fn(),
  getDesglose: jest.fn(),
}));
jest.mock('@/lib/tienda', () => ({
  getCatalogo: jest.fn(),
}));

const mockedGetRecibidas = getPropuestasRecibidas as jest.Mock;
const mockedGetEnviadas = getPropuestasEnviadas as jest.Mock;
const mockedResponder = responderPropuesta as jest.Mock;
const mockedGetDesglose = getDesglose as jest.Mock;
const mockedGetCatalogo = getCatalogo as jest.Mock;

const catalogo = [{ id: 'd1', nombre: 'Pisco Sour', tipo_invitacion: 'divertida', valor_v: 40 }];
const desglose = { valorV: 40, buyerFee: 6, total: 46 };

function invitacionRecibida(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv-1',
    tipo: 'invitacion',
    estado: 'pendiente',
    contraparte: { id: 'rodri-id', alias: 'Rodri', fotoUrl: null },
    bebida: { nombre: 'Pisco Sour', valorV: 40 },
    creadaEn: '2026-09-15T00:00:00Z',
    ...overrides,
  };
}

function solicitudRecibida(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sol-1',
    tipo: 'solicitud',
    estado: 'pendiente',
    contraparte: { id: 'seba-id', alias: 'Seba', fotoUrl: null },
    bebida: null,
    creadaEn: '2026-09-15T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetRecibidas.mockResolvedValue([]);
  mockedGetEnviadas.mockResolvedValue([]);
  mockedGetCatalogo.mockResolvedValue(catalogo);
  mockedGetDesglose.mockResolvedValue(desglose);
});

describe('PropuestasScreen — recibidas', () => {
  it('aceptar una invitación llama a responderPropuesta con aceptar y SIN bebida, sin pedir nada más', async () => {
    mockedGetRecibidas.mockResolvedValue([invitacionRecibida()]);
    mockedResponder.mockResolvedValue({ ok: true, resultado: 'aceptada' });
    await render(<PropuestasScreen />);

    await fireEvent.press(await screen.findByText('Aceptar'));

    expect(mockedResponder).toHaveBeenCalledWith({
      invitacionId: 'inv-1',
      accion: 'aceptar',
      bebidaCatalogoId: null,
    });
    // No debería haberse abierto ningún selector de bebida.
    expect(screen.queryByText(/Pisco Sour — S\//)).toBeNull();
  });

  it('aceptar una solicitud EXIGE elegir bebida y muestra su desglose antes de confirmar — es un cobro real', async () => {
    mockedGetRecibidas.mockResolvedValue([solicitudRecibida()]);
    mockedResponder.mockResolvedValue({ ok: true, resultado: 'aceptada' });
    await render(<PropuestasScreen />);

    await fireEvent.press(await screen.findByText('Aceptar'));

    // Todavía no se llamó al servidor — hace falta elegir bebida primero.
    expect(mockedResponder).not.toHaveBeenCalled();
    const chip = await screen.findByText(/Pisco Sour/);
    await fireEvent.press(chip);

    // El desglose (con comisión) se muestra antes de poder confirmar.
    expect(await screen.findByText(/46\.00/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Confirmar'));

    expect(mockedResponder).toHaveBeenCalledWith({
      invitacionId: 'sol-1',
      accion: 'aceptar',
      bebidaCatalogoId: 'd1',
    });
  });

  it('rechazar no pide bebida', async () => {
    mockedGetRecibidas.mockResolvedValue([invitacionRecibida()]);
    mockedResponder.mockResolvedValue({ ok: true, resultado: 'rechazada' });
    await render(<PropuestasScreen />);

    await fireEvent.press(await screen.findByText('Rechazar'));

    expect(mockedResponder).toHaveBeenCalledWith({
      invitacionId: 'inv-1',
      accion: 'rechazar',
      bebidaCatalogoId: null,
    });
  });

  it('cada estado se muestra con icono y texto, nunca solo color', async () => {
    mockedGetRecibidas.mockResolvedValue([invitacionRecibida({ estado: 'rechazada' })]);
    await render(<PropuestasScreen />);

    expect(await screen.findByText('Rechazada')).toBeTruthy();
    expect(screen.getByTestId('icono-estado-inv-1')).toBeTruthy();
  });
});

describe('PropuestasScreen — enviadas', () => {
  it('preautorizando y pendiente se renderizan con el MISMO texto — protege el hallazgo de privacidad de E.2b (no delatar que a la otra parte le falló la tarjeta)', async () => {
    mockedGetEnviadas.mockResolvedValue([
      invitacionRecibida({ id: 'a', estado: 'pendiente', contraparte: { id: 'x', alias: 'Ana', fotoUrl: null } }),
      invitacionRecibida({ id: 'b', estado: 'preautorizando', contraparte: { id: 'y', alias: 'Bea', fotoUrl: null } }),
    ]);
    await render(<PropuestasScreen />);

    await fireEvent.press(await screen.findByText('Enviadas'));

    const textoA = await screen.findByTestId('estado-texto-a');
    const textoB = await screen.findByTestId('estado-texto-b');
    expect(textoA.children).toEqual(textoB.children);
    // Nunca debe aparecer la palabra "preautorizando" tal cual en pantalla.
    expect(screen.queryByText(/preautorizando/i)).toBeNull();
  });
});
