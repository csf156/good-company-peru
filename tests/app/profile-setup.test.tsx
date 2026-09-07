import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileSetupScreen from '@/app/(auth)/profile-setup';
import { getOwnProfile, updateOwnProfile, upsertPreferenciasSalida } from '@/lib/profile';
import { uploadProfilePhoto } from '@/lib/storage';
import { registrarPasoOnboarding, registrarOnboardingCompletado } from '@/lib/onboarding-analytics';
import { ProfileRefreshContext } from '@/lib/profile-context';
import * as ImagePicker from 'expo-image-picker';

jest.mock('@/lib/profile', () => ({
  getOwnProfile: jest.fn(),
  updateOwnProfile: jest.fn(),
  upsertPreferenciasSalida: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({
  uploadProfilePhoto: jest.fn(),
}));
jest.mock('@/lib/onboarding-analytics', () => ({
  registrarPasoOnboarding: jest.fn(),
  registrarOnboardingCompletado: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockedGetOwnProfile = getOwnProfile as jest.Mock;
const mockedUpdateOwnProfile = updateOwnProfile as jest.Mock;
const mockedUpsertPreferencias = upsertPreferenciasSalida as jest.Mock;
const mockedUploadPhoto = uploadProfilePhoto as jest.Mock;
const mockedPickImage = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockedRequestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockedRegistrarPaso = registrarPasoOnboarding as jest.Mock;
const mockedRegistrarCompletado = registrarOnboardingCompletado as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetOwnProfile.mockResolvedValue({ rol: 'amigo' });
});

/** Avanza desde el paso 1 hasta justo antes de `pasoObjetivo` (exclusivo). */
async function avanzarHasta(pasoObjetivo: number) {
  await fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), 'Ana Torres');
  await fireEvent.changeText(screen.getByPlaceholderText('Alias'), 'ana');
  await fireEvent.press(screen.getByText('Continuar'));
  if (pasoObjetivo === 2) return;

  await fireEvent.press(screen.getByLabelText('Día'));
  await fireEvent.press(screen.getByText('5'));
  await fireEvent.press(screen.getByLabelText('Mes'));
  await fireEvent.press(screen.getByText('marzo'));
  await fireEvent.press(screen.getByLabelText('Año'));
  await fireEvent.press(screen.getByText('2000'));
  await fireEvent.press(screen.getByText('Continuar'));
  if (pasoObjetivo === 3) return;

  await fireEvent.press(screen.getByText('Mujer'));
  await fireEvent.press(screen.getByText('Continuar'));
  if (pasoObjetivo === 4) return;

  mockedRequestPermission.mockResolvedValue({ granted: true });
  mockedPickImage.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg' }] });
  mockedUploadPhoto.mockResolvedValue({ path: 'user-1/foto.jpg', error: null });
  await fireEvent.press(screen.getByText('Elegir foto'));
  await screen.findByText('Foto lista ✓');
  await fireEvent.press(screen.getByText('Continuar'));
  if (pasoObjetivo === 5) return;
}

describe('ProfileSetupScreen — navegación (pasos 1-3)', () => {
  it('arranca en el paso 1 de 7', async () => {
    await render(<ProfileSetupScreen />);
    expect(await screen.findByText('Paso 1 de 7')).toBeTruthy();
  });

  it('no avanza con el paso inválido y dice por qué', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await fireEvent.press(screen.getByText('Continuar'));

    expect(screen.getByText('Paso 1 de 7')).toBeTruthy();
    expect(screen.getByText(/completa tu nombre y alias/i)).toBeTruthy();
  });

  it('avanza cuando el paso es válido', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), 'Ana Torres');
    await fireEvent.changeText(screen.getByPlaceholderText('Alias'), 'ana');
    await fireEvent.press(screen.getByText('Continuar'));

    expect(await screen.findByText('Paso 2 de 7')).toBeTruthy();
  });

  it('retroceder conserva lo ingresado', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), 'Ana Torres');
    await fireEvent.changeText(screen.getByPlaceholderText('Alias'), 'ana');
    await fireEvent.press(screen.getByText('Continuar'));
    await screen.findByText('Paso 2 de 7');

    await fireEvent.press(screen.getByLabelText('Volver'));

    expect(await screen.findByDisplayValue('Ana Torres')).toBeTruthy();
  });

  it('el paso 1 no muestra botón de volver', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');
    expect(screen.queryByLabelText('Volver')).toBeNull();
  });

  it('el género "Otro" exige texto', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');
    await avanzarHasta(3);
    await screen.findByText('Paso 3 de 7');

    await fireEvent.press(screen.getByText('Otro'));
    await fireEvent.press(screen.getByText('Continuar'));

    expect(screen.getByText('Paso 3 de 7')).toBeTruthy();
    expect(screen.getByText(/escribe tu género/i)).toBeTruthy();
  });
});

