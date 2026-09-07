import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CarruselScreen from '@/app/(auth)/carrusel';
import { marcarCarruselVisto } from '@/lib/carrusel';
import { CarruselVistoContext } from '@/lib/carrusel-context';

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

// El bug que estos dos tests cierran: la pantalla escribia la marca en el
// almacenamiento pero no se lo decia a `_layout`, que solo lee `carruselVisto()`
// una vez al montar. `carruselPendiente` seguia en `true`, y en cuanto
// `router.replace` cambiaba el segmento el efecto de redireccion devolvia al
// usuario al carrusel. Bucle infinito: nadie podia llegar al sign-in.
// Reproducido en el navegador antes de arreglarlo.
it('avisa al layout de que el carrusel ya se vio, no solo al almacenamiento', async () => {
  const avisar = jest.fn();
  await render(
    <CarruselVistoContext.Provider value={avisar}>
      <CarruselScreen />
    </CarruselVistoContext.Provider>,
  );

  await fireEvent.press(screen.getByText('Saltar'));

  await waitFor(() => expect(mockedMarcar).toHaveBeenCalledTimes(1));
  expect(avisar).toHaveBeenCalledTimes(1);
});

it('avisa al layout ANTES de navegar, o el guardian rebota con el estado viejo', async () => {
  const orden: string[] = [];
  const avisar = jest.fn(() => void orden.push('avisar'));
  mockReplace.mockImplementation(() => void orden.push('replace'));

  await render(
    <CarruselVistoContext.Provider value={avisar}>
      <CarruselScreen />
    </CarruselVistoContext.Provider>,
  );

  await fireEvent.press(screen.getByText('Siguiente'));
  await fireEvent.press(screen.getByText('Siguiente'));
  await fireEvent.press(screen.getByText('Siguiente'));
  await fireEvent.press(screen.getByText('Entrar'));

  await waitFor(() => expect(orden).toEqual(['avisar', 'replace']));
});
