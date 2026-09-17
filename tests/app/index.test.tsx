import { render, screen, fireEvent } from '@testing-library/react-native';
import DiscoverScreen from '@/app/index';
import { getPerfilesDescubrir } from '@/lib/descubrimiento';
import { getPhotoSignedUrl } from '@/lib/storage';

jest.mock('@/lib/descubrimiento', () => ({
  getPerfilesDescubrir: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({
  getPhotoSignedUrl: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockedGetPerfilesDescubrir = getPerfilesDescubrir as jest.Mock;
const mockedGetSignedUrl = getPhotoSignedUrl as jest.Mock;

const AMIGO_1 = {
  id: 'p1',
  rol: 'amigo',
  alias: 'Beto',
  edad: 24,
  genero: 'masculino',
  profesion: 'Diseñador',
  hobbies: ['fútbol'],
  tipo_salida: ['cine'],
  foto_url: null,
  kyc_estado: 'verificado',
};

const AMIGO_2 = {
  id: 'p2',
  rol: 'amigo',
  alias: 'Carla',
  edad: 27,
  genero: 'femenino',
  profesion: 'Chef',
  hobbies: ['cocina'],
  tipo_salida: ['viajes'],
  foto_url: null,
  kyc_estado: 'verificado',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetSignedUrl.mockResolvedValue({ url: null, error: 'sin foto' });
});

describe('DiscoverScreen', () => {
  it('shows the first perfil with a 1-of-N counter', async () => {
    mockedGetPerfilesDescubrir.mockResolvedValue({
      rolPropio: 'rentador',
      perfiles: [AMIGO_1, AMIGO_2],
    });
    await render(<DiscoverScreen />);

    expect(await screen.findByText('Beto')).toBeTruthy();
    expect(screen.getByText('Diseñador')).toBeTruthy();
    expect(screen.getByText('Perfil 1 de 2')).toBeTruthy();
  });

  it('advances to the next perfil and wraps around', async () => {
    mockedGetPerfilesDescubrir.mockResolvedValue({
      rolPropio: 'rentador',
      perfiles: [AMIGO_1, AMIGO_2],
    });
    await render(<DiscoverScreen />);
    await screen.findByText('Beto');

    fireEvent.press(screen.getByLabelText('Siguiente'));
    expect(await screen.findByText('Carla')).toBeTruthy();
    expect(screen.getByText('Perfil 2 de 2')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Siguiente'));
    expect(await screen.findByText('Beto')).toBeTruthy();
    expect(screen.getByText('Perfil 1 de 2')).toBeTruthy();
  });

  it('goes back to the previous perfil and wraps around', async () => {
    mockedGetPerfilesDescubrir.mockResolvedValue({
      rolPropio: 'rentador',
      perfiles: [AMIGO_1, AMIGO_2],
    });
    await render(<DiscoverScreen />);
    await screen.findByText('Beto');

    fireEvent.press(screen.getByLabelText('Anterior'));
    expect(await screen.findByText('Carla')).toBeTruthy();
  });

  it('shows an empty state when there are no perfiles to discover', async () => {
    mockedGetPerfilesDescubrir.mockResolvedValue({ rolPropio: 'amigo', perfiles: [] });
    await render(<DiscoverScreen />);

    expect(await screen.findByText(/no hay perfiles/i)).toBeTruthy();
  });

  it('labels the CTA "Invitar una bebida" for a rentador', async () => {
    mockedGetPerfilesDescubrir.mockResolvedValue({ rolPropio: 'rentador', perfiles: [AMIGO_1] });
    await render(<DiscoverScreen />);

    expect(await screen.findByText('Invitar una bebida')).toBeTruthy();
  });

  it('labels the CTA "Solicitar encuentro" for an amigo', async () => {
    mockedGetPerfilesDescubrir.mockResolvedValue({
      rolPropio: 'amigo',
      perfiles: [{ ...AMIGO_1, rol: 'rentador' }],
    });
    await render(<DiscoverScreen />);

    expect(await screen.findByText('Solicitar encuentro')).toBeTruthy();
  });

  describe('acceso a "Por cobrar" (solo rol amigo)', () => {
    it('el rol amigo ve el acceso a "Por cobrar"', async () => {
      mockedGetPerfilesDescubrir.mockResolvedValue({ rolPropio: 'amigo', perfiles: [] });
      await render(<DiscoverScreen />);

      expect(await screen.findByLabelText('Ver por cobrar')).toBeTruthy();
    });

    it('el rol rentador NO ve el acceso a "Por cobrar"', async () => {
      mockedGetPerfilesDescubrir.mockResolvedValue({ rolPropio: 'rentador', perfiles: [] });
      await render(<DiscoverScreen />);

      await screen.findByText('No hay perfiles disponibles por ahora.');
      expect(screen.queryByLabelText('Ver por cobrar')).toBeNull();
    });
  });

  describe('foto del perfil', () => {
    it('pide la URL firmada con la ruta guardada en foto_url', async () => {
      mockedGetPerfilesDescubrir.mockResolvedValue({
        rolPropio: 'rentador',
        perfiles: [{ ...AMIGO_1, foto_url: 'p1/foto.jpg' }],
      });
      await render(<DiscoverScreen />);

      await screen.findByText('Beto');
      expect(mockedGetSignedUrl).toHaveBeenCalledWith('p1/foto.jpg');
    });

    it('renderiza la foto cuando la URL firmada resuelve', async () => {
      mockedGetSignedUrl.mockResolvedValue({ url: 'https://example.com/beto.jpg', error: null });
      mockedGetPerfilesDescubrir.mockResolvedValue({
        rolPropio: 'rentador',
        perfiles: [{ ...AMIGO_1, foto_url: 'p1/foto.jpg' }],
      });
      await render(<DiscoverScreen />);

      const foto = await screen.findByTestId('perfil-foto');
      expect(foto.props.source).toEqual({ uri: 'https://example.com/beto.jpg' });
      expect(screen.queryByTestId('perfil-foto-placeholder')).toBeNull();
    });

    it('cae al placeholder cuando foto_url es null, sin pedir URL firmada', async () => {
      mockedGetPerfilesDescubrir.mockResolvedValue({
        rolPropio: 'rentador',
        perfiles: [{ ...AMIGO_1, foto_url: null }],
      });
      await render(<DiscoverScreen />);

      await screen.findByText('Beto');
      expect(mockedGetSignedUrl).not.toHaveBeenCalled();
      expect(screen.getByTestId('perfil-foto-placeholder')).toBeTruthy();
      expect(screen.queryByTestId('perfil-foto')).toBeNull();
    });

    it('cae al placeholder cuando la firma de la URL falla', async () => {
      mockedGetSignedUrl.mockResolvedValue({ url: null, error: 'objeto no encontrado' });
      mockedGetPerfilesDescubrir.mockResolvedValue({
        rolPropio: 'rentador',
        perfiles: [{ ...AMIGO_1, foto_url: 'p1/foto.jpg' }],
      });
      await render(<DiscoverScreen />);

      await screen.findByText('Beto');
      expect(await screen.findByTestId('perfil-foto-placeholder')).toBeTruthy();
      expect(screen.queryByTestId('perfil-foto')).toBeNull();
    });
  });
});
