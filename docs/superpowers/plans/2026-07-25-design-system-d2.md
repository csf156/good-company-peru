# Fase D.2 — Login con Google

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el usuario pueda entrar con su cuenta de Google, además del OTP por correo ya existente. Se retira la pestaña "Celular" del login, que hoy ofrece un camino que siempre falla (proveedor de SMS nunca habilitado).

**Architecture:** Patrón oficial de Supabase para Expo/React Native (`docs/guides/auth/native-mobile-deep-linking`), el mismo código sirve para nativo y web: `supabase.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } })` obtiene la URL de autorización sin redirigir automáticamente; `expo-web-browser` abre esa URL en un browser controlado y espera el callback; al volver, se parsean los tokens de la URL de retorno y se establece la sesión con `supabase.auth.setSession()`. Cero lógica de OAuth específica de Google vive en el cliente — Supabase la resuelve server-side; el cliente solo maneja la URL de ida y vuelta.

**Tech Stack:** `expo-auth-session` (nuevo) · `expo-web-browser` (nuevo) · `@supabase/supabase-js` 2.110 (ya instalado) · Jest + @testing-library/react-native

**Spec:** [`docs/superpowers/specs/2026-07-24-design-system-lovable-design.md`](../specs/2026-07-24-design-system-lovable-design.md) §6

---

## Global Constraints

- **El OTP por correo se conserva intacto.** `requestOtp`/`verifyOtp` en `lib/auth.ts` no cambian su firma ni su comportamiento.
- **Se retira la pestaña "Celular"** de `app/(auth)/sign-in.tsx` — hoy ofrece un camino que siempre falla (`external_phone_enabled: false` en el proyecto Supabase, verificado). Esto SÍ es un cambio de comportamiento intencional (a diferencia de D.1, que era solo visual) — los tests de esta pantalla se actualizan para reflejarlo.
- **Sin columna nueva en `profiles`.** Sin verificación de celular en esta fase (decisión tomada en D.1 — ver spec §6.2).
- **`lib/route-guard.ts` no cambia.** La máquina de estados (`hasSession` → `profileStatus` → `kycEstado`) sigue igual; los tests actuales de `tests/lib/route-guard.test.ts` deben pasar sin tocarse.
- **Cero secretos de Google en el cliente.** El client ID/secret vive solo en la config de Supabase (dashboard), nunca en el código de la app.
- **Idioma:** UI en español de Perú, informal "tú". Código y commits en inglés técnico.
- **Commits:** Conventional Commits. No push salvo que el usuario lo pida explícitamente al cerrar la fase.
- **Cierre de cada tarea:** `npm run lint` + `npm run typecheck` + `npm test` en verde.
- **Prerrequisito externo (ver §"Antes de empezar" más abajo):** el usuario debe habilitar el provider de Google en el dashboard de Supabase antes de que la Tarea 4 (verificación manual) pueda completarse. Las Tareas 1-3 no lo requieren — son código y tests con mocks.

---

## Antes de empezar — lo único que el usuario debe hacer manualmente

Nada de esto lo puede hacer un agente (son credenciales y configuración de cuenta). Son los mismos pasos ya explicados antes en la conversación; se repiten aquí para que el plan sea autocontenido.

### En Google Cloud Console (https://console.cloud.google.com)

1. Crea un proyecto (o usa uno existente), por ejemplo llamado `ayni`.
2. Ve a **Google Auth Platform → Branding**. Completa nombre de la app (`Ayni`), correo de soporte, dominio. Tipo de usuario: **External**.
3. Ve a **Audience**. Mientras la app esté en modo *Testing*, agrega ahí (como "Test users") los correos de las personas que van a poder entrar con Google — máximo 100. Alternativa: publicar la app (con los scopes básicos de perfil/email no exige verificación de Google).
4. Ve a **Clients → Create client** → tipo **Web application**.
5. En **Authorized JavaScript origins**, agrega:
   ```
   https://zmtclismywmkratmufov.supabase.co
   https://csf156.github.io
   ```
