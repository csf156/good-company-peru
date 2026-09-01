import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import OwnProfileScreen from '@/app/profile';
import { getOwnProfile, updateOwnProfile } from '@/lib/profile';
import { getPhotoSignedUrl, uploadProfilePhoto } from '@/lib/storage';
import * as ImagePicker from 'expo-image-picker';

jest.mock('@/lib/profile', () => ({
  getOwnProfile: jest.fn(),
  updateOwnProfile: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({
  getPhotoSignedUrl: jest.fn(),
  uploadProfilePhoto: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

const mockedGetOwnProfile = getOwnProfile as jest.Mock;
const mockedUpdateOwnProfile = updateOwnProfile as jest.Mock;
const mockedGetSignedUrl = getPhotoSignedUrl as jest.Mock;
const mockedUploadPhoto = uploadProfilePhoto as jest.Mock;
const mockedPickImage = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockedRequestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;

const baseProfile = {
  rol: 'amigo',
  nombre: 'Ana Torres',
  alias: 'Ani',
  fecha_nacimiento: '2000-01-01',
  genero: 'femenino',
  profesion: 'Diseñadora',
  foto_url: 'user-1/foto.jpg',
  hobbies: ['cine'],
  tipo_salida: ['viajar'],
  kyc_estado: 'verificado',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetSignedUrl.mockResolvedValue({ url: 'https://example.com/signed.jpg', error: null });
});

describe('OwnProfileScreen — view mode', () => {
  it('shows the profile fields and a verified badge', async () => {
    mockedGetOwnProfile.mockResolvedValue(baseProfile);
    await render(<OwnProfileScreen />);

    expect(await screen.findByText('Ana Torres')).toBeTruthy();
    expect(screen.getByText('Ani')).toBeTruthy();
    expect(screen.getByText('Diseñadora')).toBeTruthy();
    expect(screen.getByText('Verificado ✓')).toBeTruthy();
  });

  it('does not show the verified badge when KYC is not verified', async () => {
    mockedGetOwnProfile.mockResolvedValue({ ...baseProfile, kyc_estado: 'pendiente' });
    await render(<OwnProfileScreen />);

    await screen.findByText('Ana Torres');
    expect(screen.queryByText('Verificado ✓')).toBeNull();
  });
});

describe('OwnProfileScreen — edit mode', () => {
  it('pre-fills the edit form with current values and saves changes', async () => {
    mockedGetOwnProfile.mockResolvedValue(baseProfile);
    mockedUpdateOwnProfile.mockResolvedValue({ error: null });
    await render(<OwnProfileScreen />);
    await screen.findByText('Ana Torres');

    await fireEvent.press(screen.getByText('Editar'));

    const aliasInput = screen.getByDisplayValue('Ani');
    await fireEvent.changeText(aliasInput, 'Ani2');

    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockedUpdateOwnProfile).toHaveBeenCalledWith({
        nombre: 'Ana Torres',
        alias: 'Ani2',
        fecha_nacimiento: '2000-01-01',
        genero: 'femenino',
        profesion: 'Diseñadora',
        hobbies: ['cine'],
        tipo_salida: ['viajar'],
      });
    });
    expect(await screen.findByText('Ani2')).toBeTruthy();
  });

  it('replaces the photo and includes it in the saved fields', async () => {
    mockedGetOwnProfile.mockResolvedValue(baseProfile);
    mockedUpdateOwnProfile.mockResolvedValue({ error: null });
    mockedRequestPermission.mockResolvedValue({ granted: true });
    mockedPickImage.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///new.jpg' }] });
    mockedUploadPhoto.mockResolvedValue({ path: 'user-1/foto-nueva.jpg', error: null });
    await render(<OwnProfileScreen />);
    await screen.findByText('Ana Torres');

    await fireEvent.press(screen.getByText('Editar'));
    await fireEvent.press(screen.getByText('Cambiar foto'));
    await screen.findByText('Foto lista ✓');

    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockedUpdateOwnProfile).toHaveBeenCalledWith(
        expect.objectContaining({ foto_url: 'user-1/foto-nueva.jpg' }),
      );
    });
  });

  it('shows an error and stays in edit mode if saving fails', async () => {
    mockedGetOwnProfile.mockResolvedValue(baseProfile);
    mockedUpdateOwnProfile.mockResolvedValue({ error: 'algo salió mal' });
    await render(<OwnProfileScreen />);
    await screen.findByText('Ana Torres');

    await fireEvent.press(screen.getByText('Editar'));
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('algo salió mal')).toBeTruthy();
    expect(screen.getByText('Guardar')).toBeTruthy();
  });
});
