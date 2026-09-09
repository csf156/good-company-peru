import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import WalletScreen from '@/app/wallet';
import { getBalance } from '@/lib/bar';

jest.mock('@/lib/bar', () => ({
  getBalance: jest.fn(),
}));

const mockedGetBalance = getBalance as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// Suspendido por la Fase E.1 (2026-09-09): `getBalance` (lib/bar.ts) consulta
// la vista `balance`, que E.1 reemplazó por `por_cobrar` (docs/superpowers/
// plans/2026-09-09-fase-e1-esquema-sbs.md) — este mock ya no refleja nada
// real, y "Balance disponible" es justo el vocabulario vetado (vetos 18/19)
// que el rediseño elimina. La pantalla no se reconstruye igual: spec §7 la
// marca "se elimina" (no "se reemplaza" como bar/store) — su reemplazo
// conceptual es la UI de "Por cobrar" del Bloque E.4. No se borra el test
// acá: es la lista de lo que hay que reponer.
describe.skip('WalletScreen', () => {
  it('shows the calculated balance from the ledger', async () => {
    mockedGetBalance.mockResolvedValue(420.5);
    await render(<WalletScreen />);

    expect(await screen.findByText('S/ 420.50')).toBeTruthy();
  });

  it('shows S/ 0.00 while there is no ledger activity yet', async () => {
    mockedGetBalance.mockResolvedValue(0);
    await render(<WalletScreen />);

    expect(await screen.findByText('S/ 0.00')).toBeTruthy();
  });

  it('renders the balance with tabular figures (mobile-first)', async () => {
    mockedGetBalance.mockResolvedValue(420.5);
    await render(<WalletScreen />);

    const bal = await screen.findByText('S/ 420.50');
    const flat = StyleSheet.flatten(bal.props.style);
    expect(flat.fontVariant).toContain('tabular-nums');
  });
});
