import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SignInScreen from '@/app/(auth)/sign-in';
import { requestOtp, signInWithGoogle } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  requestOtp: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockedRequestOtp = requestOtp as jest.Mock;
const mockedSignInWithGoogle = signInWithGoogle as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SignInScreen', () => {
  it('shows a validation error for an invalid email and does not call requestOtp', async () => {
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'no-es-un-correo');
    await fireEvent.press(screen.getByText('Enviar código'));

    expect(await screen.findByText('Correo inválido.')).toBeTruthy();
    expect(mockedRequestOtp).not.toHaveBeenCalled();
  });

  it('sends the OTP and navigates to verify-otp on success', async () => {
    mockedRequestOtp.mockResolvedValue({ error: null });
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ana@example.com');
    await fireEvent.press(screen.getByText('Enviar código'));

    await waitFor(() => {
      expect(mockedRequestOtp).toHaveBeenCalledWith({ type: 'email', value: 'ana@example.com' });
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/verify-otp',
      params: { type: 'email', value: 'ana@example.com' },
    });
  });

  it('shows the provider error message and does not navigate on failure', async () => {
    mockedRequestOtp.mockResolvedValue({ error: 'rate limit exceeded' });
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ana@example.com');
    await fireEvent.press(screen.getByText('Enviar código'));

    expect(await screen.findByText('rate limit exceeded')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('inicia sesión con Google al presionar el botón', async () => {
    mockedSignInWithGoogle.mockResolvedValue({ error: null });
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByText('Continuar con Google'));

    await waitFor(() => {
      expect(mockedSignInWithGoogle).toHaveBeenCalledTimes(1);
    });
  });

  it('muestra el error si el ingreso con Google falla', async () => {
    mockedSignInWithGoogle.mockResolvedValue({ error: 'Ingreso con Google cancelado.' });
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByText('Continuar con Google'));

    expect(await screen.findByText('Ingreso con Google cancelado.')).toBeTruthy();
  });
});
