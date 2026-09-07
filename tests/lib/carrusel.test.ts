import AsyncStorage from '@react-native-async-storage/async-storage';
import { carruselVisto, marcarCarruselVisto } from '@/lib/carrusel';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedGet = AsyncStorage.getItem as jest.Mock;
const mockedSet = AsyncStorage.setItem as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('es false cuando no hay marca', async () => {
  mockedGet.mockResolvedValue(null);
  await expect(carruselVisto()).resolves.toBe(false);
});

it('es true cuando hay marca', async () => {
  mockedGet.mockResolvedValue('1');
  await expect(carruselVisto()).resolves.toBe(true);
});

it('no rompe si el almacenamiento falla: devuelve false', async () => {
  mockedGet.mockRejectedValue(new Error('sin storage'));
  await expect(carruselVisto()).resolves.toBe(false);
});

it('marcar escribe la clave', async () => {
  mockedSet.mockResolvedValue(undefined);
  await marcarCarruselVisto();
  expect(mockedSet).toHaveBeenCalledWith('martini.carrusel.visto', '1');
});

it('marcar no lanza si el almacenamiento falla', async () => {
  mockedSet.mockRejectedValue(new Error('sin storage'));
  await expect(marcarCarruselVisto()).resolves.toBeUndefined();
});