describe('ProfileSetupScreen — pasos 4-7 (amigo)', () => {
  it('el 6º hobby es rechazado', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');
    await avanzarHasta(5);
    await screen.findByText('Paso 5 de 7');

    const cincoHobbies = ['Fútbol', 'Vóley', 'Bicicleta', 'Gimnasio', 'Correr'];
    for (const hobby of cincoHobbies) {
      await fireEvent.press(screen.getByText(hobby));
    }
    await fireEvent.press(screen.getByText('Bailar'));

    // El 6º no se agregó — 5 elegidos sigue siendo válido, así que avanza.
    expect(screen.getByText(/máximo 5/i)).toBeTruthy();
    await fireEvent.press(screen.getByText('Continuar'));
    expect(await screen.findByText('Paso 6 de 7')).toBeTruthy();
  });

  it('el "Otro" de hobbies parsea texto separado por comas y cuenta contra el máximo', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');
    await avanzarHasta(5);
    await screen.findByText('Paso 5 de 7');

    await fireEvent.press(screen.getByText('Fútbol'));
    await fireEvent.press(screen.getByText('Vóley'));
    await fireEvent.press(screen.getByText('Bicicleta'));

    await fireEvent.press(screen.getByText('Otro'));
    await fireEvent.changeText(screen.getByPlaceholderText(/hobbies.*coma/i), 'ajedrez, pesca');

    // Ya hay 5 (3 de la grilla + 2 de "Otro"): un 4º de la grilla se rechaza.
    await fireEvent.press(screen.getByText('Gimnasio'));
    expect(screen.getByText(/máximo/i)).toBeTruthy();

    await fireEvent.press(screen.getByText('Continuar'));
    expect(await screen.findByText('Paso 6 de 7')).toBeTruthy();
  });

  it('la 3ª opción de tipo de salida es rechazada', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');
    await avanzarHasta(5);
    await screen.findByText('Paso 5 de 7');
    await fireEvent.press(screen.getByText('Fútbol'));
    await fireEvent.press(screen.getByText('Continuar'));
    await screen.findByText('Paso 6 de 7');

    await fireEvent.press(screen.getByText('Conversar / café'));
    await fireEvent.press(screen.getByText('Salir a comer'));
    await fireEvent.press(screen.getByText('Vida nocturna'));

    expect(screen.getByText(/máximo 2/i)).toBeTruthy();
  });

  it('el paso de tipo de salida no ofrece "Otro"', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');
    await avanzarHasta(5);
    await screen.findByText('Paso 5 de 7');
    await fireEvent.press(screen.getByText('Fútbol'));
    await fireEvent.press(screen.getByText('Continuar'));
    await screen.findByText('Paso 6 de 7');

    expect(screen.queryByText('Otro')).toBeNull();
  });

  it('la pantalla de distritos filtra sin distinguir tildes', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');
    await avanzarHasta(5);
    await screen.findByText('Paso 5 de 7');
    await fireEvent.press(screen.getByText('Fútbol'));
    await fireEvent.press(screen.getByText('Continuar'));
    await screen.findByText('Paso 6 de 7');
    await fireEvent.press(screen.getByText('Conversar / café'));
    await fireEvent.press(screen.getByText('Continuar'));
    await screen.findByText('Paso 7 de 7');

    await fireEvent.changeText(screen.getByPlaceholderText('Buscar…'), 'jesus maria');

    expect(screen.getByText('Jesús María')).toBeTruthy();
    expect(screen.queryByText('Miraflores')).toBeNull();
  });

  it('el 6º distrito es rechazado', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');
    await avanzarHasta(5);
    await screen.findByText('Paso 5 de 7');
    await fireEvent.press(screen.getByText('Fútbol'));
    await fireEvent.press(screen.getByText('Continuar'));
    await screen.findByText('Paso 6 de 7');
    await fireEvent.press(screen.getByText('Conversar / café'));
    await fireEvent.press(screen.getByText('Continuar'));
    await screen.findByText('Paso 7 de 7');

    const cincoDistritos = ['Ancón', 'Ate', 'Barranco', 'Bellavista', 'Breña'];
    for (const distrito of cincoDistritos) {
      await fireEvent.press(screen.getByText(distrito));
    }
    await fireEvent.press(screen.getByText('Callao'));

    expect(screen.getByText(/máximo 5/i)).toBeTruthy();
  });
});

describe('ProfileSetupScreen — rentador', () => {
  it('salta el paso de distritos (6 pasos, no 7)', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'rentador' });
    await render(<ProfileSetupScreen />);
    expect(await screen.findByText('Paso 1 de 6')).toBeTruthy();
  });
});

