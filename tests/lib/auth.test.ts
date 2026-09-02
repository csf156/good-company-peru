import * as WebBrowser from 'expo-web-browser';
import { requestOtp, verifyOtp, createProfile, signInWithGoogle, completeGoogleSignIn } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { experiments: { baseUrl: '/good-company-peru' } } },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
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
    signInWithOtp: jest.Mock;
    verifyOtp: jest.Mock;
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

describe('requestOtp', () => {
  it('sends an OTP to a valid email', async () => {
    mockedSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });

    const result = await requestOtp({ type: 'email', value: 'ana@example.com' });

    expect(result.error).toBeNull();
    expect(mockedSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
    });
  });

  it('normalizes and sends an OTP to a valid Peru phone', async () => {
    mockedSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });

    const result = await requestOtp({ type: 'phone', value: '987654321' });

    expect(result.error).toBeNull();
    expect(mockedSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '+51987654321',
    });
  });

  it('rejects an invalid email without calling supabase', async () => {
    const result = await requestOtp({ type: 'email', value: 'not-an-email' });

    expect(result.error).toBe('Correo inválido.');
    expect(mockedSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('rejects an invalid phone without calling supabase', async () => {
    const result = await requestOtp({ type: 'phone', value: '12345' });

    expect(result.error).toBe('Número de celular inválido.');
    expect(mockedSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('surfaces the provider error message', async () => {
    mockedSupabase.auth.signInWithOtp.mockResolvedValue({
      error: { message: 'rate limit exceeded' },
    });

    const result = await requestOtp({ type: 'email', value: 'ana@example.com' });

    expect(result.error).toBe('rate limit exceeded');
  });
});

describe('verifyOtp', () => {
  it('verifies a phone OTP with the sms type', async () => {
    mockedSupabase.auth.verifyOtp.mockResolvedValue({ error: null });

    const result = await verifyOtp({ type: 'phone', value: '987654321' }, '123456');

    expect(result.error).toBeNull();
    expect(mockedSupabase.auth.verifyOtp).toHaveBeenCalledWith({
      phone: '+51987654321',
      token: '123456',
      type: 'sms',
    });
  });

  it('verifies an email OTP with the email type', async () => {
    mockedSupabase.auth.verifyOtp.mockResolvedValue({ error: null });

    const result = await verifyOtp({ type: 'email', value: 'ana@example.com' }, '654321');

    expect(result.error).toBeNull();
    expect(mockedSupabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      token: '654321',
      type: 'email',
    });
  });

  it('surfaces an invalid/expired token error', async () => {
    mockedSupabase.auth.verifyOtp.mockResolvedValue({
      error: { message: 'Token has expired or is invalid' },
    });

    const result = await verifyOtp({ type: 'email', value: 'ana@example.com' }, '000000');

    expect(result.error).toBe('Token has expired or is invalid');
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

  it('requestOtp por correo pasa emailRedirectTo con origin + baseUrl', async () => {
    mockedSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });

    const result = await requestOtp({ type: 'email', value: 'ana@example.com' });

    expect(result.error).toBeNull();
    expect(mockedSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      options: { emailRedirectTo: 'https://csf156.github.io/good-company-peru/' },
    });
  });

  it('requestOtp por celular no manda emailRedirectTo (no aplica a SMS)', async () => {
    mockedSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });

    const result = await requestOtp({ type: 'phone', value: '987654321' });

    expect(result.error).toBeNull();
    expect(mockedSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '+51987654321',
    });
  });
});