6. En **Authorized redirect URIs**, agrega exactamente:
   ```
   https://zmtclismywmkratmufov.supabase.co/auth/v1/callback
   ```
7. Crea el cliente. Copia el **Client ID** y el **Client Secret** — los necesitas en el siguiente paso.

### En el dashboard de Supabase (https://supabase.com/dashboard)

8. Entra al proyecto `amigos-app` → **Authentication** → **Sign In / Providers** → **Google**.
9. Actívalo (toggle). Pega el Client ID y el Client Secret del paso 7. Guarda.

**No hace falta hacer esto antes de que los agentes trabajen** — las Tareas 1-3 escriben código y tests con la sesión de Supabase mockeada, no llaman a Google de verdad. Solo hace falta **antes de que tú pruebes el botón "Continuar con Google" en el preview real** (Tarea 4, verificación manual).

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `package.json` | `expo-auth-session`, `expo-web-browser` | 1 |
| `lib/auth.ts` | `signInWithGoogle()`, `completeGoogleSignIn()` | 2 |
| `app/(auth)/sign-in.tsx` | Botón "Continuar con Google"; retiro de la pestaña Celular | 3 |
| `tests/app/sign-in.test.tsx` | Reescrito: sin pestaña Celular, con el flujo de Google | 3 |
| `tests/lib/auth.test.ts` | Tests de `signInWithGoogle`/`completeGoogleSignIn` con mocks | 2 |

---

## Task 1: Instalar dependencias de OAuth

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: `expo-auth-session` (`makeRedirectUri`), `expo-web-browser` (`openAuthSessionAsync`, `maybeCompleteAuthSession`) instalados y disponibles para la Tarea 2.

- [ ] **Step 1: Instalar**

```bash
npm install expo-auth-session expo-web-browser --legacy-peer-deps
```

- [ ] **Step 2: Verificar que no rompió nada**

```bash
npm run lint
npm run typecheck
npm test
```

Esperado: los tres en verde, mismo conteo de tests que antes (esta tarea no toca código de la app, solo dependencias).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: instalar expo-auth-session y expo-web-browser"
```

---

## Task 2: `signInWithGoogle` y `completeGoogleSignIn` en `lib/auth.ts`

**Files:**
- Modify: `lib/auth.ts`
- Test: `tests/lib/auth.test.ts` (ampliar el existente)

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase` (ya existente). `makeRedirectUri` de `expo-auth-session`. `openAuthSessionAsync`, `maybeCompleteAuthSession` de `expo-web-browser`. `getQueryParams` de `expo-auth-session/build/QueryParams`.
- Produces: `signInWithGoogle(): Promise<AuthResult>` — inicia el flujo completo (abre el browser, espera el resultado, establece la sesión). `completeGoogleSignIn(url: string): Promise<AuthResult>` — función separada y pura-testeable que parsea una URL de retorno y llama `supabase.auth.setSession`; `signInWithGoogle` la usa internamente, pero exponerla aparte permite testear el parseo sin mockear `WebBrowser`.

- [ ] **Step 1: Escribir los tests que fallan**

El archivo `tests/lib/auth.test.ts` **ya existe** con este contenido exacto (mockea `@/lib/supabase` con `signInWithOtp`/`verifyOtp`/`getUser`/`from`). Hay que **extender ese mismo mock** (agregar `signInWithOAuth` y `setSession` al objeto `auth`) y agregar los mocks nuevos de `expo-web-browser`/`expo-auth-session`. Reemplazar el bloque `jest.mock('@/lib/supabase', ...)` + el tipo `mockedSupabase` existente por:

```ts
import * as WebBrowser from 'expo-web-browser';
import { requestOtp, verifyOtp, createProfile, signInWithGoogle, completeGoogleSignIn } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

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
```

**No tocar** el resto del archivo (`describe('requestOtp', ...)`, `describe('verifyOtp', ...)`, `describe('createProfile', ...)`) — se conservan tal cual, ya pasan. Agregar los dos `describe` nuevos al final del archivo:

```ts
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
```

