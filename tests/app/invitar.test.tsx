import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import InvitarScreen from '@/app/invitar/[receptorId]';
import { getOwnProfile, getPublicProfile } from '@/lib/profile';
import { getCatalogo } from '@/lib/tienda';
import { getDesglose, crearPropuesta } from '@/lib/invitaciones';

jest.mock('@/lib/profile', () => ({
  getOwnProfile: jest.fn(),
  getPublicProfile: jest.fn(),
}));
jest.mock('@/lib/tienda', () => ({
  getCatalogo: jest.fn(),
}));
jest.mock('@/lib/invitaciones', () => ({
  getDesglose: jest.fn(),
  crearPropuesta: jest.fn(),
  newIdempotencyKey: jest.fn(() => 'test-key'),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ receptorId: 'rodri-id' }),
  useRouter: () => ({ back: mockBack }),
}));

const mockedGetOwnProfile = getOwnProfile as jest.Mock;
const mockedGetPublicProfile = getPublicProfile as jest.Mock;
const mockedGetCatalogo = getCatalogo as jest.Mock;
const mockedGetDesglose = getDesglose as jest.Mock;
const mockedCrearPropuesta = crearPropuesta as jest.Mock;

const catalogo = [
  { id: 'd1', nombre: 'Pisco Sour', tipo_invitacion: 'divertida', valor_v: 40 },
  { id: 'd2', nombre: 'Vino', tipo_invitacion: 'romantica', valor_v: 80 },
];
const desglose = { valorV: 40, buyerFee: 6, total: 46 };

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetPublicProfile.mockResolvedValue({ id: 'rodri-id', alias: 'Rodri' });
  mockedGetCatalogo.mockResolvedValue(catalogo);
  mockedGetDesglose.mockResolvedValue(desglose);
});

async function llegarAConfirmarComoRentador() {
  mockedGetOwnProfile.mockResolvedValue({ rol: 'rentador' });
  await render(<InvitarScreen />);
  const chip = await screen.findByText(/Pisco Sour/);
  await fireEvent.press(chip);
  await screen.findByText('Rodri');
}

describe('InvitarScreen — rol rentador (tipo invitacion)', () => {
  it('paso 1 lista el catálogo con el importe de cada bebida', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'rentador' });
    await render(<InvitarScreen />);

    expect(await screen.findByText(/Pisco Sour/)).toBeTruthy();
    expect(screen.getByText(/40\.00/)).toBeTruthy();
    expect(screen.getByText(/Vino/)).toBeTruthy();
  });

  it('al elegir una bebida pasa a confirmar y muestra el DESGLOSE COMPLETO antes del botón de enviar', async () => {
    await llegarAConfirmarComoRentador();

    expect(mockedGetDesglose).toHaveBeenCalledWith('d1');
    expect(await screen.findByText(/46\.00/)).toBeTruthy(); // total

    // El total aparece ANTES del botón "Invitar" en el árbol renderizado.
    const tree = JSON.stringify(screen.toJSON());
    const idxTotal = tree.indexOf('46.00');
    const idxBoton = tree.indexOf('Invitar');
    expect(idxTotal).toBeGreaterThan(-1);
    expect(idxBoton).toBeGreaterThan(-1);
    expect(idxTotal).toBeLessThan(idxBoton);
  });

  it('el botón queda deshabilitado mientras la llamada está en vuelo — un doble toque no dispara dos crearPropuesta', async () => {
    let resolver: (v: unknown) => void = () => {};
    mockedCrearPropuesta.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      }),
    );
    await llegarAConfirmarComoRentador();

    const boton = screen.getByText('Invitar');
    // No se espera este primer press: el handler queda pendiente hasta
    // resolver() (mismo patrón que el resto del repo, p.ej. store.tsx antes
    // de E.3 — awaitearlo colgaría el test).
    fireEvent.press(boton);

    // Espera a que React re-renderice con enviando=true antes del segundo
    // toque — dos fireEvent.press sueltos sin nada entre medias abren dos
    // actScope superpuestos en React (lo advierte con "overlapping act()
    // calls") y corrompe su estado interno para el resto del archivo,
    // dejando a los tests SIGUIENTES sin poder renderizar. Esperando acá se
    // evita, y de paso se prueba lo real: el botón queda deshabilitado antes
    // del segundo toque, no solo "no duplica por casualidad".
    const botonEnVuelo = await screen.findByText('Enviando…');
    fireEvent.press(botonEnVuelo); // segundo toque, con el botón ya deshabilitado

    resolver({ ok: true, invitacionId: 'inv-1' });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());

    expect(mockedCrearPropuesta).toHaveBeenCalledTimes(1);
  });

  it('un error del servidor se muestra en pantalla con icono y texto, sin dejar la pantalla en blanco', async () => {
    mockedCrearPropuesta.mockResolvedValue({ ok: false, error: 'emisor no verificado' });
    await llegarAConfirmarComoRentador();

    await fireEvent.press(screen.getByText('Invitar'));

    expect(await screen.findByText('emisor no verificado')).toBeTruthy();
    // La pantalla sigue mostrando el formulario de confirmar, no queda en blanco.
    expect(screen.getByText('Rodri')).toBeTruthy();
    expect(screen.getByText(/46\.00/)).toBeTruthy();
  });

  it('al enviar con éxito llama a crearPropuesta con la idempotencyKey y vuelve', async () => {
    mockedCrearPropuesta.mockResolvedValue({ ok: true, invitacionId: 'inv-1' });
    await llegarAConfirmarComoRentador();

    await fireEvent.press(screen.getByText('Invitar'));

    expect(mockedCrearPropuesta).toHaveBeenCalledWith(
      expect.objectContaining({
        receptorId: 'rodri-id',
        tipo: 'invitacion',
        bebidaCatalogoId: 'd1',
        idempotencyKey: 'test-key',
      }),
    );
  });
});

describe('InvitarScreen — rol amigo (tipo solicitud)', () => {
  it('no pide bebida y salta directo a confirmar', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'amigo' });
    await render(<InvitarScreen />);

    await screen.findByText('Rodri');

    expect(screen.queryByText(/Pisco Sour/)).toBeNull();
    expect(mockedGetDesglose).not.toHaveBeenCalled();
  });

  it('envía la solicitud sin bebidaCatalogoId', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'amigo' });
    mockedCrearPropuesta.mockResolvedValue({ ok: true, invitacionId: 'inv-2' });
    await render(<InvitarScreen />);
    await screen.findByText('Rodri');

    await fireEvent.press(screen.getByText('Solicitar'));

    expect(mockedCrearPropuesta).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'solicitud', bebidaCatalogoId: null }),
    );
  });
});
