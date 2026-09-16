import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SignInScreen from '@/app/(auth)/sign-in';
import { signInWithPassword, signUpWithPassword, signInWithGoogle } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  signInWithPassword: jest.fn(),
  signUpWithPassword: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockedSignInWithPassword = signInWithPassword as jest.Mock;
const mockedSignUpWithPassword = signUpWithPassword as jest.Mock;
const mockedSignInWithGoogle = signInWithGoogle as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SignInScreen — solo dos formas de entrar', () => {
  it('ofrece correo+contraseña y Google — ningún campo de teléfono, ningún "enviar código"', async () => {
    await render(<SignInScreen />);

    expect(screen.getByPlaceholderText('tu@correo.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('Contraseña')).toBeTruthy();
    expect(screen.getByText('Continuar con Google')).toBeTruthy();
    expect(screen.queryByText('Enviar código')).toBeNull();
    expect(screen.queryByPlaceholderText(/celular|teléfono/i)).toBeNull();
  });
});

describe('SignInScreen — entrar', () => {
  it('un correo inválido da el mismo mensaje genérico, sin llamar a signInWithPassword', async () => {
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'no-es-un-correo');
    await fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'algo');
    await fireEvent.press(screen.getByText('Entrar'));

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeTruthy();
    expect(mockedSignInWithPassword).not.toHaveBeenCalled();
  });

  it('entra con correo y contraseña válidos', async () => {
    mockedSignInWithPassword.mockResolvedValue({ error: null });
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ana@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'contraseñaLarga1');
    await fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() => {
      expect(mockedSignInWithPassword).toHaveBeenCalledWith('ana@example.com', 'contraseñaLarga1');
    });
  });

  it('muestra el mismo mensaje genérico ante credenciales incorrectas', async () => {
    mockedSignInWithPassword.mockResolvedValue({ error: 'Correo o contraseña incorrectos.' });
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ana@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'loquesea1');
    await fireEvent.press(screen.getByText('Entrar'));

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeTruthy();
  });

  it('el botón "Entrar" queda deshabilitado mientras la llamada está en vuelo', async () => {
    let resolver: (v: unknown) => void = () => {};
    mockedSignInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      }),
    );
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ana@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'contraseñaLarga1');

    fireEvent.press(screen.getByText('Entrar'));
    const botonEnVuelo = await screen.findByText('Entrando…');
    fireEvent.press(botonEnVuelo);

    resolver({ error: null });
    await waitFor(() => expect(mockedSignInWithPassword).toHaveBeenCalledTimes(1));
  });

  it('"¿Olvidaste tu contraseña?" lleva a recuperar', async () => {
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByText('¿Olvidaste tu contraseña?'));

    expect(mockPush).toHaveBeenCalledWith('/(auth)/recuperar');
  });
});

describe('SignInScreen — crear cuenta', () => {
  async function irACrearCuenta() {
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText('¿No tienes cuenta? Créala'));
  }

  it('un correo inválido no llama a signUpWithPassword', async () => {
    await irACrearCuenta();

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'no-es-un-correo');
    await fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'contraseñaLarga1');
    await fireEvent.press(screen.getByText('Crear cuenta'));

    expect(await screen.findByText('Correo inválido.')).toBeTruthy();
    expect(mockedSignUpWithPassword).not.toHaveBeenCalled();
  });

  it('una contraseña de menos de 8 caracteres no llama a signUpWithPassword', async () => {
    await irACrearCuenta();

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'nueva@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'corta1');
    await fireEvent.press(screen.getByText('Crear cuenta'));

    expect(await screen.findByText(/8/)).toBeTruthy();
    expect(mockedSignUpWithPassword).not.toHaveBeenCalled();
  });

  it('crear cuenta con confirmación activa NO entra — dice que revise su correo', async () => {
    mockedSignUpWithPassword.mockResolvedValue({ error: null, needsEmailConfirmation: true });
    await irACrearCuenta();

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'nueva@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'contraseñaLarga1');
    await fireEvent.press(screen.getByText('Crear cuenta'));

    expect(await screen.findByText(/revisa tu correo/i)).toBeTruthy();
    // No hay ningún indicio de que haya "entrado": no se llama a Google, no
    // desaparece la pantalla hacia otra ruta — la pantalla se queda mostrando
    // el aviso, y sign-in ni siquiera tiene forma de navegar por su cuenta
    // (el guardián de _layout es el único que redirige con sesión real).
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('muestra el error del proveedor si el correo ya está registrado', async () => {
    mockedSignUpWithPassword.mockResolvedValue({ error: 'User already registered' });
    await irACrearCuenta();

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ana@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'contraseñaLarga1');
    await fireEvent.press(screen.getByText('Crear cuenta'));

    expect(await screen.findByText('User already registered')).toBeTruthy();
  });

  it('"¿Ya tienes cuenta? Entra" vuelve al modo de entrar', async () => {
    await irACrearCuenta();
    expect(screen.getByText('Crear cuenta')).toBeTruthy();

    await fireEvent.press(screen.getByText('¿Ya tienes cuenta? Entra'));

    expect(screen.getByText('Entrar')).toBeTruthy();
  });
});

describe('SignInScreen — Google (sin cambios)', () => {
  it('inicia sesión con Google al presionar el botón', async () => {
    mockedSignInWithGoogle.mockResolvedValue({ error: null });
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByText('Continuar con Google'));

    await waitFor(() => {
      expect(mockedSignInWithGoogle).toHaveBeenCalledTimes(1);
    });
  });

  it('muestra el error si el ingreso con Google falla', async () => {
    mockedSignInWithGoogle.mockResolvedValue({ error: 'Ingreso con Google cancelado.' });
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByText('Continuar con Google'));

    expect(await screen.findByText('Ingreso con Google cancelado.')).toBeTruthy();
  });
});
