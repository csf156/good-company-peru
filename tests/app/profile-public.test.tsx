import { render, screen } from '@testing-library/react-native';
import PublicProfileScreen from '@/app/profile/[id]';
import { getPublicProfile } from '@/lib/profile';
import { getPhotoSignedUrl } from '@/lib/storage';

jest.mock('@/lib/profile', () => ({
  getPublicProfile: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({
  getPhotoSignedUrl: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'user-2' }),
}));

const mockedGetPublicProfile = getPublicProfile as jest.Mock;
const mockedGetSignedUrl = getPhotoSignedUrl as jest.Mock;

const publicProfile = {
  id: 'user-2',
  rol: 'rentador',
  alias: 'BobAlias',
  edad: 30,
  genero: 'masculino',
  profesion: 'Ingeniero',
  hobbies: ['fútbol'],
  tipo_salida: ['tecnología'],
  foto_url: 'user-2/foto.jpg',
  kyc_estado: 'verificado',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetSignedUrl.mockResolvedValue({ url: 'https://example.com/bob.jpg', error: null });
});

describe('PublicProfileScreen', () => {
  it('shows the safe public fields and a verified badge', async () => {
    mockedGetPublicProfile.mockResolvedValue(publicProfile);
    await render(<PublicProfileScreen />);

    expect(await screen.findByText('BobAlias')).toBeTruthy();
    expect(screen.getByText('Ingeniero')).toBeTruthy();
    expect(screen.getByText('Verificado ✓')).toBeTruthy();
    expect(mockedGetPublicProfile).toHaveBeenCalledWith('user-2');
  });

  it('never renders a real-name field, even if one leaked into the payload', async () => {
    mockedGetPublicProfile.mockResolvedValue({ ...publicProfile, nombre: 'Roberto Real' });
    await render(<PublicProfileScreen />);

    await screen.findByText('BobAlias');
    expect(screen.queryByText('Roberto Real')).toBeNull();
  });

  it('does not show the verified badge when the profile is not KYC-verified', async () => {
    mockedGetPublicProfile.mockResolvedValue({ ...publicProfile, kyc_estado: 'pendiente' });
    await render(<PublicProfileScreen />);

    await screen.findByText('BobAlias');
    expect(screen.queryByText('Verificado ✓')).toBeNull();
  });

  it('shows a not-found message when the profile does not exist', async () => {
    mockedGetPublicProfile.mockResolvedValue(null);
    await render(<PublicProfileScreen />);

    expect(await screen.findByText(/no encontrado/i)).toBeTruthy();
  });
});
