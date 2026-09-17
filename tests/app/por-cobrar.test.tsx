import { render, screen, waitFor } from '@testing-library/react-native';
import PorCobrarScreen from '@/app/por-cobrar';
import { getPorCobrar } from '@/lib/por-cobrar';
import { getOwnProfile } from '@/lib/profile';

jest.mock('@/lib/por-cobrar', () => ({
  getPorCobrar: jest.fn(),
}));
jest.mock('@/lib/profile', () => ({
  getOwnProfile: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockedGetPorCobrar = getPorCobrar as jest.Mock;
const mockedGetOwnProfile = getOwnProfile as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Default: rol amigo, la audiencia normal de esta pantalla. Los tests de
  // la guarda de rol lo pisan explícitamente.
  mockedGetOwnProfile.mockResolvedValue({ rol: 'amigo' });
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

  it('con 0, muestra solo el estado vacío — nunca la tarjeta', async () => {
    mockedGetPorCobrar.mockResolvedValue(0);
    await render(<PorCobrarScreen />);

    expect(
      await screen.findByText(
        'Aún no tienes nada por cobrar. Aparecerá aquí cuando completes un encuentro verificado.',
      ),
    ).toBeTruthy();
    // La tarjeta (importe/explicación/destino) es del estado "hay monto > 0";
    // con 0 no debe aparecer, para no decir dos veces lo mismo (Hallazgo 2
    // del review final de Fase E.4).
    expect(screen.queryByText('S/ 0.00')).toBeNull();
    expect(screen.queryByText(/lo que ganaste/i)).toBeNull();
    expect(screen.queryByText(/se deposita automáticamente/i)).toBeNull();
  });

  it('mientras se resuelve el monto, no muestra ni la tarjeta ni el estado vacío', async () => {
    let resolverMonto: (valor: number) => void = () => {};
    mockedGetPorCobrar.mockReturnValue(
      new Promise<number>((resolve) => {
        resolverMonto = resolve;
      }),
    );
    await render(<PorCobrarScreen />);

    // Espera a que la guarda de rol deje pasar y se pida el monto, sin que
    // la promesa se haya resuelto todavía — el momento exacto que el
    // Hallazgo 1 del review final identificó como el flash de "S/ 0.00".
    await waitFor(() => expect(mockedGetPorCobrar).toHaveBeenCalled());

    expect(screen.queryByText(/^S\//)).toBeNull();
    expect(screen.queryByText(/lo que ganaste/i)).toBeNull();
    expect(screen.queryByText(/aún no tienes nada por cobrar/i)).toBeNull();

    resolverMonto(0);

    expect(
      await screen.findByText(
        'Aún no tienes nada por cobrar. Aparecerá aquí cuando completes un encuentro verificado.',
      ),
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

  describe('guarda de rol — "el rentador no tiene vista de dinero agregado, nunca ve Por cobrar"', () => {
    it('un rentador que llega directo a la ruta (deep link) no ve el importe, la explicación ni el destino', async () => {
      mockedGetOwnProfile.mockResolvedValue({ rol: 'rentador' });
      mockedGetPorCobrar.mockResolvedValue(15);
      await render(<PorCobrarScreen />);

      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));

      expect(screen.queryByText('S/ 15.00')).toBeNull();
      expect(screen.queryByText(/lo que ganaste/i)).toBeNull();
      expect(screen.queryByText(/se deposita automáticamente/i)).toBeNull();
      // Defensa en profundidad: para un no-amigo, ni siquiera se pide el monto.
      expect(mockedGetPorCobrar).not.toHaveBeenCalled();
    });

    it('un perfil sin fila (defensivo) tampoco se trata como amigo', async () => {
      mockedGetOwnProfile.mockResolvedValue(null);
      await render(<PorCobrarScreen />);

      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
      expect(screen.queryByText(/lo que ganaste/i)).toBeNull();
    });
  });
});
