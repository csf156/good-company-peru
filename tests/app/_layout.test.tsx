import { render, waitFor } from '@testing-library/react-native';
import RootLayout from '@/app/_layout';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getTosAceptado } from '@/lib/tos';
import { carruselVisto } from '@/lib/carrusel';
import { useFonts } from 'expo-font';

jest.mock('@/hooks/useAuthSession', () => ({
  useAuthSession: jest.fn(),
}));
jest.mock('@/lib/profile', () => ({
  getOwnProfile: jest.fn(),
  isProfileComplete: jest.fn(),
}));
jest.mock('@/lib/tos', () => ({
  getTosAceptado: jest.fn(),
}));
jest.mock('@/lib/carrusel', () => ({
  carruselVisto: jest.fn(),
}));
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Stack: () => null,
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => ['index'],
}));

const mockedUseAuthSession = useAuthSession as jest.Mock;
const mockedUseFonts = useFonts as jest.Mock;
const mockedGetTosAceptado = getTosAceptado as jest.Mock;
const mockedCarruselVisto = carruselVisto as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseFonts.mockReturnValue([true, null]);
  mockedGetTosAceptado.mockResolvedValue(true);
  // Ya visto por defecto: los tests existentes ejercitan el guardián de
  // sesión/perfil, no el del carrusel — sin esto, "carruselPendiente" se
  // demora un tick en resolver y las redirecciones no ocurrirían a tiempo.
  mockedCarruselVisto.mockResolvedValue(true);
});

describe('RootLayout auth guard', () => {
  it('redirects to sign-in when there is no session', async () => {
    mockedUseAuthSession.mockReturnValue({ session: null, loading: false });

    await render(<RootLayout />);

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });

  it('no renderiza el arbol hasta que las fuentes resuelven', async () => {
    mockedUseAuthSession.mockReturnValue({ session: null, loading: false });
    mockedUseFonts.mockReturnValue([false, null]);

    await render(<RootLayout />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renderiza igual si la carga de fuentes falla', async () => {
    mockedUseAuthSession.mockReturnValue({ session: null, loading: false });
    mockedUseFonts.mockReturnValue([false, new Error('font load failed')]);

    await render(<RootLayout />);

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });

  it('manda al carrusel a quien no tiene sesión y no lo ha visto en el dispositivo', async () => {
    mockedUseAuthSession.mockReturnValue({ session: null, loading: false });
    mockedCarruselVisto.mockResolvedValue(false);

    await render(<RootLayout />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/carrusel'));
    expect(mockReplace).not.toHaveBeenCalledWith('/(auth)/sign-in');
  });

  it('manda a sign-in, no al carrusel, cuando ya se vio en el dispositivo', async () => {
    mockedUseAuthSession.mockReturnValue({ session: null, loading: false });
    mockedCarruselVisto.mockResolvedValue(true);

    await render(<RootLayout />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in'));
  });
});
