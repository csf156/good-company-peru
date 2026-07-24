import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import ChatDetailScreen from '@/app/chats/[id]';
import {
  getMensajes,
  getContraparteAlias,
  enviarMensaje,
  subscribeMensajes,
} from '@/lib/chat';

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'c1' }) }));
jest.mock('@/lib/chat', () => ({
  getMensajes: jest.fn(),
  getContraparteAlias: jest.fn(),
  enviarMensaje: jest.fn(),
  subscribeMensajes: jest.fn(() => () => {}),
}));

const mockedGetMensajes = getMensajes as jest.Mock;
const mockedGetAlias = getContraparteAlias as jest.Mock;
const mockedEnviar = enviarMensaje as jest.Mock;
const mockedSubscribe = subscribeMensajes as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetAlias.mockResolvedValue('Beto');
  mockedSubscribe.mockReturnValue(() => {});
});

describe('ChatDetailScreen', () => {
  it('muestra el alias de la contraparte y las burbujas propia/ajena', async () => {
    mockedGetMensajes.mockResolvedValue([
      { id: 'm1', texto: 'Hola Beto', mine: true, oculto: false, createdAt: '2026-07-24T10:00:00Z' },
      { id: 'm2', texto: 'Hola Ana', mine: false, oculto: false, createdAt: '2026-07-24T10:01:00Z' },
    ]);
    await render(<ChatDetailScreen />);

    expect(await screen.findByText('Beto')).toBeTruthy();
    expect(screen.getByText('Hola Beto')).toBeTruthy();
    expect(screen.getByText('Hola Ana')).toBeTruthy();
  });

  it('avisa al emisor cuando su propio mensaje fue ocultado por moderación', async () => {
    mockedGetMensajes.mockResolvedValue([
      { id: 'm1', texto: 'mi cel 987654321', mine: true, oculto: true, createdAt: '2026-07-24T10:00:00Z' },
    ]);
    await render(<ChatDetailScreen />);

    expect(await screen.findByText(/fue ocultado/i)).toBeTruthy();
  });

  it('suscribe a Realtime para la cita y limpia al desmontar', async () => {
    mockedGetMensajes.mockResolvedValue([]);
    const cleanup = jest.fn();
    mockedSubscribe.mockReturnValue(cleanup);

    const { unmount } = await render(<ChatDetailScreen />);
    await screen.findByText('Beto');

    expect(mockedSubscribe).toHaveBeenCalledWith('c1', expect.any(Function));
    // El cleanup del efecto (passive) se vacía al envolver el unmount en act.
    await act(async () => {
      unmount();
    });
    expect(cleanup).toHaveBeenCalled();
  });

  it('envía un mensaje y limpia el input', async () => {
    mockedGetMensajes.mockResolvedValue([]);
    mockedEnviar.mockResolvedValue({ error: null });

    await render(<ChatDetailScreen />);
    await screen.findByText('Beto');

    const input = screen.getByPlaceholderText(/escribe un mensaje/i);
    await fireEvent.changeText(input, 'nos vemos');
    await fireEvent.press(screen.getByLabelText('Enviar'));

    await waitFor(() => expect(mockedEnviar).toHaveBeenCalledWith('c1', 'nos vemos'));
  });
});