/** `referido` es opcional (Tarea 6, D.4) — omitirlo deja el campo vacío,
 * igual que hacían todos los tests de este helper antes de que existiera. */
async function completarWizardCompleto({ referido }: { referido?: string } = {}) {
  await fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), 'Ana Torres');
  await fireEvent.changeText(screen.getByPlaceholderText('Alias'), 'ana');
  if (referido !== undefined) {
    await fireEvent.changeText(
      screen.getByPlaceholderText('¿Alguien te invitó? Su código (opcional)'),
      referido,
    );
  }
  await fireEvent.press(screen.getByText('Continuar'));
  await screen.findByText('Paso 2 de 7');

  await fireEvent.press(screen.getByLabelText('Día'));
  await fireEvent.press(screen.getByText('5'));
  await fireEvent.press(screen.getByLabelText('Mes'));
  await fireEvent.press(screen.getByText('marzo'));
  await fireEvent.press(screen.getByLabelText('Año'));
  await fireEvent.press(screen.getByText('1995'));
  await fireEvent.press(screen.getByText('Continuar'));
  await screen.findByText('Paso 3 de 7');

  await fireEvent.press(screen.getByText('Mujer'));
  await fireEvent.press(screen.getByText('Continuar'));
  await screen.findByText('Paso 4 de 7');

  mockedRequestPermission.mockResolvedValue({ granted: true });
  mockedPickImage.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg' }] });
  mockedUploadPhoto.mockResolvedValue({ path: 'user-1/foto.jpg', error: null });
  await fireEvent.press(screen.getByText('Elegir foto'));
  await screen.findByText('Foto lista ✓');
  await fireEvent.press(screen.getByText('Continuar'));
  await screen.findByText('Paso 5 de 7');

  await fireEvent.press(screen.getByText('Fútbol'));
  await fireEvent.press(screen.getByText('Continuar'));
  await screen.findByText('Paso 6 de 7');

  await fireEvent.press(screen.getByText('Conversar / café'));
  await fireEvent.press(screen.getByText('Continuar'));
  await screen.findByText('Paso 7 de 7');

  await fireEvent.press(screen.getByText('Miraflores'));
}

describe('ProfileSetupScreen — persistencia final', () => {
  it('guarda todo de una sola vez al terminar el paso 7', async () => {
    mockedUpdateOwnProfile.mockResolvedValue({ error: null });
    mockedUpsertPreferencias.mockResolvedValue({ error: null });
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await completarWizardCompleto();
    await fireEvent.press(screen.getByText('Terminar'));

    await waitFor(() => {
      expect(mockedUpdateOwnProfile).toHaveBeenCalledTimes(1);
    });
    expect(mockedUpdateOwnProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Ana Torres',
        alias: 'ana',
        fecha_nacimiento: '1995-03-05',
        genero: 'Mujer',
        hobbies: expect.arrayContaining(['futbol']),
        tipo_salida: ['conversar'],
      }),
    );
    expect(mockedUpsertPreferencias).toHaveBeenCalledWith({ distritos: ['Miraflores'] });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('guarda el código de referido cuando el usuario lo escribe', async () => {
    mockedUpdateOwnProfile.mockResolvedValue({ error: null });
    mockedUpsertPreferencias.mockResolvedValue({ error: null });
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await completarWizardCompleto({ referido: 'ANA2026' });
    await fireEvent.press(screen.getByText('Terminar'));

    await waitFor(() => {
      expect(mockedUpdateOwnProfile).toHaveBeenCalledWith(
        expect.objectContaining({ referido_por: 'ANA2026' }),
      );
    });
  });

  it('deja el referido en null si el usuario no escribe nada: es opcional', async () => {
    mockedUpdateOwnProfile.mockResolvedValue({ error: null });
    mockedUpsertPreferencias.mockResolvedValue({ error: null });
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await completarWizardCompleto();
    await fireEvent.press(screen.getByText('Terminar'));

    await waitFor(() => {
      expect(mockedUpdateOwnProfile).toHaveBeenCalledWith(
        expect.objectContaining({ referido_por: null }),
      );
    });
  });

  it('no escribe nada en pasos intermedios', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await avanzarHasta(4);
    await screen.findByText('Paso 4 de 7');

    expect(mockedUpdateOwnProfile).not.toHaveBeenCalled();
    expect(mockedUpsertPreferencias).not.toHaveBeenCalled();
  });

  it('un fallo al guardar deja al usuario en el paso 7 con el error visible y sin perder datos', async () => {
    mockedUpdateOwnProfile.mockResolvedValue({ error: 'Falló la red' });
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await completarWizardCompleto();
    await fireEvent.press(screen.getByText('Terminar'));

    expect(await screen.findByText(/falló la red/i)).toBeTruthy();
    expect(screen.getByText('Paso 7 de 7')).toBeTruthy();
    expect(screen.getByText('Miraflores')).toBeTruthy();
  });
});

