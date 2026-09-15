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
  await fireEvent.press(await screen.findByText('Siguiente'));
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

  it('elegir una bebida NO navega sola — "Siguiente" queda deshabilitado hasta elegir, y se puede cambiar de opción antes de avanzar', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'rentador' });
    await render(<InvitarScreen />);
    await screen.findByText(/Pisco Sour/);

    // Sin bebida elegida, "Siguiente" está deshabilitado — tocarlo no hace nada.
    await fireEvent.press(screen.getByText('Siguiente'));
    expect(mockedGetDesglose).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText(/Pisco Sour/));
    // Elegir sola no navega: sigue en paso 1, sin desglose ni "Confirmar".
    expect(mockedGetDesglose).not.toHaveBeenCalled();
    expect(screen.queryByText('Rodri')).toBeNull();

    // Cambia de opción antes de avanzar — es exactamente el caso de "estoy indeciso".
    // findByText (no getByText) entre los dos toques: le da tiempo al cambio de
    // selección a confirmarse en el estado antes de que "Siguiente" lo lea.
    await fireEvent.press(screen.getByText(/Vino/));
    await fireEvent.press(await screen.findByText('Siguiente'));

    expect(mockedGetDesglose).toHaveBeenCalledWith('d2');
    expect(mockedGetDesglose).not.toHaveBeenCalledWith('d1');
    await screen.findByText('Rodri');
  });

  it('al tocar Siguiente pasa a confirmar y muestra el DESGLOSE COMPLETO antes del botón de enviar', async () => {
    await llegarAConfirmarComoRentador();

    expect(mockedGetDesglose).toHaveBeenCalledWith('d1');
    expect((await screen.findAllByText(/46\.00/)).length).toBeGreaterThan(0); // total (y lo repite el aviso de retención)

    // El total aparece ANTES del botón de confirmar en el árbol renderizado.
    const tree = JSON.stringify(screen.toJSON());
    const idxTotal = tree.indexOf('46.00');
    const idxBoton = tree.indexOf('Retener e invitar');
    expect(idxTotal).toBeGreaterThan(-1);
    expect(idxBoton).toBeGreaterThan(-1);
    expect(idxTotal).toBeLessThan(idxBoton);
  });

  it('explica la retención antes del botón: se retiene, se cobra solo si acepta, se libera si no — sin jerga ni "saldo"/"billetera"/"monedero"', async () => {
    await llegarAConfirmarComoRentador();

    const aviso = await screen.findByText(/Se retiene/);
    const texto = [aviso.props.children].flat().join('');
    expect(texto).toMatch(/Se retiene S\/ 46\.00/);
    expect(texto).toMatch(/Rodri acepta/);
    expect(texto).toMatch(/se libera/i);

    const tree = JSON.stringify(screen.toJSON());
    expect(tree).not.toMatch(/saldo|billetera|monedero|wallet/i);
  });

  it('el botón queda deshabilitado mientras la llamada está en vuelo — un doble toque no dispara dos crearPropuesta', async () => {
    let resolver: (v: unknown) => void = () => {};
    mockedCrearPropuesta.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      }),
    );
    await llegarAConfirmarComoRentador();

    const boton = screen.getByText('Retener e invitar');
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
    const botonEnVuelo = await screen.findByText('Reteniendo…');
    fireEvent.press(botonEnVuelo); // segundo toque, con el botón ya deshabilitado

    resolver({ ok: true, invitacionId: 'inv-1' });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());

    expect(mockedCrearPropuesta).toHaveBeenCalledTimes(1);
  });

  it('un error del servidor se muestra en pantalla con icono y texto, sin dejar la pantalla en blanco', async () => {
    mockedCrearPropuesta.mockResolvedValue({ ok: false, error: 'emisor no verificado' });
    await llegarAConfirmarComoRentador();

    await fireEvent.press(screen.getByText('Retener e invitar'));

    expect(await screen.findByText('emisor no verificado')).toBeTruthy();
    // La pantalla sigue mostrando el formulario de confirmar, no queda en blanco.
    expect(screen.getByText('Rodri')).toBeTruthy();
    expect(screen.getAllByText(/46\.00/).length).toBeGreaterThan(0);
  });

  it('al enviar con éxito llama a crearPropuesta con la idempotencyKey y vuelve', async () => {
    mockedCrearPropuesta.mockResolvedValue({ ok: true, invitacionId: 'inv-1' });
    await llegarAConfirmarComoRentador();

    await fireEvent.press(screen.getByText('Retener e invitar'));

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
