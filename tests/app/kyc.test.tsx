import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import KycScreen from '@/app/(auth)/kyc';
import { uploadDniDocument } from '@/lib/storage';
import { startKycVerification } from '@/lib/kyc';
import { registrarPasoKyc, registrarKycCompletado } from '@/lib/onboarding-analytics';
import { ProfileRefreshContext } from '@/lib/profile-context';

jest.mock('@/lib/storage', () => ({
  uploadDniDocument: jest.fn(),
}));
jest.mock('@/lib/kyc', () => ({
  startKycVerification: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  CameraType: { back: 'back', front: 'front' },
}));
jest.mock('@/lib/onboarding-analytics', () => ({
  registrarPasoKyc: jest.fn(),
  registrarKycCompletado: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockedUploadDni = uploadDniDocument as jest.Mock;
const mockedStartKyc = startKycVerification as jest.Mock;
const ImagePicker = jest.requireMock('expo-image-picker') as {
  requestCameraPermissionsAsync: jest.Mock;
  launchCameraAsync: jest.Mock;
};
const mockedRequestPermission = ImagePicker.requestCameraPermissionsAsync;
const mockedLaunchCamera = ImagePicker.launchCameraAsync;

beforeEach(() => {
  jest.clearAllMocks();
  mockedRequestPermission.mockResolvedValue({ granted: true });
});

async function avanzarHastaSelfie() {
  await fireEvent.press(screen.getByText('Empezar'));

  mockedLaunchCamera.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///dni.jpg' }],
  });
  mockedUploadDni.mockResolvedValueOnce({ path: 'user-1/dni.jpg', error: null });
  await fireEvent.press(screen.getByText('Tomar foto del DNI'));
  await screen.findByText('DNI listo');

  await fireEvent.press(screen.getByText('Continuar'));
}

describe('paso 1-3: intro, DNI, selfie', () => {
  it('arranca en el paso 1 de 4, explicando qué se va a pedir', async () => {
    await render(<KycScreen />);

    expect(screen.getByText('Paso 1 de 4')).toBeTruthy();
    expect(screen.getByText('Verifica tu identidad')).toBeTruthy();
  });

  it('la pantalla de DNI pide la cámara trasera', async () => {
    await render(<KycScreen />);
    await fireEvent.press(screen.getByText('Empezar'));

    mockedLaunchCamera.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///dni.jpg' }],
    });
    mockedUploadDni.mockResolvedValueOnce({ path: 'user-1/dni.jpg', error: null });

    await fireEvent.press(screen.getByText('Tomar foto del DNI'));

    expect(mockedLaunchCamera).toHaveBeenCalledWith(
      expect.objectContaining({ cameraType: 'back' }),
    );
    expect(mockedUploadDni).toHaveBeenCalledWith('dni', 'file:///dni.jpg');
  });

  it('la pantalla de selfie pide la cámara frontal', async () => {
    await render(<KycScreen />);
    await avanzarHastaSelfie();

    mockedLaunchCamera.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///selfie.jpg' }],
    });
    mockedUploadDni.mockResolvedValueOnce({ path: 'user-1/selfie.jpg', error: null });

    await fireEvent.press(screen.getByText('Tomar selfie'));

    expect(mockedLaunchCamera).toHaveBeenCalledWith(
      expect.objectContaining({ cameraType: 'front' }),
    );
    expect(mockedUploadDni).toHaveBeenCalledWith('selfie', 'file:///selfie.jpg');
  });

  it('no deja avanzar del paso de DNI sin haberlo capturado, y dice por qué', async () => {
    await render(<KycScreen />);
    await fireEvent.press(screen.getByText('Empezar'));

    expect(screen.getByText(/Toma la foto de tu DNI para continuar/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Continuar' }).props.accessibilityState?.disabled,
    ).toBe(true);
  });

  it('retroceder y volver a avanzar conserva lo capturado', async () => {
    await render(<KycScreen />);
    await avanzarHastaSelfie();

    await fireEvent.press(screen.getByLabelText('Volver'));
    expect(screen.getByText('Paso 2 de 4')).toBeTruthy();
    expect(screen.getByText('DNI listo')).toBeTruthy();

    await fireEvent.press(screen.getByText('Continuar'));
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
    expect(mockedUploadDni).toHaveBeenCalledTimes(1);
  });

  it('muestra el motivo si la cámara no da permiso, y no avanza', async () => {
    mockedRequestPermission.mockResolvedValueOnce({ granted: false });
    await render(<KycScreen />);
    await fireEvent.press(screen.getByText('Empezar'));

    await fireEvent.press(screen.getByText('Tomar foto del DNI'));

    expect(await screen.findByText(/Necesitamos acceso a tu cámara/i)).toBeTruthy();
    expect(screen.getByText('Paso 2 de 4')).toBeTruthy();
  });

  it('muestra el motivo si la subida falla y deja reintentar', async () => {
    await render(<KycScreen />);
    await fireEvent.press(screen.getByText('Empezar'));

    mockedLaunchCamera.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///dni.jpg' }],
    });
    mockedUploadDni.mockResolvedValueOnce({ path: null, error: 'No se pudo subir la imagen.' });

    await fireEvent.press(screen.getByText('Tomar foto del DNI'));

    expect(await screen.findByText('No se pudo subir la imagen.')).toBeTruthy();
    expect(screen.getByText('Tomar foto del DNI')).toBeTruthy();
  });

  it('registra cada paso de KYC en la analítica', async () => {
    await render(<KycScreen />);
    expect(registrarPasoKyc).toHaveBeenCalledWith(1);

    await fireEvent.press(screen.getByText('Empezar'));
    expect(registrarPasoKyc).toHaveBeenCalledWith(2);
  });
});

