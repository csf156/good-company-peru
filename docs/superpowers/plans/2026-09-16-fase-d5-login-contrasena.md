# Fase D.5 — Login con correo y contraseña — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que las únicas formas de entrar sean **correo y contraseña** o **Google**. El OTP deja de ser un método de login.

**Architecture:** `lib/auth.ts` pierde `requestOtp`/`verifyOtp` y gana registro, entrada y recuperación por contraseña. La pantalla de verificación OTP desaparece. Dos ajustes de configuración del proyecto Supabase en la nube hacen que el login por contraseña sea sólido.

**Tech Stack:** Supabase Auth (`signUp`, `signInWithPassword`, `resetPasswordForEmail`, `updateUser`), React Native + Expo Router, Jest + testing-library.

## Decisiones del usuario (2026-09-16)

1. **Los únicos métodos de login son correo+contraseña y Google.** El OTP sale del login.
2. **El OTP pasa a ser segundo factor opcional** — y eso es **la fase D.6, no ésta**. D.5 se partió en dos a propósito.
3. **D.5 va antes de cerrar E.3.** E.3 tiene el código terminado; su revisión la bloquea justamente el login actual, que no permite entrar a las cuentas demo por contraseña.

## Por qué el segundo factor NO va aquí

El usuario eligió el **código por correo** como segundo factor. Supabase solo trae de fábrica **app autenticadora y SMS** ([docs](https://supabase.com/docs/guides/auth/auth-mfa)). Un factor nativo sube la sesión de `aal1` a `aal2`, y **el servidor puede exigirlo**. Un código por correo a medida **no puede subir la sesión**: el token de `aal1` ya es plenamente válido y quien tenga la contraseña se salta la pantalla del código usando la API directamente. Hecho a la ligera, es un segundo factor que no protege nada.

Construirlo bien exige una capa de verificación propia en el servidor. Eso es D.6, diseñada aparte. **No dejes nada a medio hacer de D.6 en esta fase** — ni pantallas, ni columnas, ni ganchos.

## El cambio de seguridad que esta fase NO puede saltarse

**Con el OTP, entrar probaba que el correo era tuyo**: tenías que recibir el código. **Al quitar el OTP esa prueba desaparece.** Con `enable_confirmations = false`, cualquiera puede registrarse con el correo de otra persona y entrar al instante.

**Pasar a contraseña obliga a activar la confirmación de correo.** No es una mejora opcional: sin ella, el cambio que pidió el usuario abre un hueco que hoy no existe.

## Global Constraints

- **Es una fase de seguridad.** Cierra con `security-review` y `requesting-code-review`, como exige `CLAUDE.md`.
- **Nada de D.6.** Ni código por correo, ni pantallas de segundo factor, ni columnas preparadas.
- **Copy en español de Perú, tú informal.** Mensajes de error que no revelen si un correo existe: "Correo o contraseña incorrectos", nunca "ese correo no está registrado". Es la puerta de la enumeración de cuentas.
- **La configuración que manda es la del proyecto en la nube, no `supabase/config.toml`.** Aquí no hay Supabase local; ese archivo puede no reflejar lo que corre.
- **Cambiar la configuración de Auth del proyecto en vivo afecta a todos los usuarios.** Cualquier cambio de configuración de la nube se lo muestras **al usuario** y lo aprueba **él**, no BRAIN.
- Rutas explícitas en `git add`. Nunca `-A`, nunca `--amend`, sin push. `git diff tsconfig.json` antes de cada commit. Commits por `-F`.
- **El código de este plan es una hipótesis.** Si un test y el snippet se contradicen, gana el test — y avísame.

---

## Estado de partida (verificado por BRAIN, 2026-09-16)

**Cuentas existentes — nadie queda atrapado:**

| Cuenta | Correo | Teléfono | Contraseña | Proveedor |
|---|---|---|---|---|
| Real 1 | sí | no | **sí** | email, google |
| Real 2 | sí | no | no | google |
| 6 demo | sí | no | **sí** | — |
| 2 demo | sí | no | no | — |

**Ninguna cuenta está registrada solo con teléfono**, así que quitar el OTP por SMS no deja a nadie sin entrada. Las que no tienen contraseña entran con Google o pueden fijarla con la recuperación.

**Configuración local** (`supabase/config.toml`, **a verificar contra la nube**): `enable_confirmations = false`, `minimum_password_length = 6`, `password_requirements = ""`, `secure_password_change = false`.

**Superficie a tocar:** `lib/auth.ts` (142 líneas), `app/(auth)/sign-in.tsx` (123), `app/(auth)/verify-otp.tsx` (140, **se elimina**), `lib/route-guard.ts` (61), y sus tests.

---

## Task 1: Leer la configuración real de la nube, antes de nada

**No escribas código hasta tener esto.** Todo el plan depende de qué dice de verdad el proyecto en vivo.

- [ ] **Step 1: Obtener los valores reales** del proyecto `zmtclismywmkratmufov` — panel de Supabase o API de gestión, lo que tengas a mano. Los cuatro que importan:
  - confirmación de correo activada o no
  - longitud mínima de contraseña
  - requisitos de contraseña
  - si cambiar la contraseña exige reautenticación
- [ ] **Step 2: Comprobar que las cuentas demo tienen el correo confirmado**

```sql
select u.email, u.email_confirmed_at is not null as confirmado
  from auth.users u join public.profiles p on p.id = u.id
 where p.flags->>'demo' = 'true';
```

**Esto es crítico y es fácil pasarlo por alto.** Si activas la confirmación de correo y las cuentas demo **no** están confirmadas, **el usuario pierde el acceso justo a las cuentas que necesita para revisar E.3** — que es la razón por la que esta fase va primero. Sus correos son `@martini.test` y no reciben nada.

- [ ] **Step 3: Reportarme los valores reales** antes de seguir.

---

## Task 2: Los cambios de configuración de la nube

**Requiere aprobación del usuario.** Afecta a todas las cuentas del proyecto en vivo.

Propónle al usuario, con los valores actuales al lado:

1. **Confirmación de correo: activada.** Es la que sustituye la prueba de propiedad del correo que daba el OTP.
2. **Contraseña mínima: 8 caracteres.** Hoy son 6.

Deja **fuera** de esta fase los requisitos de complejidad y la reautenticación al cambiar contraseña: son decisiones de producto razonables, pero no son condición para que el login funcione de forma segura. Anótalas en backlog.

- [ ] **Step 1:** Si el Step 2 de la Tarea 1 mostró cuentas demo sin confirmar, **confírmalas antes de activar la confirmación** — si no, el usuario se queda fuera. Es una escritura sobre `auth.users` de cuentas demo: díselo al usuario al pedirle la aprobación.
- [ ] **Step 2:** Aplicar los dos cambios, con aprobación del usuario.
- [ ] **Step 3:** Refleja los mismos valores en `supabase/config.toml` para que el archivo deje de mentir sobre la nube.
- [ ] **Step 4:** Commit del `config.toml`.

---

## Task 3: `lib/auth.ts` — contraseña dentro, OTP fuera

**Files:**
- Modify: `lib/auth.ts`, `tests/lib/auth.test.ts`

**Interfaces:**

```ts
export async function signUpWithPassword(email: string, password: string): Promise<AuthResult>;
export async function signInWithPassword(email: string, password: string): Promise<AuthResult>;
export async function requestPasswordReset(email: string): Promise<AuthResult>;
export async function updatePassword(newPassword: string): Promise<AuthResult>;
// se conservan: signInWithGoogle, completeGoogleSignIn, createProfile
// se eliminan: requestOtp, verifyOtp, y todo el camino de teléfono de normalizeContact
```

- [ ] **Step 1: Tests que fallan.** Cubre como mínimo:
  - Un correo inválido o una contraseña de menos de 8 se rechazan **en el cliente**, sin llamar a Supabase.
  - Un error de credenciales de Supabase se traduce a **un único mensaje**: "Correo o contraseña incorrectos". **Nunca** "ese correo no existe" ni "contraseña incorrecta" por separado — eso permite averiguar qué correos están registrados.
  - `requestPasswordReset` devuelve éxito **aunque el correo no exista**, por la misma razón.
  - `signUpWithPassword` con confirmación activa **no deja sesión iniciada**: devuelve un estado de "revisa tu correo".
  - `requestOtp` y `verifyOtp` **ya no existen** — que el test lo afirme, para que nadie los resucite.
- [ ] **Step 2: Rojo → Step 3: implementar → Step 4: verde → Step 5: commit**

---

## Task 4: Las pantallas

**Files:**
- Modify: `app/(auth)/sign-in.tsx` → entrar **o** crear cuenta, con correo+contraseña, y Google
- Delete: `app/(auth)/verify-otp.tsx` y `tests/app/verify-otp.test.tsx`
- Create: `app/(auth)/recuperar.tsx` (pedir el correo de recuperación) y `app/(auth)/nueva-contrasena.tsx` (fijarla tras el enlace)
- Modify: `lib/route-guard.ts` y su test — `verify-otp` sale de `AuthSegment` y de las pantallas permitidas sin sesión; entran las dos nuevas

- [ ] **Step 1: Tests que fallan.** Cubre como mínimo:
  - La pantalla ofrece **exactamente dos** formas de entrar: correo+contraseña y Google. **Ningún** campo de teléfono, **ningún** "enviar código".
  - Tras crear cuenta con confirmación activa, la pantalla dice que **revise su correo** y no entra.
  - "¿Olvidaste tu contraseña?" lleva a recuperar.
  - El botón queda deshabilitado mientras la llamada está en vuelo — misma lección del doble toque de E.3.
  - El guardián ya **no** acepta `verify-otp` y **sí** acepta las dos rutas nuevas sin sesión.
- [ ] **Step 2: Rojo → Step 3: implementar → Step 4: verde → Step 5: commit**

> **El enlace de los correos de confirmación y de recuperación tiene que volver a la app.** En web ya existe `webRedirectUri()`. Si no puedes verificar el camino nativo en esta máquina, **dilo en el reporte en vez de darlo por hecho**.

---

## Task 5: Poner las cuentas demo en condiciones de revisar E.3

Es la razón por la que D.5 va primero, así que se comprueba explícitamente.

- [ ] **Step 1:** Las 6 cuentas demo que ya tienen contraseña **entran por la pantalla nueva**, en el navegador, de verdad. Al menos una de rol rentador y una de amigo.
- [ ] **Step 2:** Pásale al usuario, en su chat, **qué cuenta es rentador, cuál amigo y sus contraseñas**. Ya no deberías tener que entrar tú por la API para que él revise.

---

## Cierre de D.5

- [ ] Las cuatro suites, salida real pegada.
- [ ] **Criterio objetivo de cierre:**

```bash
grep -rn "signInWithOtp\|verifyOtp\|requestOtp\|verify-otp" app/ lib/ tests/
```

**Cero resultados.** El OTP no puede quedar como camino de entrada ni por descuido.

- [ ] **Verificación real en el navegador:** crear una cuenta nueva, comprobar que pide confirmar el correo; entrar con una cuenta demo; pedir recuperación de contraseña.
- [ ] **`security-review` sobre la rama**, y sus hallazgos al reporte. Esta fase toca autenticación.
- [ ] `git diff tsconfig.json` limpio. **Sin push. No cierres la fase** — y recuerda que después va la revisión de E.3 del usuario.

---

## A backlog, no a esta fase

- Requisitos de complejidad de contraseña.
- Reautenticación para cambiar la contraseña (`secure_password_change`).
- **D.6 — segundo factor opcional por correo**, con la capa de verificación en el servidor que hace falta para que proteja algo.
