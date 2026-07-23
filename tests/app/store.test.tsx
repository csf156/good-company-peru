import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import StoreScreen from '@/app/store';
import { getCatalogo, comprarBebida } from '@/lib/tienda';

jest.mock('@/lib/tienda', () => ({
  getCatalogo: jest.fn(),
  comprarBebida: jest.fn(),
}));

const mockedGetCatalogo = getCatalogo as jest.Mock;
const mockedComprarBebida = comprarBebida as jest.Mock;

const catalogo = [
  { id: 'd1', nombre: 'Cerveza', tipo_invitacion: 'divertida', valor_v: 40 },
  { id: 'd2', nombre: 'Vino', tipo_invitacion: 'romantica', valor_v: 80 },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetCatalogo.mockResolvedValue(catalogo);
});

function firstComprarButton() {
  const [button] = screen.getAllByText('Comprar');
  if (!button) throw new Error('No se encontró ningún botón Comprar.');
  return button;
}

describe('StoreScreen', () => {
  it('lists the active catalog with name and value', async () => {
    await render(<StoreScreen />);

    expect(await screen.findByText('Cerveza')).toBeTruthy();
    expect(screen.getByText('Vino')).toBeTruthy();
    expect(screen.getByText('S/ 40.00')).toBeTruthy();
    expect(screen.getByText('S/ 80.00')).toBeTruthy();
  });

  it('shows an empty state when the catalog has no active bebidas', async () => {
    mockedGetCatalogo.mockResolvedValue([]);
    await render(<StoreScreen />);

    expect(await screen.findByText(/no hay bebidas disponibles/i)).toBeTruthy();
  });

  it('filters the list by tipo_invitacion', async () => {
    await render(<StoreScreen />);
    await screen.findByText('Cerveza');

    await fireEvent.press(screen.getByText('Románticas'));

    expect(screen.queryByText('Cerveza')).toBeNull();
    expect(screen.getByText('Vino')).toBeTruthy();
  });

  it('buys a bebida and shows the server-computed breakdown (never client-calculated)', async () => {
    mockedComprarBebida.mockResolvedValue({
      estado: 'confirmada',
      desglose: { valorV: 40, buyerFee: 6, total: 46 },
      error: null,
    });
    await render(<StoreScreen />);
    await screen.findByText('Cerveza');

    await fireEvent.press(firstComprarButton());

    expect(mockedComprarBebida).toHaveBeenCalledWith('d1');
    expect(await screen.findByText(/agregada a tu bar/i)).toBeTruthy();
    expect(screen.getByText(/S\/ 46\.00/)).toBeTruthy();
  });

  it('shows a loading state while the purchase is in flight', async () => {
    let resolvePurchase: (value: unknown) => void = () => {};
    mockedComprarBebida.mockReturnValue(
      new Promise((resolve) => {
        resolvePurchase = resolve;
      }),
    );
    await render(<StoreScreen />);
    await screen.findByText('Cerveza');

    // No se espera esta press: el handler queda pendiente hasta resolvePurchase
    // (awaitear fireEvent.press aquí colgaría el test — RNTL v14 espera a que
    // el handler async termine antes de resolver).
    fireEvent.press(firstComprarButton());

    expect(await screen.findByText('Comprando…')).toBeTruthy();

    resolvePurchase({ estado: 'confirmada', desglose: { valorV: 40, buyerFee: 6, total: 46 }, error: null });
    await waitFor(() => expect(screen.queryByText('Comprando…')).toBeNull());
  });

  it('shows a server error and does not claim success (e.g. KYC no verificado)', async () => {
    mockedComprarBebida.mockResolvedValue({
      estado: null,
      desglose: null,
      error: 'Debes verificar tu identidad (KYC) antes de comprar.',
    });
    await render(<StoreScreen />);
    await screen.findByText('Cerveza');

    await fireEvent.press(firstComprarButton());

    expect(await screen.findByText('Debes verificar tu identidad (KYC) antes de comprar.')).toBeTruthy();
    expect(screen.queryByText(/agregada a tu bar/i)).toBeNull();
  });
});
