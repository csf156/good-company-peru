import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import VerifyOtpScreen from '@/app/(auth)/verify-otp';
import { verifyOtp, requestOtp } from '@/lib/auth';
import { getOwnProfile } from '@/lib/profile';

jest.mock('@/lib/auth', () => ({
  verifyOtp: jest.fn(),
  requestOtp: jest.fn(),
}));
jest.mock('@/lib/profile', () => ({
  getOwnProfile: jest.fn(),
  isProfileComplete: jest.requireActual('@/lib/profile-complete').isProfileComplete,
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ type: 'email', value: 'ana@example.com' }),
}));

const mockedVerifyOtp = verifyOtp as jest.Mock;
const mockedRequestOtp = requestOtp as jest.Mock;
const mockedGetOwnProfile = getOwnProfile as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('VerifyOtpScreen', () => {
  const completeProfile = {
    rol: 'amigo',
    nombre: 'Ana',
    alias: 'Ani',
    fecha_nacimiento: '2000-01-01',
    genero: 'femenino',
    profesion: 'Diseñadora',
    foto_url: 'user-1/foto.jpg',
    kyc_estado: 'verificado',
  };

  it('verifies the code and goes home when the profile is complete and KYC verified', async () => {
    mockedVerifyOtp.mockResolvedValue({ error: null });
    mockedGetOwnProfile.mockResolvedValue(completeProfile);
    await render(<VerifyOtpScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('000000'), '123456');
    await fireEvent.press(screen.getByText('Verificar'));

    await waitFor(() => {
      expect(mockedVerifyOtp).toHaveBeenCalledWith(
        { type: 'email', value: 'ana@example.com' },
        '123456',
      );
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('sends new users to role selection when no profile exists yet', async () => {
    mockedVerifyOtp.mockResolvedValue({ error: null });
    mockedGetOwnProfile.mockResolvedValue(null);
    await render(<VerifyOtpScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('000000'), '123456');
    await fireEvent.press(screen.getByText('Verificar'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/select-role');
    });
  });

  it('sends users with an incomplete profile to profile-setup', async () => {
    mockedVerifyOtp.mockResolvedValue({ error: null });
    mockedGetOwnProfile.mockResolvedValue({ ...completeProfile, nombre: null });
    await render(<VerifyOtpScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('000000'), '123456');
    await fireEvent.press(screen.getByText('Verificar'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/profile-setup');
    });
  });

  it('sends users with a complete profile but unverified KYC to the kyc screen', async () => {
    mockedVerifyOtp.mockResolvedValue({ error: null });
    mockedGetOwnProfile.mockResolvedValue({ ...completeProfile, kyc_estado: 'pendiente' });
    await render(<VerifyOtpScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('000000'), '123456');
    await fireEvent.press(screen.getByText('Verificar'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/kyc');
    });
  });

  it('shows an error for an invalid or expired code and does not navigate', async () => {
    mockedVerifyOtp.mockResolvedValue({ error: 'Token has expired or is invalid' });
    await render(<VerifyOtpScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('000000'), '000000');
    await fireEvent.press(screen.getByText('Verificar'));

    expect(await screen.findByText('Token has expired or is invalid')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('disables resend during the cooldown and re-enables it after it elapses', async () => {
    mockedRequestOtp.mockResolvedValue({ error: null });
    await render(<VerifyOtpScreen />);

    expect(
      screen.getByRole('button', { name: 'Reenviar código' }).props.accessibilityState?.disabled,
    ).toBe(false);

    await act(async () => {
      await fireEvent.press(screen.getByText('Reenviar código'));
    });

    expect(mockedRequestOtp).toHaveBeenCalledWith({ type: 'email', value: 'ana@example.com' });
    expect(await screen.findByText(/Reenviar en 30s/)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(await screen.findByText('Reenviar código')).toBeTruthy();
  });
});
