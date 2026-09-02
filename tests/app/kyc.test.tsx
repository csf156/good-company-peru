import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import KycScreen from '@/app/(auth)/kyc';
import { uploadDniDocument } from '@/lib/storage';
import { startKycVerification } from '@/lib/kyc';
import { ProfileRefreshContext } from '@/lib/profile-context';
import * as ImagePicker from 'expo-image-picker';

jest.mock('@/lib/storage', () => ({
  uploadDniDocument: jest.fn(),
}));
jest.mock('@/lib/kyc', () => ({
  startKycVerification: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockedUploadDni = uploadDniDocument as jest.Mock;
const mockedStartKyc = startKycVerification as jest.Mock;
const mockedRequestPermission = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const mockedLaunchCamera = ImagePicker.launchCameraAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedRequestPermission.mockResolvedValue({ granted: true });
});

async function captureDniAndSelfie() {
  mockedLaunchCamera.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///dni.jpg' }],
  });
  mockedUploadDni.mockResolvedValueOnce({ path: 'user-1/dni.jpg', error: null });
  await fireEvent.press(screen.getByText('Escanear DNI'));
  await screen.findByText('DNI listo ✓');

  mockedLaunchCamera.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///selfie.jpg' }],
  });
  mockedUploadDni.mockResolvedValueOnce({ path: 'user-1/selfie.jpg', error: null });
  await fireEvent.press(screen.getByText('Tomar selfie'));
  await screen.findByText('Selfie lista ✓');
}

describe('KycScreen', () => {
  it('disables the verify button until both DNI and selfie are captured', async () => {
    await render(<KycScreen />);

    expect(
      screen.getByRole('button', { name: 'Verificar identidad' }).props.accessibilityState
        ?.disabled,
    ).toBe(true);
  });

  it('captures DNI and selfie via the camera and uploads them', async () => {
    await render(<KycScreen />);

    await captureDniAndSelfie();

    expect(mockedUploadDni).toHaveBeenCalledWith('dni', 'file:///dni.jpg');
    expect(mockedUploadDni).toHaveBeenCalledWith('selfie', 'file:///selfie.jpg');
    expect(
      screen.getByRole('button', { name: 'Verificar identidad' }).props.accessibilityState
        ?.disabled,
    ).toBe(false);
  });

  it('starts verification and navigates home when approved (demo mode)', async () => {
    mockedStartKyc.mockResolvedValue({ estado: 'verificado', error: null });
    await render(<KycScreen />);
    await captureDniAndSelfie();

    await fireEvent.press(screen.getByText('Verificar identidad'));

    await waitFor(() => {
      expect(mockedStartKyc).toHaveBeenCalledWith('user-1/dni.jpg', 'user-1/selfie.jpg');
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('shows a pending message and does not navigate when verification is pending (real Truora)', async () => {
    mockedStartKyc.mockResolvedValue({ estado: 'pendiente', error: null });
    await render(<KycScreen />);
    await captureDniAndSelfie();

    await fireEvent.press(screen.getByText('Verificar identidad'));

    expect(await screen.findByText(/en revisión/i)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows an error and does not navigate if verification fails', async () => {
    mockedStartKyc.mockResolvedValue({ estado: null, error: 'Rutas inválidas.' });
    await render(<KycScreen />);
    await captureDniAndSelfie();

    await fireEvent.press(screen.getByText('Verificar identidad'));

    expect(await screen.findByText('Rutas inválidas.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('tras verificar con éxito, vuelve a leer el perfil (mismo bug que el alta: kyc_estado cambia en la base pero el layout se queda con el valor viejo)', async () => {
    mockedStartKyc.mockResolvedValue({ estado: 'verificado', error: null });
    const refreshProfile = jest.fn();
    await render(
      <ProfileRefreshContext.Provider value={refreshProfile}>
        <KycScreen />
      </ProfileRefreshContext.Provider>,
    );
    await captureDniAndSelfie();

    await fireEvent.press(screen.getByText('Verificar identidad'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
    expect(refreshProfile).toHaveBeenCalledTimes(1);
  });

  it('no vuelve a leer el perfil si la verificación queda pendiente', async () => {
    mockedStartKyc.mockResolvedValue({ estado: 'pendiente', error: null });
    const refreshProfile = jest.fn();
    await render(
      <ProfileRefreshContext.Provider value={refreshProfile}>
        <KycScreen />
      </ProfileRefreshContext.Provider>,
    );
    await captureDniAndSelfie();

    await fireEvent.press(screen.getByText('Verificar identidad'));

    await screen.findByText(/en revisión/i);
    expect(refreshProfile).not.toHaveBeenCalled();
  });

  it('espera a que termine de releer el perfil antes de navegar (si no, _layout redirige con el estado viejo)', async () => {
    mockedStartKyc.mockResolvedValue({ estado: 'verificado', error: null });
    let resolveRefresh: () => void = () => {};
    const refreshProfile = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    await render(
      <ProfileRefreshContext.Provider value={refreshProfile}>
        <KycScreen />
      </ProfileRefreshContext.Provider>,
    );
    await captureDniAndSelfie();

    // Sin `await` a propósito: `handleVerify` queda suspendido en
    // `await refreshProfile()` hasta que el test resuelva esa promesa más
    // abajo — esperar `fireEvent.press` se quedaría trabado para siempre.
    // La consola puede mostrar un warning de `act(...)` benigno para el
    // `setLoading(false)` que corre antes del await largo — no es un fallo.
    fireEvent.press(screen.getByText('Verificar identidad'));

    await waitFor(() => {
      expect(refreshProfile).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).not.toHaveBeenCalled();

    resolveRefresh();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('navega igual si releer el perfil falla (no deja al usuario atrapado)', async () => {
    mockedStartKyc.mockResolvedValue({ estado: 'verificado', error: null });
    const refreshProfile = jest.fn().mockRejectedValue(new Error('sin red'));
    await render(
      <ProfileRefreshContext.Provider value={refreshProfile}>
        <KycScreen />
      </ProfileRefreshContext.Provider>,
    );
    await captureDniAndSelfie();

    await fireEvent.press(screen.getByText('Verificar identidad'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });
});
