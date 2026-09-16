import * as WebBrowser from 'expo-web-browser';
import {
  signUpWithPassword,
  signInWithPassword,
  requestPasswordReset,
  updatePassword,
  createProfile,
  signInWithGoogle,
  completeGoogleSignIn,
  completePasswordRecovery,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { experiments: { baseUrl: '/good-company-peru' } } },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      getUser: jest.fn(),
      signInWithOAuth: jest.fn(),
      setSession: jest.fn(),
    },
    from: jest.fn(),
  },
}));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'rentafriendperu://redirect'),
}));

const mockedSupabase = supabase as unknown as {
  auth: {
    signUp: jest.Mock;
    signInWithPassword: jest.Mock;
    resetPasswordForEmail: jest.Mock;
    updateUser: jest.Mock;
    getUser: jest.Mock;
    signInWithOAuth: jest.Mock;
    setSession: jest.Mock;
  };
  from: jest.Mock;
};

const mockedSignInWithOAuth = mockedSupabase.auth.signInWithOAuth;
const mockedSetSession = mockedSupabase.auth.setSession;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('signUpWithPassword', () => {
  it('rechaza un correo inválido sin llamar a Supabase', async () => {
    const result = await signUpWithPassword('no-es-un-correo', 'contraseñaLarga1');

    expect(result.error).toBe('Correo inválido.');
    expect(mockedSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña de menos de 8 caracteres sin llamar a Supabase', async () => {
    const result = await signUpWithPassword('ana@example.com', 'corta1');

    expect(result.error).toMatch(/8/);
    expect(mockedSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('con confirmación de correo activa, NO deja sesión iniciada — devuelve needsEmailConfirmation', async () => {
    mockedSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    });

    const result = await signUpWithPassword('ana@example.com', 'contraseñaLarga1');

    expect(result.error).toBeNull();
    expect(result.needsEmailConfirmation).toBe(true);
  });

  it('surfaces the provider error message', async () => {
    mockedSupabase.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });

    const result = await signUpWithPassword('ana@example.com', 'contraseñaLarga1');

    expect(result.error).toBe('User already registered');
  });
});

describe('signInWithPassword', () => {
  it('rechaza un correo inválido sin llamar a Supabase, con el MISMO mensaje genérico', async () => {
    const result = await signInWithPassword('no-es-un-correo', 'algo');

    expect(result.error).toBe('Correo o contraseña incorrectos.');
    expect(mockedSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('entra con credenciales válidas', async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({ error: null });

    const result = await signInWithPassword('ana@example.com', 'contraseñaLarga1');

    expect(result.error).toBeNull();
    expect(mockedSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'contraseñaLarga1',
    });
  });

  it('un correo que no existe da el MISMO mensaje genérico que una contraseña incorrecta', async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    const result = await signInWithPassword('no-registrado@example.com', 'algo12345');

    expect(result.error).toBe('Correo o contraseña incorrectos.');
  });

  it('un correo sin confirmar da el MISMO mensaje genérico — no revela que el correo existe', async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Email not confirmed' },
    });

    const result = await signInWithPassword('ana@example.com', 'contraseñaLarga1');

    expect(result.error).toBe('Correo o contraseña incorrectos.');
  });
});