describe('ProfileSetupScreen — medición de abandono', () => {
  it('registra el paso al entrar en él', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');
    expect(mockedRegistrarPaso).toHaveBeenCalledWith(1);

    await fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), 'Ana Torres');
    await fireEvent.changeText(screen.getByPlaceholderText('Alias'), 'ana');
    await fireEvent.press(screen.getByText('Continuar'));
    await screen.findByText('Paso 2 de 7');

    expect(mockedRegistrarPaso).toHaveBeenCalledWith(2);
  });

  it('registra el completado al guardar con éxito', async () => {
    mockedUpdateOwnProfile.mockResolvedValue({ error: null });
    mockedUpsertPreferencias.mockResolvedValue({ error: null });
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await completarWizardCompleto();
    await fireEvent.press(screen.getByText('Terminar'));

    await waitFor(() => {
      expect(mockedRegistrarCompletado).toHaveBeenCalledTimes(1);
    });
  });

  it('un fallo de la analítica no rompe el alta', async () => {
    mockedRegistrarPaso.mockImplementation(() => {
      throw new Error('sin red');
    });
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), 'Ana Torres');
    await fireEvent.changeText(screen.getByPlaceholderText('Alias'), 'ana');
    await fireEvent.press(screen.getByText('Continuar'));

    expect(await screen.findByText('Paso 2 de 7')).toBeTruthy();
    expect(screen.queryByText(/sin red/i)).toBeNull();
  });
});

describe('ProfileSetupScreen — refresco del perfil tras guardar', () => {
  it('tras guardar el alta, vuelve a leer el perfil (si no, el guardián devuelve al paso 1)', async () => {
    mockedUpdateOwnProfile.mockResolvedValue({ error: null });
    mockedUpsertPreferencias.mockResolvedValue({ error: null });
    const refreshProfile = jest.fn();
    await render(
      <ProfileRefreshContext.Provider value={refreshProfile}>
        <ProfileSetupScreen />
      </ProfileRefreshContext.Provider>,
    );
    await screen.findByText('Paso 1 de 7');

    await completarWizardCompleto();
    await fireEvent.press(screen.getByText('Terminar'));

    await waitFor(() => {
      expect(mockedUpdateOwnProfile).toHaveBeenCalledTimes(1);
    });
    expect(refreshProfile).toHaveBeenCalledTimes(1);
  });

  it('no vuelve a leer el perfil si el guardado falló', async () => {
    mockedUpdateOwnProfile.mockResolvedValue({ error: 'Falló la red' });
    const refreshProfile = jest.fn();
    await render(
      <ProfileRefreshContext.Provider value={refreshProfile}>
        <ProfileSetupScreen />
      </ProfileRefreshContext.Provider>,
    );
    await screen.findByText('Paso 1 de 7');

    await completarWizardCompleto();
    await fireEvent.press(screen.getByText('Terminar'));

    await screen.findByText(/falló la red/i);
    expect(refreshProfile).not.toHaveBeenCalled();
  });

  it('espera a que termine de releer el perfil antes de navegar (si no, _layout redirige con el estado viejo)', async () => {
    mockedUpdateOwnProfile.mockResolvedValue({ error: null });
    mockedUpsertPreferencias.mockResolvedValue({ error: null });
    let resolveRefresh: () => void = () => {};
    const refreshProfile = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    await render(
      <ProfileRefreshContext.Provider value={refreshProfile}>
        <ProfileSetupScreen />
      </ProfileRefreshContext.Provider>,
    );
    await screen.findByText('Paso 1 de 7');

    await completarWizardCompleto();
    // Sin `await` aquí a propósito: `handleContinuar` queda suspendido en
    // `await refreshProfile()` hasta que el test resuelva esa promesa más
    // abajo — esperar `fireEvent.press` (que en RNTL v14 espera la promesa
    // que devuelve el handler) se quedaría trabado para siempre. Por lo
    // mismo, la consola puede mostrar un warning de `act(...)` benigno para
    // el `setLoading(false)` que corre antes del await largo — no es un
    // fallo del test.
    fireEvent.press(screen.getByText('Terminar'));

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
    mockedUpdateOwnProfile.mockResolvedValue({ error: null });
    mockedUpsertPreferencias.mockResolvedValue({ error: null });
    const refreshProfile = jest.fn().mockRejectedValue(new Error('sin red'));
    await render(
      <ProfileRefreshContext.Provider value={refreshProfile}>
        <ProfileSetupScreen />
      </ProfileRefreshContext.Provider>,
    );
    await screen.findByText('Paso 1 de 7');

    await completarWizardCompleto();
    await fireEvent.press(screen.getByText('Terminar'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });
});
