import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import RecuperarScreen from '@/app/(auth)/recuperar';
import { requestPasswordReset } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  requestPasswordReset: jest.fn(),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockedRequestPasswordReset = requestPasswordReset as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RecuperarScreen', () => {
  it('rechaza un correo inválido sin llamar a requestPasswordReset', async () => {
    await render(<RecuperarScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'no-es-un-correo');
    await fireEvent.press(screen.getByText('Enviar instrucciones'));

    expect(await screen.findByText('Correo inválido.')).toBeTruthy();
    expect(mockedRequestPasswordReset).not.toHaveBeenCalled();
  });

  it('muestra el MISMO aviso de éxito con un correo que existe', async () => {
    mockedRequestPasswordReset.mockResolvedValue({ error: null });
    await render(<RecuperarScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ana@example.com');
    await fireEvent.press(screen.getByText('Enviar instrucciones'));

    expect(await screen.findByText(/si ese correo tiene una cuenta/i)).toBeTruthy();
  });

  it('muestra el MISMO aviso de éxito con un correo que NO existe — no revela cuáles están registrados', async () => {
    mockedRequestPasswordReset.mockResolvedValue({ error: null });
    await render(<RecuperarScreen />);

    await fireEvent.changeText(
      screen.getByPlaceholderText('tu@correo.com'),
      'no-registrado@example.com',
    );
    await fireEvent.press(screen.getByText('Enviar instrucciones'));

    expect(await screen.findByText(/si ese correo tiene una cuenta/i)).toBeTruthy();
  });

  it('el botón queda deshabilitado mientras la llamada está en vuelo', async () => {
    let resolver: (v: unknown) => void = () => {};
    mockedRequestPasswordReset.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      }),
    );
    await render(<RecuperarScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ana@example.com');

    fireEvent.press(screen.getByText('Enviar instrucciones'));
    const botonEnVuelo = await screen.findByText('Enviando…');
    fireEvent.press(botonEnVuelo);

    resolver({ error: null });
    await waitFor(() => expect(mockedRequestPasswordReset).toHaveBeenCalledTimes(1));
  });
});
