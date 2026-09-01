import { render, screen, fireEvent } from '@testing-library/react-native';
import ProfileSetupScreen from '@/app/(auth)/profile-setup';
import { getOwnProfile } from '@/lib/profile';
import { uploadProfilePhoto } from '@/lib/storage';
import * as ImagePicker from 'expo-image-picker';

jest.mock('@/lib/profile', () => ({
  getOwnProfile: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({
  uploadProfilePhoto: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

const mockedGetOwnProfile = getOwnProfile as jest.Mock;
const mockedUploadPhoto = uploadProfilePhoto as jest.Mock;
const mockedPickImage = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockedRequestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;

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
