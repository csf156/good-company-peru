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