describe('paso 4: resultado con verificación automática', () => {
  async function avanzarHastaResultado() {
    await avanzarHastaSelfie();

    mockedLaunchCamera.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///selfie.jpg' }],
    });
    mockedUploadDni.mockResolvedValueOnce({ path: 'user-1/selfie.jpg', error: null });
    await fireEvent.press(screen.getByText('Tomar selfie'));
    await screen.findByText('Selfie lista');

    await fireEvent.press(screen.getByText('Continuar'));
  }

  it('verifica automáticamente al llegar al paso 4, sin botón de por medio', async () => {
    mockedStartKyc.mockResolvedValue({ estado: 'verificado', error: null });
    await render(<KycScreen />);
    await avanzarHastaResultado();

    await waitFor(() => {
      expect(mockedStartKyc).toHaveBeenCalledWith('user-1/dni.jpg', 'user-1/selfie.jpg');
    });
    expect(mockedStartKyc).toHaveBeenCalledTimes(1);
  });

  it('en modo demo muestra el resultado verificado con icono y texto', async () => {
    mockedStartKyc.mockResolvedValue({ estado: 'verificado', error: null });
    await render(<KycScreen />);
    await avanzarHastaResultado();

    expect(await screen.findByText('Identidad verificada')).toBeTruthy();
    expect(registrarKycCompletado).toHaveBeenCalledTimes(1);
  });

  it('espera a que termine de releer el perfil antes de navegar', async () => {
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
    await avanzarHastaResultado();

    await waitFor(() => expect(refreshProfile).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByText('Ir al inicio'));
    expect(mockReplace).not.toHaveBeenCalled();

    // `resolveRefresh()` solo agenda la continuación de `await refreshProfile()`
    // como microtask — `act(async ...)` drena esa cola antes de seguir, para
    // que `setRefrescado(true)` corra y re-renderice ANTES del segundo press
    // (si no, ese press dispara con el closure viejo, `refrescado` todavía
    // `false`).
    await act(async () => {
      resolveRefresh();
    });
    await fireEvent.press(screen.getByText('Ir al inicio'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('navega igual si releer el perfil falla (no deja al usuario atrapado)', async () => {
    mockedStartKyc.mockResolvedValue({ estado: 'verificado', error: null });
    const refreshProfile = jest.fn().mockRejectedValue(new Error('sin red'));
    await render(
      <ProfileRefreshContext.Provider value={refreshProfile}>
        <KycScreen />
      </ProfileRefreshContext.Provider>,
    );
    await avanzarHastaResultado();

    await screen.findByText('Identidad verificada');
    await fireEvent.press(screen.getByText('Ir al inicio'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('con Truora real muestra "en revisión", no navega y no relee el perfil', async () => {
    mockedStartKyc.mockResolvedValue({ estado: 'pendiente', error: null });
    const refreshProfile = jest.fn();
    await render(
      <ProfileRefreshContext.Provider value={refreshProfile}>
        <KycScreen />
      </ProfileRefreshContext.Provider>,
    );
    await avanzarHastaResultado();

    expect(await screen.findByText(/en revisión/i)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(refreshProfile).not.toHaveBeenCalled();
  });

  it('si la verificación falla, muestra el motivo y deja reintentar', async () => {
    mockedStartKyc.mockResolvedValueOnce({ estado: null, error: 'Rutas inválidas.' });
    await render(<KycScreen />);
    await avanzarHastaResultado();

    expect(await screen.findByText('Rutas inválidas.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();

    mockedStartKyc.mockResolvedValueOnce({ estado: 'verificado', error: null });
    await fireEvent.press(screen.getByText('Reintentar'));

    expect(await screen.findByText('Identidad verificada')).toBeTruthy();
  });
});