En la cabecera del archivo existente, junto a los mocks de `@/lib/supabase` que ya haya, agregar (si no existen ya) los mocks de `signInWithOAuth`/`setSession`:

```ts
const mockedSignInWithOAuth = jest.fn();
const mockedSetSession = jest.fn();
// dentro del jest.mock('@/lib/supabase', ...) existente, añadir a supabase.auth:
//   signInWithOAuth: mockedSignInWithOAuth,
//   setSession: mockedSetSession,
```

(Ajustar a la forma exacta del mock ya presente en el archivo — leerlo primero.)

- [ ] **Step 2: Correr para verificar que fallan**

```bash
npx jest tests/lib/auth.test.ts
```

Esperado: FAIL — `signInWithGoogle`/`completeGoogleSignIn` no existen todavía.

- [ ] **Step 3: Implementar en `lib/auth.ts`**

Agregar al inicio del archivo (después de los imports existentes):

```ts
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

// Requerido por expo-web-browser en web para cerrar el flujo de auth al volver.
WebBrowser.maybeCompleteAuthSession();
```

Agregar al final del archivo:

```ts
/**
 * Establece la sesión de Supabase a partir de la URL de retorno del flujo
 * OAuth (contiene access_token/refresh_token en el fragmento `#`). Separada
 * de signInWithGoogle para poder testear el parseo sin mockear WebBrowser.
 */
export async function completeGoogleSignIn(url: string): Promise<AuthResult> {
  const fragment = url.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return { error: 'No se pudo completar el ingreso con Google.' };
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return { error: error?.message ?? null };
}

/** Inicia sesión con Google: abre el navegador, espera el resultado, establece la sesión. */
export async function signInWithGoogle(): Promise<AuthResult> {
  const redirectTo = makeRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return { error: error?.message ?? 'No se pudo iniciar el ingreso con Google.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    return { error: 'Ingreso con Google cancelado.' };
  }

  return completeGoogleSignIn(result.url);
}
```

- [ ] **Step 4: Correr los tests**

```bash
npx jest tests/lib/auth.test.ts
```

Esperado: PASS, todos los tests (los ya existentes de `requestOtp`/`verifyOtp`/`createProfile` + los 6 nuevos).

- [ ] **Step 5: Suite completa**

```bash
npm run lint
npm run typecheck
npm test
```

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts tests/lib/auth.test.ts
git commit -m "feat: signInWithGoogle y completeGoogleSignIn en lib/auth"
```

---

## Task 3: Botón de Google en `sign-in.tsx`, retiro de la pestaña Celular

**Files:**
- Modify: `app/(auth)/sign-in.tsx`
- Modify: `tests/app/sign-in.test.tsx` (reescritura parcial — a diferencia de D.1, aquí SÍ cambia comportamiento)

**Interfaces:**
- Consumes: `signInWithGoogle` de `@/lib/auth` (Tarea 2).

- [ ] **Step 1: Leer el archivo actual completo** (`app/(auth)/sign-in.tsx` y su test) antes de tocar nada — el diseño visual (tokens, eyebrow, título) ya está migrado por D.1 y no debe tocarse, solo la estructura de tabs/botones.

- [ ] **Step 2: Reescribir el test**

Reemplazar los tests que dependen de la pestaña "Celular" (`'defaults to phone mode and validates a Peru number'`) — ya no existe esa pestaña. El test de validación de correo, envío de OTP y manejo de error se mantienen (ajustando que ya no hay que tocar la pestaña "Correo" porque es el único modo). Agregar un test nuevo para el botón de Google:

```ts
import { requestOtp, signInWithGoogle } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  requestOtp: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

const mockedSignInWithGoogle = signInWithGoogle as jest.Mock;
```

```ts
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
```

Quitar del archivo de test cualquier referencia a `getByText('Celular')` o al modo teléfono. El campo de texto pasa a ser siempre de correo (ya no hay `contactType` que alternar) — ajustar los tests de envío de OTP para que ya no necesiten `fireEvent.press(screen.getByText('Correo'))` primero (ese tab desaparece).