describe('requestPasswordReset', () => {
  it('responde éxito aunque el correo no exista — nunca revela qué correos están registrados', async () => {
    mockedSupabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'User not found' },
    });

    const result = await requestPasswordReset('no-registrado@example.com');

    expect(result.error).toBeNull();
  });

  it('responde éxito con un correo que sí existe', async () => {
    mockedSupabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await requestPasswordReset('ana@example.com');

    expect(result.error).toBeNull();
    expect(mockedSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it('rechaza un correo con formato inválido sin llamar a Supabase', async () => {
    const result = await requestPasswordReset('no-es-un-correo');

    expect(result.error).toBe('Correo inválido.');
    expect(mockedSupabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('updatePassword', () => {
  it('rechaza una contraseña de menos de 8 caracteres sin llamar a Supabase', async () => {
    const result = await updatePassword('corta1');

    expect(result.error).toMatch(/8/);
    expect(mockedSupabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('fija la nueva contraseña de la sesión activa', async () => {
    mockedSupabase.auth.updateUser.mockResolvedValue({ error: null });

    const result = await updatePassword('contraseñaNuevaLarga1');

    expect(result.error).toBeNull();
    expect(mockedSupabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'contraseñaNuevaLarga1',
    });
  });

  it('surfaces the provider error message', async () => {
    mockedSupabase.auth.updateUser.mockResolvedValue({
      error: { message: 'New password should be different from the old password' },
    });

    const result = await updatePassword('contraseñaNuevaLarga1');

    expect(result.error).toBe('New password should be different from the old password');
  });
});

describe('createProfile', () => {
  it('creates a profile row for the signed-in user with only id and rol', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockedSupabase.from.mockReturnValue({ insert });

    const result = await createProfile('amigo');

    expect(result.error).toBeNull();
    expect(mockedSupabase.from).toHaveBeenCalledWith('profiles');
    expect(insert).toHaveBeenCalledWith({ id: 'user-123', rol: 'amigo' });
  });

  it('errors out if there is no signed-in user', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await createProfile('rentador');

    expect(result.error).toBe('No hay sesión activa.');
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });
});

describe('completeGoogleSignIn', () => {
  it('establece la sesión a partir de una URL de retorno válida', async () => {
    mockedSetSession.mockResolvedValue({ error: null });

    const result = await completeGoogleSignIn(
      'rentafriendperu://redirect#access_token=tok123&refresh_token=ref456',
    );

    expect(mockedSetSession).toHaveBeenCalledWith({
      access_token: 'tok123',
      refresh_token: 'ref456',
    });
    expect(result.error).toBeNull();
  });

  it('devuelve error si la URL no trae access_token', async () => {
    const result = await completeGoogleSignIn('rentafriendperu://redirect#error=access_denied');

    expect(result.error).toBeTruthy();
    expect(mockedSetSession).not.toHaveBeenCalled();
  });

  it('propaga el error de setSession', async () => {
    mockedSetSession.mockResolvedValue({ error: { message: 'token inválido' } });

    const result = await completeGoogleSignIn(
      'rentafriendperu://redirect#access_token=tok123&refresh_token=ref456',
    );

    expect(result.error).toBe('token inválido');
  });
});

describe('completePasswordRecovery', () => {
  it('establece la sesión a partir del fragmento del enlace de recuperación (con # inicial, como window.location.hash)', async () => {
    mockedSetSession.mockResolvedValue({ error: null });

    const result = await completePasswordRecovery(
      '#access_token=tok123&refresh_token=ref456&type=recovery',
    );

    expect(mockedSetSession).toHaveBeenCalledWith({
      access_token: 'tok123',
      refresh_token: 'ref456',
    });
    expect(result.error).toBeNull();
  });

  it('funciona igual sin el # inicial', async () => {
    mockedSetSession.mockResolvedValue({ error: null });

    const result = await completePasswordRecovery('access_token=tok123&refresh_token=ref456');

    expect(mockedSetSession).toHaveBeenCalledWith({
      access_token: 'tok123',
      refresh_token: 'ref456',
    });
    expect(result.error).toBeNull();
  });

  it('devuelve error si el fragmento no trae access_token — enlace vencido o inválido', async () => {
    const result = await completePasswordRecovery('#error=access_denied');

    expect(result.error).toBeTruthy();
    expect(mockedSetSession).not.toHaveBeenCalled();
  });

  it('propaga el error de setSession', async () => {
    mockedSetSession.mockResolvedValue({ error: { message: 'token inválido' } });

    const result = await completePasswordRecovery('#access_token=tok123&refresh_token=ref456');

    expect(result.error).toBe('token inválido');
  });
});

describe('signInWithGoogle', () => {
  const mockedOpenAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;

  it('abre el browser con la URL de autorización y completa la sesión al volver', async () => {
    mockedSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/authorize?...' },
      error: null,
    });
    mockedOpenAuthSession.mockResolvedValue({
      type: 'success',
      url: 'rentafriendperu://redirect#access_token=tok123&refresh_token=ref456',
    });
    mockedSetSession.mockResolvedValue({ error: null });

    const result = await signInWithGoogle();

    expect(mockedSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'rentafriendperu://redirect', skipBrowserRedirect: true },
    });
    expect(mockedOpenAuthSession).toHaveBeenCalledWith(
      'https://accounts.google.com/authorize?...',
      'rentafriendperu://redirect',
    );
    expect(result.error).toBeNull();
  });

  it('devuelve error si el usuario cancela el browser', async () => {
    mockedSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/authorize?...' },
      error: null,
    });
    mockedOpenAuthSession.mockResolvedValue({ type: 'cancel' });

    const result = await signInWithGoogle();

    expect(result.error).toBeTruthy();
    expect(mockedSetSession).not.toHaveBeenCalled();
  });

  it('devuelve error si Supabase no puede iniciar el flujo', async () => {
    mockedSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: 'proveedor no configurado' } });

    const result = await signInWithGoogle();

    expect(result.error).toBe('proveedor no configurado');
    expect(mockedOpenAuthSession).not.toHaveBeenCalled();
  });
});

