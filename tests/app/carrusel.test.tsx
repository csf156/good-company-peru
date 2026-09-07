import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CarruselScreen from '@/app/(auth)/carrusel';
import { marcarCarruselVisto } from '@/lib/carrusel';

jest.mock('@/lib/carrusel', () => ({ marcarCarruselVisto: jest.fn() }));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const mockedMarcar = marcarCarruselVisto as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedMarcar.mockResolvedValue(undefined);
});

it('arranca en la primera slide de cuatro', async () => {
  await render(<CarruselScreen />);
  expect(screen.getByText('1 de 4')).toBeTruthy();
});

it('avanza con el botón hasta la última slide', async () => {
  await render(<CarruselScreen />);

  await fireEvent.press(screen.getByText('Siguiente'));
  expect(screen.getByText('2 de 4')).toBeTruthy();

  await fireEvent.press(screen.getByText('Siguiente'));
  await fireEvent.press(screen.getByText('Siguiente'));
  expect(screen.getByText('4 de 4')).toBeTruthy();
});

it('terminar marca el carrusel como visto y va al sign-in', async () => {
  await render(<CarruselScreen />);

  await fireEvent.press(screen.getByText('Siguiente'));
  await fireEvent.press(screen.getByText('Siguiente'));
  await fireEvent.press(screen.getByText('Siguiente'));
  await fireEvent.press(screen.getByText('Entrar'));

  await waitFor(() => expect(mockedMarcar).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in'));
});

it('saltar lo marca igual que terminarlo', async () => {
  await render(<CarruselScreen />);

  await fireEvent.press(screen.getByText('Saltar'));

  await waitFor(() => expect(mockedMarcar).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in'));
});
