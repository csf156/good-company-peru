import { render, screen } from '@testing-library/react-native';
import PorCobrarScreen from '@/app/por-cobrar';
import { getPorCobrar } from '@/lib/por-cobrar';

jest.mock('@/lib/por-cobrar', () => ({
  getPorCobrar: jest.fn(),
}));

const mockedGetPorCobrar = getPorCobrar as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PorCobrarScreen', () => {
  it('muestra el importe en soles con dos decimales', async () => {
    mockedGetPorCobrar.mockResolvedValue(15);
    await render(<PorCobrarScreen />);

    expect(await screen.findByText('S/ 15.00')).toBeTruthy();
  });

  it('con un importe mayor a 0, no muestra el estado vacío', async () => {
    mockedGetPorCobrar.mockResolvedValue(15);
    await render(<PorCobrarScreen />);

    await screen.findByText('S/ 15.00');
    expect(screen.queryByText(/aún no tienes nada por cobrar/i)).toBeNull();
  });

  it('con 0, muestra el estado vacío', async () => {
    mockedGetPorCobrar.mockResolvedValue(0);
    await render(<PorCobrarScreen />);

    expect(await screen.findByText('S/ 0.00')).toBeTruthy();
    expect(
      screen.getByText('Aún no tienes nada por cobrar. Aparecerá aquí cuando completes un encuentro verificado.'),
    ).toBeTruthy();
  });

  it('no tiene ningún elemento pulsable que actúe sobre el importe (sin "retirar" ni "usar")', async () => {
    mockedGetPorCobrar.mockResolvedValue(15);
    await render(<PorCobrarScreen />);

    await screen.findByText('S/ 15.00');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(/retirar/i)).toBeNull();
    expect(screen.queryByText(/usar/i)).toBeNull();
  });
});
