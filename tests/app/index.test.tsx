import { render, screen, fireEvent } from '@testing-library/react-native';
import DiscoverScreen from '@/app/index';
import { getPerfilesDescubrir } from '@/lib/descubrimiento';

jest.mock('@/lib/descubrimiento', () => ({
  getPerfilesDescubrir: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockedGetPerfilesDescubrir = getPerfilesDescubrir as jest.Mock;

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
});
