import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import StoreScreen from '@/app/store';
import { getCatalogo, comprarBebida } from '@/lib/tienda';

jest.mock('@/lib/tienda', () => {
  let n = 0;
  return {
    getCatalogo: jest.fn(),
    comprarBebida: jest.fn(),
    newIdempotencyKey: jest.fn(() => `key-${++n}`),
  };
});

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

  it('gives the buy button an accessible ≥44dp touch target (mobile-first)', async () => {
    await render(<StoreScreen />);
    await screen.findByText('Cerveza');

    const btn = screen.getByLabelText('Comprar Cerveza');
    const flat = StyleSheet.flatten(btn.props.style);
    expect(flat.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('shows the price with tabular figures so amounts do not shift width', async () => {
    await render(<StoreScreen />);
    const price = await screen.findByText('S/ 40.00');
    const flat = StyleSheet.flatten(price.props.style);
    expect(flat.fontVariant).toContain('tabular-nums');
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

    expect(mockedComprarBebida).toHaveBeenCalledWith('d1', expect.any(String));
    expect(await screen.findByText(/agregada a tu bar/i)).toBeTruthy();
    expect(screen.getByText(/S\/ 46\.00/)).toBeTruthy();
  });

  it('reuses the same idempotency key when retrying a failed purchase, and mints a new one after success', async () => {
    // 1) primer intento falla → 2) reintento del MISMO intento reusa la key
    mockedComprarBebida
      .mockResolvedValueOnce({ estado: null, desglose: null, error: 'Error temporal.' })
      .mockResolvedValue({ estado: 'confirmada', desglose: { valorV: 40, buyerFee: 6, total: 46 }, error: null });
    await render(<StoreScreen />);
    await screen.findByText('Cerveza');

    await fireEvent.press(firstComprarButton());
    await screen.findByText('Error temporal.');
    await fireEvent.press(firstComprarButton());
    await screen.findByText(/agregada a tu bar/i);

    const keyIntento1 = mockedComprarBebida.mock.calls[0][1];
    const keyIntento2 = mockedComprarBebida.mock.calls[1][1];
    expect(keyIntento2).toBe(keyIntento1); // reintento reusa → no crea 2ª orden

    // 3) nueva compra de la misma bebida (tras éxito) usa una key distinta
    await fireEvent.press(firstComprarButton());
    await waitFor(() => expect(mockedComprarBebida).toHaveBeenCalledTimes(3));
    const keyCompra2 = mockedComprarBebida.mock.calls[2][1];
    expect(keyCompra2).not.toBe(keyIntento1);
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
