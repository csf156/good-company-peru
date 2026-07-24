import { render, screen, fireEvent } from '@testing-library/react-native';
import ChatsScreen from '@/app/chats/index';
import { getChats } from '@/lib/chat';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/chat', () => ({ getChats: jest.fn() }));

const mockedGetChats = getChats as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ChatsScreen', () => {
  it('lista las conversaciones con alias y último mensaje', async () => {
    mockedGetChats.mockResolvedValue([
      { citaId: 'c1', alias: 'Beto', ultimoMensaje: 'Nos vemos!' },
      { citaId: 'c2', alias: 'Carla', ultimoMensaje: null },
    ]);
    await render(<ChatsScreen />);

    expect(await screen.findByText('Beto')).toBeTruthy();
    expect(screen.getByText('Nos vemos!')).toBeTruthy();
    expect(screen.getByText('Carla')).toBeTruthy();
  });

  it('muestra estado vacío cuando no hay chats', async () => {
    mockedGetChats.mockResolvedValue([]);
    await render(<ChatsScreen />);

    expect(await screen.findByText(/no tienes chats/i)).toBeTruthy();
  });

  it('navega al detalle al tocar una conversación', async () => {
    mockedGetChats.mockResolvedValue([{ citaId: 'c1', alias: 'Beto', ultimoMensaje: 'Hola' }]);
    await render(<ChatsScreen />);

    fireEvent.press(await screen.findByText('Beto'));
    expect(mockPush).toHaveBeenCalledWith('/chats/c1');
  });
});