// En web, `makeRedirectUri()` de expo-auth-session arma el redirect solo con
// `window.location.origin` (SessionUrlProvider.js), sin el sub-path del
// deploy (`experiments.baseUrl`, ej. `/good-company-peru`). Con GitHub Pages
// eso manda a los usuarios a un origin pelado que no tiene sitio de Pages
// propio ("There isn't a GitHub Pages site here") — bug real reproducido
// 2026-08-25. En web hay que armar el redirect a mano con origin + baseUrl.
describe('en web (origin + baseUrl del build, no el origin pelado)', () => {
  const originalWindow = (global as { window?: unknown }).window;

  beforeEach(() => {
    (global as { window?: unknown }).window = {
      location: { origin: 'https://csf156.github.io' },
    };
  });

  afterEach(() => {
    (global as { window?: unknown }).window = originalWindow;
  });

  it('signInWithGoogle usa origin + baseUrl como redirectTo, no el origin pelado', async () => {
    mockedSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/authorize?...' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'https://csf156.github.io/good-company-peru/#access_token=tok123&refresh_token=ref456',
    });
    mockedSetSession.mockResolvedValue({ error: null });

    const result = await signInWithGoogle();

    expect(mockedSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://csf156.github.io/good-company-peru/',
        skipBrowserRedirect: true,
      },
    });
    expect(result.error).toBeNull();
  });

  it('signUpWithPassword pasa emailRedirectTo con origin + baseUrl', async () => {
    mockedSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    });

    await signUpWithPassword('ana@example.com', 'contraseñaLarga1');

    expect(mockedSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'contraseñaLarga1',
      options: { emailRedirectTo: 'https://csf156.github.io/good-company-peru/' },
    });
  });

  it('requestPasswordReset pasa redirectTo con origin + baseUrl', async () => {
    mockedSupabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    await requestPasswordReset('ana@example.com');

    expect(mockedSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('ana@example.com', {
      redirectTo: 'https://csf156.github.io/good-company-peru/',
    });
  });
});

// Criterio de cierre de D.5: el OTP no puede quedar como camino de entrada
// ni por descuido — `grep -rn "signInWithOtp|verifyOtp|requestOtp" app/ lib/
// tests/` tiene que dar cero resultados. Este test lo afirma desde dentro de
// la suite, no solo desde un grep manual.
describe('D.5 — el OTP salió del login', () => {
  it('requestOtp y verifyOtp ya no existen en lib/auth', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const authModule = require('@/lib/auth');
    expect(authModule.requestOtp).toBeUndefined();
    expect(authModule.verifyOtp).toBeUndefined();
  });
});