- [ ] **Step 3: Correr para confirmar que falla**

```bash
npx jest tests/app/sign-in.test.tsx
```

- [ ] **Step 4: Reescribir `app/(auth)/sign-in.tsx`**

Quitar el estado `contactType` y toda la UI de tabs. El formulario pasa a ser: input de correo siempre visible, botón "Enviar código", separador, botón "Continuar con Google". Mantener el mismo `Screen`/eyebrow/título ya migrados en D.1 — solo cambia el cuerpo.

```tsx
import { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { requestOtp, signInWithGoogle } from '@/lib/auth';
import { isValidEmail } from '@/lib/validation';
import { colors, radius, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

export default function SignInScreen() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!isValidEmail(value)) {
      setError('Correo inválido.');
      return;
    }

    setLoading(true);
    const result = await requestOtp({ type: 'email', value });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push({
      pathname: '/(auth)/verify-otp',
      params: { type: 'email', value },
    });
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    setGoogleLoading(false);

    if (result.error) {
      setError(result.error);
    }
    // Si no hay error, supabase.auth.setSession() dispara onAuthStateChange,
    // que useAuthSession() escucha; app/_layout.tsx reacciona a ese cambio de
    // sesión y redirige solo — no hace falta router.replace aquí.
  }

  return (
    <Screen scroll center contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Bienvenido</Text>
      <Text style={styles.title}>Ingresa a tu cuenta</Text>

      <TextInput
        style={styles.input}
        placeholder="tu@correo.com"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="email-address"
        autoCapitalize="none"
        value={value}
        onChangeText={setValue}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Enviar código" onPress={handleSubmit} disabled={loading || googleLoading} />

      <Text style={styles.separator}>o</Text>

      <Button
        label="Continuar con Google"
        variant="secondary"
        onPress={handleGoogle}
        disabled={loading || googleLoading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[6],
    gap: spacing[4],
  },
  eyebrow: {
    ...textStyles.label,
    fontSize: fontSize.caption,
    color: colors.primary,
  },
  title: {
    ...textStyles.displaySemiBold,
    fontSize: fontSize.display,
    color: colors.foreground,
    marginBottom: spacing[2],
  },
  input: {
    ...textStyles.body,
    fontSize: fontSize.bodyLg,
    color: colors.foreground,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    minHeight: 44,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  error: {
    ...textStyles.body,
    color: colors.destructiveText,
  },
  separator: {
    ...textStyles.label,
    fontSize: fontSize.tiny,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
```

(`radius`/`spacing`/`fontSize`/`textStyles` ya vienen de `lib/theme.ts` desde D.1 — no crear nada nuevo ahí.)

- [ ] **Step 5: Correr los tests**

```bash
npx jest tests/app/sign-in.test.tsx
```

Esperado: PASS.

- [ ] **Step 6: `npm run lint && npm run typecheck`**

- [ ] **Step 7: Commit**

```bash
git add "app/(auth)/sign-in.tsx" tests/app/sign-in.test.tsx
git commit -m "feat: boton de Google en sign-in, retiro de la pestana Celular"
```

---

## Task 4: Verificación manual (no automatizable)

Esta tarea no la ejecuta un subagente — requiere que el usuario haya completado la configuración de Google Cloud + Supabase (sección "Antes de empezar") y pruebe el flujo real.

- [ ] Confirmar con el usuario que completó los 9 pasos manuales.
- [ ] Desplegar el preview web (`git push origin master` ya dispara el workflow de GitHub Pages) y probar "Continuar con Google" en `https://csf156.github.io/good-company-peru/`.
- [ ] Si algo fallara en el preview web (redirect_uri_mismatch, popup bloqueado, etc.), reportarlo — no es un fallo de test automatizado, es configuración externa.

---

## Cierre de la fase D.2

```bash
npm run lint; npm run typecheck; npm test
```

No cerrar la fase en `docs/ESTADO.md` por cuenta propia — solo cuando el usuario diga "fase concluida".
