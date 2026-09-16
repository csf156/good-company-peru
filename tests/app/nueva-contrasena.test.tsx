import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import NuevaContrasenaScreen from '@/app/(auth)/nueva-contrasena';
import { completePasswordRecovery, updatePassword } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  completePasswordRecovery: jest.fn(),
  updatePassword: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockedCompletePasswordRecovery = completePasswordRecovery as jest.Mock;
const mockedUpdatePassword = updatePassword as jest.Mock;

const originalWindow = (global as { window?: unknown }).window;

beforeEach(() => {
  jest.clearAllMocks();
  (global as { window?: unknown }).window = {
    location: { hash: '#access_token=tok123&refresh_token=ref456&type=recovery' },
  };
});

afterEach(() => {
  (global as { window?: unknown }).window = originalWindow;
});

describe('NuevaContrasenaScreen', () => {
  it('establece la sesión desde el fragmento de la URL apenas monta, y muestra el formulario si sale bien', async () => {
    mockedCompletePasswordRecovery.mockResolvedValue({ error: null });
    await render(<NuevaContrasenaScreen />);

    await waitFor(() => {
      expect(mockedCompletePasswordRecovery).toHaveBeenCalledWith(
        '#access_token=tok123&refresh_token=ref456&type=recovery',
      );
    });
    expect(await screen.findByPlaceholderText('Nueva contraseña')).toBeTruthy();
  });

  it('si el enlace es inválido o venció, muestra el error y NO el formulario', async () => {
    mockedCompletePasswordRecovery.mockResolvedValue({
      error: 'El enlace de recuperación no es válido o ya venció.',
    });
    await render(<NuevaContrasenaScreen />);

    expect(await screen.findByText('El enlace de recuperación no es válido o ya venció.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Nueva contraseña')).toBeNull();
  });

  it('rechaza una contraseña de menos de 8 caracteres sin llamar a updatePassword', async () => {
    mockedCompletePasswordRecovery.mockResolvedValue({ error: null });
    await render(<NuevaContrasenaScreen />);
    await screen.findByPlaceholderText('Nueva contraseña');

    await fireEvent.changeText(screen.getByPlaceholderText('Nueva contraseña'), 'corta1');
    await fireEvent.press(screen.getByText('Guardar contraseña'));

    expect(await screen.findByText(/8/)).toBeTruthy();
    expect(mockedUpdatePassword).not.toHaveBeenCalled();
  });

  it('al fijar la contraseña con éxito, navega a home — el guardián decide el resto', async () => {
    mockedCompletePasswordRecovery.mockResolvedValue({ error: null });
    mockedUpdatePassword.mockResolvedValue({ error: null });
    await render(<NuevaContrasenaScreen />);
    await screen.findByPlaceholderText('Nueva contraseña');

    await fireEvent.changeText(screen.getByPlaceholderText('Nueva contraseña'), 'contraseñaNuevaLarga1');
    await fireEvent.press(screen.getByText('Guardar contraseña'));

    await waitFor(() => {
      expect(mockedUpdatePassword).toHaveBeenCalledWith('contraseñaNuevaLarga1');
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('surfaces el error de updatePassword y no navega', async () => {
    mockedCompletePasswordRecovery.mockResolvedValue({ error: null });
    mockedUpdatePassword.mockResolvedValue({ error: 'contraseña insegura' });
    await render(<NuevaContrasenaScreen />);
    await screen.findByPlaceholderText('Nueva contraseña');

    await fireEvent.changeText(screen.getByPlaceholderText('Nueva contraseña'), 'contraseñaNuevaLarga1');
    await fireEvent.press(screen.getByText('Guardar contraseña'));

    expect(await screen.findByText('contraseña insegura')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
