import { render } from '@testing-library/react-native';
import RootLayout from '@/app/_layout';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getTosAceptado } from '@/lib/tos';
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

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseFonts.mockReturnValue([true, null]);
  mockedGetTosAceptado.mockResolvedValue(true);
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
});
