# Fase D.4 — Carrusel, ToS y costura de referidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el onboarding: explicar el concepto antes del registro, obligar a aceptar los términos de forma verificable y persistida, y capturar el referido para que la fase 9 no tenga que rehacer el alta.

**Architecture:** Un escalón nuevo en el guardián de rutas (`computeRedirect`), entre "elegir rol" y "completar perfil", que exige tener aceptada la **versión vigente** del ToS. La aceptación se guarda en una tabla append-only (no en una columna), porque cuando el texto cambie habrá que re-pedirla y la fase 7.5 necesita el histórico. El carrusel vive antes del sign-in y se recuerda en el almacenamiento del dispositivo, fuera del guardián: leer ese almacenamiento es asíncrono y `computeRedirect` es una función pura y sincrónica que debe seguir siéndolo.

**Tech Stack:** React Native + Expo Router · `@react-native-async-storage/async-storage` (ya instalado, lo usa `lib/supabase.ts`) · Supabase (Postgres + RLS) · Jest + @testing-library/react-native · pgTAP

## Global Constraints

- **Sin dependencias nuevas.** `@react-native-async-storage/async-storage` ya es dependencia directa y ya se usa en `lib/supabase.ts:2`. No instalar nada más.
- **El código de este plan es una hipótesis, no verdad verificada.** Se escribió sin ejecutarse. **Si un test y el código de referencia se contradicen, gana el test** — y avisa al controlador. En la fase D.3 el plan traía dos bugs reales que solo aparecieron al ejecutarlo; no transcribas, verifica.
- **Español de Perú, informal "tú"** en todo el copy de UI.
- **Estados con icono + texto**, nunca solo color. Contraste AA. Targets ≥44dp (`touchTarget` de `lib/theme`).
- **Rojo solo para error.** Nunca decorativo.
- **Tokens de `lib/theme` siempre** (`colors`, `spacing`, `fontSize`, `textStyles`); nunca colores literales — hay un lint que lo vigila.
- **El usuario revisa el SQL antes de aplicar** (Tarea 1). Migración versionada, nunca por editor SQL suelto.
- **RLS estricto** en la tabla nueva, con pgTAP de aislamiento. `update` y `delete` revocados al cliente.
- **TDD:** test que falla → implementación mínima → verde → commit.
- **Antes de cualquier commit:** revisar `git diff tsconfig.json` y revertir con `git checkout tsconfig.json` si Expo lo reescribió. Rutas explícitas en `git add`, nunca `-A`. Nada de `git commit --amend`.
- **Cierre:** `npm run lint` + `npm run typecheck` + `npm test` + `npm run test:db` verdes, con la salida mostrada. **Sin push.**
- **No tocar `docs/ESTADO.md` ni `FASE ACTUAL`.** El cierre lo declara el usuario.

---

## Contexto: lo que ya existe (verificado por introspección, 2026-09-06)

| Pieza | Dónde | Forma exacta |
|---|---|---|
| Guardián | `lib/route-guard.ts` | `computeRedirect({hasSession, profileStatus, kycEstado, authSegment})` → `string \| null` |
| Orden actual | idem | sin sesión → `sign-in` · `profileStatus 'none'` → `select-role` · `'incomplete'` → `profile-setup` · `kycEstado !== 'verificado'` → `kyc` · resto → home |
| Pantallas toleradas sin sesión | idem | `allowedWhileSigningIn = ['sign-in', 'verify-otp']` |
| Estado del guardián | `app/_layout.tsx` | `aplicarPerfil(profile)` fija `profileStatus` y `kycEstado`; el efecto `[session, aplicarPerfil]` llama `getOwnProfile()`; `refreshProfile()` devuelve la promesa para que la pantalla la espere antes de navegar |
| `Button` | `components/Button.tsx` | `{label, variant?: 'primary' \| 'secondary', disabled?, onPress?}` |
| `Screen` | `components/Screen.tsx` | `{children, background?, scroll?, center?, contentStyle?, textured?}` |
| `StepHeader` | `components/StepHeader.tsx` | `{paso, total, titulo, onVolver?}` |
| `Icon` | `components/Icon.tsx` | `{name, size, tone?}` — set MaterialCommunityIcons |
| AsyncStorage | `lib/supabase.ts:2` | ya importado y en uso |
| pgTAP | `supabase/tests/` | último fichero: `26_revoke_truncate_default.sql` → el siguiente es **27** |
| Prefijos de migración | `supabase/migrations/` | sin colisiones hoy |

**Por qué la pantalla de ToS va después de `select-role` y no antes:** la fila de `profiles` **no existe** hasta que `select-role` la crea (eso es `profileStatus === 'none'`). Antes de ese punto no hay dónde persistir la aceptación.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `supabase/migrations/20260906130000_tos_y_referido.sql` | Tabla `tos_aceptaciones` + columna `profiles.referido_por` | 1 |
| `supabase/tests/27_tos_aceptaciones.sql` | pgTAP: RLS, append-only, columna de referido | 1 |
| `lib/tos.ts` | Versión vigente, texto, `getTosAceptado`, `aceptarTos` | 2 |
| `tests/lib/tos.test.ts` | Cobertura de lo anterior | 2 |
| `lib/route-guard.ts` | Escalón nuevo + `AuthSegment` ampliado | 3 |
| `app/_layout.tsx` | Carga y refresco del estado de ToS | 3 |
| `app/(auth)/tos.tsx` | Pantalla de aceptación | 4 |
| `lib/carrusel.ts` | Marca de "ya visto" en el dispositivo | 5 |
| `app/(auth)/carrusel.tsx` | Las cuatro slides | 5 |
| `app/(auth)/profile-setup.tsx` | Campo opcional de referido | 6 |

---

## Task 1: Esquema — aceptaciones de ToS y columna de referido

**Files:**
- Create: `supabase/migrations/20260906130000_tos_y_referido.sql`
- Create: `supabase/tests/27_tos_aceptaciones.sql`

**Interfaces:**
- Produces: tabla `public.tos_aceptaciones` con `perfil_id uuid`, `version text`, `aceptado_at timestamptz`; y `public.profiles.referido_por text` nullable. La Tarea 2 lee y escribe la tabla; la Tarea 6 escribe la columna.

- [ ] **Step 1: Verificar que el prefijo no colisiona**

El runner (`tests/db/apply-migrations.mjs`) deriva la versión del prefijo del nombre y **salta en silencio** una migración cuyo prefijo ya esté aplicado.

```bash
ls supabase/migrations/ | cut -d_ -f1 | sort | uniq -d
```

Salida esperada: vacía. Si `20260906130000` ya existiera, elige otro timestamp y ajústalo en todos los pasos.

- [ ] **Step 2: Escribir el pgTAP primero (RED)**

Crea `supabase/tests/27_tos_aceptaciones.sql`, siguiendo el estilo de los vecinos (`begin;` / `select plan(N);` / aserciones / `select * from finish();` / `rollback;`).

```sql
begin;
select plan(7);

-- Dos perfiles para probar el aislamiento entre usuarios.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'tos-a@ayni.test', '', now(), now(), now()),
       ('00000000-0000-0000-0000-0000000000a2'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'tos-b@ayni.test', '', now(), now(), now());

insert into public.profiles (id, rol) values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'amigo'),
  ('00000000-0000-0000-0000-0000000000a2'::uuid, 'rentador');

select has_table('public', 'tos_aceptaciones', 'existe la tabla tos_aceptaciones');
select has_column('public', 'profiles', 'referido_por', 'profiles tiene la columna referido_por');

-- El cliente no puede mutar ni borrar: la aceptacion es evidencia, no estado.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'tos_aceptaciones'
      and grantee = 'authenticated' and privilege_type in ('UPDATE', 'DELETE')),
  0,
  'authenticated no tiene UPDATE ni DELETE sobre tos_aceptaciones'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'tos_aceptaciones'
      and grantee = 'authenticated' and privilege_type in ('SELECT', 'INSERT')),
  2,
  'authenticated conserva SELECT e INSERT'
);

-- RLS encendida y con una policy por operacion permitida.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tos_aceptaciones'::regclass),
  'tos_aceptaciones tiene RLS habilitada'
);
select is(
  (select count(*)::int from pg_policy where polrelid = 'public.tos_aceptaciones'::regclass),
  2,
  'tos_aceptaciones tiene exactamente dos policies (select propio, insert propio)'
);

-- Aislamiento real: A no ve la aceptacion de B.
insert into public.tos_aceptaciones (perfil_id, version)
values ('00000000-0000-0000-0000-0000000000a2'::uuid, 'v1');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
select is(
  (select count(*)::int from public.tos_aceptaciones),
  0,
  'un usuario no ve la aceptacion de otro'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 3: Correr y verificar que FALLA**

```bash
set -a; . ./.env; set +a; npm run test:db
```

Esperado: el fichero 27 falla — la tabla no existe todavía.

- [ ] **Step 4: Escribir la migración**

Crea `supabase/migrations/20260906130000_tos_y_referido.sql`:

```sql
-- Aceptacion de terminos, como EVIDENCIA append-only y no como estado.
-- Cuando el texto cambie habra que re-pedir la aceptacion, y una columna en
-- profiles perderia la anterior. La fase 7.5 (ToS enforcement) necesita el
-- historico completo -- "acepto la v1 en tal fecha, la v2 en tal otra" --, no
-- el ultimo valor. Mismo criterio que el ledger de la fase 3.0.
create table public.tos_aceptaciones (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  version text not null,
  aceptado_at timestamptz not null default now()
);

create index tos_aceptaciones_perfil_idx
  on public.tos_aceptaciones (perfil_id, aceptado_at desc);

alter table public.tos_aceptaciones enable row level security;

-- Cada quien ve e inserta solo lo suyo. La aceptacion de otro no es asunto
-- de nadie. Mismo patron que onboarding_eventos (fase D.3).
create policy tos_aceptaciones_select_own on public.tos_aceptaciones
  for select to authenticated
  using (perfil_id = auth.uid());

create policy tos_aceptaciones_insert_own on public.tos_aceptaciones
  for insert to authenticated
  with check (perfil_id = auth.uid());

-- Append-only para el cliente, igual que el ledger y onboarding_eventos.
revoke update, delete on public.tos_aceptaciones from authenticated;
grant select, insert on public.tos_aceptaciones to authenticated;

-- Sin sesion no se toca nada de esto.
revoke select, insert, update, delete on public.tos_aceptaciones from anon;

-- Costura de referidos (fase 9.1): se captura en el alta y NADA la lee
-- todavia. El momento de capturar un referido es el registro y no vuelve;
-- sin esta columna, quien se registre antes de la fase 9 queda sin atribuir
-- para siempre. Texto libre a proposito: el catalogo de codigos no existe.
alter table public.profiles add column referido_por text;
```

- [ ] **Step 5: ALTO — el usuario revisa el SQL**

Regla del proyecto: toda migración la revisa el usuario antes de aplicarse. Muéstrale el fichero completo y **espera su OK explícito**. No apliques nada antes.

- [ ] **Step 6: Aplicar y verificar por introspección**

```bash
set -a; . ./.env; set +a; node tests/db/apply-migrations.mjs
```

No te fíes de que el runner no diera error. Confirma con una consulta que la tabla existe, que tiene RLS y sus dos policies, y que `profiles.referido_por` está.

- [ ] **Step 7: Correr y verificar que PASA**

```bash
set -a; . ./.env; set +a; npm run test:db
```

Esperado: las 7 aserciones del fichero 27 en verde, y el total sube de 261 a 268 sin romper ninguna anterior.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260906130000_tos_y_referido.sql supabase/tests/27_tos_aceptaciones.sql
git commit -m "feat(db): aceptaciones de ToS append-only y columna de referido"
```

---

## Task 2: `lib/tos.ts` — versión, texto, lectura y escritura

**Files:**
- Create: `lib/tos.ts`
- Create: `tests/lib/tos.test.ts`

**Interfaces:**
- Consumes: tabla `tos_aceptaciones` (Tarea 1).
- Produces:
  - `TOS_VERSION: string` — la versión vigente, hoy `'v1'`.
  - `TOS_RESUMEN: { icono: string; texto: string }[]` — las tres reglas para la pantalla.
  - `TOS_TEXTO: string` — el borrador completo.
  - `getTosAceptado(): Promise<boolean>` — true si el perfil actual aceptó **`TOS_VERSION`**. Nunca lanza: ante error devuelve `false` (fallar cerrado — es un gate).
  - `aceptarTos(): Promise<{ error: string | null }>`.

- [ ] **Step 1: Escribir los tests que fallan**

Crea `tests/lib/tos.test.ts`. Sigue el estilo de mocking de `tests/lib/*.test.ts` (mockear `@/lib/supabase`).

```ts
import { getTosAceptado, aceptarTos, TOS_VERSION } from '@/lib/tos';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));

const mockedGetUser = supabase.auth.getUser as jest.Mock;
const mockedFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

/** Encadena select().eq().eq().limit() devolviendo `rows`. */
function mockSelect(rows: unknown[], error: unknown = null) {
  const limit = jest.fn().mockResolvedValue({ data: rows, error });
  const eq2 = jest.fn(() => ({ limit }));
  const eq1 = jest.fn(() => ({ eq: eq2 }));
  const select = jest.fn(() => ({ eq: eq1 }));
  mockedFrom.mockReturnValue({ select });
  return { select, eq1, eq2, limit };
}

describe('getTosAceptado', () => {
  it('es true cuando existe una aceptación de la versión vigente', async () => {
    mockSelect([{ id: 1 }]);
    await expect(getTosAceptado()).resolves.toBe(true);
  });

  it('es false cuando no hay ninguna', async () => {
    mockSelect([]);
    await expect(getTosAceptado()).resolves.toBe(false);
  });

  it('consulta por la versión vigente, no por cualquiera', async () => {
    const m = mockSelect([]);
    await getTosAceptado();
    expect(m.eq2).toHaveBeenCalledWith('version', TOS_VERSION);
  });

  it('es false si no hay sesión', async () => {
    mockedGetUser.mockResolvedValue({ data: { user: null } });
    await expect(getTosAceptado()).resolves.toBe(false);
  });

  it('falla cerrado: ante error devuelve false y no lanza', async () => {
    mockSelect([], { message: 'sin red' });
    await expect(getTosAceptado()).resolves.toBe(false);
  });
});

describe('aceptarTos', () => {
  it('inserta el perfil y la versión vigente', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockedFrom.mockReturnValue({ insert });

    await expect(aceptarTos()).resolves.toEqual({ error: null });
    expect(insert).toHaveBeenCalledWith({ perfil_id: 'user-1', version: TOS_VERSION });
  });

  it('devuelve el error si el insert falla', async () => {
    const insert = jest.fn().mockResolvedValue({ error: { message: 'sin red' } });
    mockedFrom.mockReturnValue({ insert });

    await expect(aceptarTos()).resolves.toEqual({ error: 'sin red' });
  });

  it('devuelve error si no hay sesión, sin insertar', async () => {
    mockedGetUser.mockResolvedValue({ data: { user: null } });
    const insert = jest.fn();
    mockedFrom.mockReturnValue({ insert });

    const r = await aceptarTos();
    expect(r.error).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr y verificar que FALLAN**

```bash
npx jest tests/lib/tos.test.ts
```

Esperado: FAIL, no existe el módulo.

- [ ] **Step 3: Implementar**

Crea `lib/tos.ts`:

```ts
import { supabase } from '@/lib/supabase';

/**
 * Versión vigente del texto. Vive en el código, no en la base: subirla acá
 * obliga a todo el mundo a volver a aceptar, sin tocar el esquema. La fase
 * 7.5 (ToS enforcement) lee el histórico de `tos_aceptaciones` para saber
 * quién aceptó qué y cuándo.
 */
export const TOS_VERSION = 'v1';

/** Las tres reglas que de verdad importan, para la pantalla. */
export const TOS_RESUMEN = [
  {
    icono: 'account-heart-outline',
    texto:
      'Ayni es compañía social. Nada de contenido sexual ni servicios de acompañamiento íntimo.',
  },
  {
    icono: 'shield-check-outline',
    texto:
      'Todo pago va por la app. Coordinar pagos por fuera es motivo de baja, y el chat lo detecta.',
  },
  {
    icono: 'calendar-check-outline',
    texto: 'Solo mayores de 18 años. Verificamos tu edad con tu documento.',
  },
];

export const TOS_TEXTO = `BORRADOR — pendiente de revisión legal.

1. Qué es Ayni. Ayni conecta personas que quieren compañía para actividades
sociales: una conversación, un café, un evento. No es una app de citas ni de
servicios sexuales, y no se permite ofrecerlos ni solicitarlos.

2. Edad mínima. Debes ser mayor de 18 años. Verificamos tu edad con tu
documento de identidad.

3. Pagos. Las bebidas virtuales se compran dentro de la app y el monto queda
retenido hasta que el encuentro se confirme. Coordinar o realizar pagos fuera
de la app está prohibido y es motivo de baja de la cuenta.

4. Conducta. Trata a la otra persona con respeto. El acoso, la discriminación
y la suplantación de identidad son motivo de baja inmediata.

5. Cancelaciones y no-shows. Si el encuentro no ocurre, el monto retenido se
resuelve según las reglas de cancelación vigentes en la app.

6. Datos personales. Tratamos tus datos según nuestra política de privacidad.

7. Cambios. Si estos términos cambian, te pediremos aceptarlos de nuevo antes
de seguir usando la app.`;

/**
 * ¿El usuario actual aceptó la versión VIGENTE? Falla cerrado a propósito:
 * ante cualquier error devuelve `false`, porque esto alimenta un gate de
 * navegación y equivocarse hacia "sí aceptó" dejaría pasar a alguien que no.
 */
export async function getTosAceptado(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('tos_aceptaciones')
      .select('id')
      .eq('perfil_id', user.id)
      .eq('version', TOS_VERSION)
      .limit(1);

    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function aceptarTos(): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No hay sesión activa.' };

  const { error } = await supabase
    .from('tos_aceptaciones')
    .insert({ perfil_id: user.id, version: TOS_VERSION });

  return { error: error ? error.message : null };
}
```

- [ ] **Step 4: Correr y verificar que PASAN**

```bash
npx jest tests/lib/tos.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/tos.ts tests/lib/tos.test.ts
git commit -m "feat(tos): version, texto y lectura/escritura de la aceptacion"
```

---

## Task 3: El escalón en el guardián y su cableado

**Files:**
- Modify: `lib/route-guard.ts`
- Modify: `app/_layout.tsx`
- Modify: `tests/lib/route-guard.test.ts`

**Interfaces:**
- Consumes: `getTosAceptado` (Tarea 2).
- Produces: `AuthSegment` gana `'tos'` y `'carrusel'`; `RouteGuardInput` gana `tosAceptado: boolean`. La Tarea 4 vive en el segmento `'tos'`, la Tarea 5 en `'carrusel'`.

**El riesgo de esta tarea:** un escalón mal cableado produce un bucle. Ya pasó dos veces en este proyecto (bloque 2b de D.3 y el refresco tras el KYC). El estado de ToS **debe refrescarse en el mismo camino que el perfil**, o tras aceptar el guardián rebota al usuario a la misma pantalla.

- [ ] **Step 1: Escribir los tests que fallan**

Añade a `tests/lib/route-guard.test.ts`, siguiendo el estilo del fichero (objeto completo, `.toBe(...)`):

```ts
it('manda a tos a quien eligió rol pero no aceptó los términos', () => {
  expect(
    computeRedirect({
      hasSession: true,
      profileStatus: 'incomplete',
      tosAceptado: false,
      kycEstado: 'pendiente',
      authSegment: null,
    }),
  ).toBe('/(auth)/tos');
});

it('manda a tos incluso con el perfil ya completo y el KYC verificado', () => {
  expect(
    computeRedirect({
      hasSession: true,
      profileStatus: 'complete',
      tosAceptado: false,
      kycEstado: 'verificado',
      authSegment: null,
    }),
  ).toBe('/(auth)/tos');
});

it('no redirige a quien ya está en tos', () => {
  expect(
    computeRedirect({
      hasSession: true,
      profileStatus: 'incomplete',
      tosAceptado: false,
      kycEstado: 'pendiente',
      authSegment: 'tos',
    }),
  ).toBeNull();
});

it('sin perfil manda a select-role aunque falte el ToS: primero hay que crear la fila', () => {
  expect(
    computeRedirect({
      hasSession: true,
      profileStatus: 'none',
      tosAceptado: false,
      kycEstado: 'pendiente',
      authSegment: null,
    }),
  ).toBe('/(auth)/select-role');
});

it('con ToS aceptado sigue al paso que toque', () => {
  expect(
    computeRedirect({
      hasSession: true,
      profileStatus: 'incomplete',
      tosAceptado: true,
      kycEstado: 'pendiente',
      authSegment: null,
    }),
  ).toBe('/(auth)/profile-setup');
});

it('tolera el carrusel sin sesión, sin expulsar al sign-in', () => {
  expect(
    computeRedirect({
      hasSession: false,
      profileStatus: 'none',
      tosAceptado: false,
      kycEstado: 'pendiente',
      authSegment: 'carrusel',
    }),
  ).toBeNull();
});

it('saca del carrusel a quien ya tiene sesión', () => {
  expect(
    computeRedirect({
      hasSession: true,
      profileStatus: 'none',
      tosAceptado: false,
      kycEstado: 'pendiente',
      authSegment: 'carrusel',
    }),
  ).toBe('/(auth)/select-role');
});
```

Los tests que ya existen en el fichero no compilan sin `tosAceptado`. **Añádeselo a todos** con el valor que corresponda a su intención: `true` en los que ejercitan pasos posteriores al ToS (profile-setup, kyc, home), y `false` en los de "sin sesión" y "sin perfil", donde no se llega a evaluar.

- [ ] **Step 2: Correr y verificar que FALLAN**

```bash
npx jest tests/lib/route-guard.test.ts
```

Esperado: FAIL de tipos y de aserción.

- [ ] **Step 3: Ampliar el guardián**

En `lib/route-guard.ts`, añade los dos segmentos y el campo:

```ts
export type AuthSegment =
  | 'carrusel'
  | 'sign-in'
  | 'verify-otp'
  | 'select-role'
  | 'tos'
  | 'profile-setup'
  | 'kyc'
  | null;
```

Añade a `RouteGuardInput`:

```ts
  /** True si el perfil aceptó la versión VIGENTE del ToS (ver TOS_VERSION). */
  tosAceptado: boolean;
```

Y en `computeRedirect`, tolera el carrusel sin sesión e inserta el escalón **entre `'none'` e `'incomplete'`**:

```ts
  if (!hasSession) {
    const allowedWhileSigningIn: AuthSegment[] = ['carrusel', 'sign-in', 'verify-otp'];
    return allowedWhileSigningIn.includes(authSegment) ? null : '/(auth)/sign-in';
  }

  if (profileStatus === 'none') {
    return authSegment === 'select-role' ? null : '/(auth)/select-role';
  }

  // Va DESPUÉS de 'none' a propósito: la fila de profiles no existe hasta que
  // select-role la crea, y sin fila no hay dónde persistir la aceptación.
  if (!tosAceptado) {
    return authSegment === 'tos' ? null : '/(auth)/tos';
  }
```

El resto de la función no cambia.

- [ ] **Step 4: Cablear el estado en `_layout.tsx`**

Tres cambios, y el tercero es el que evita el bucle:

1. Estado nuevo, junto a `profileStatus` y `kycEstado`:

```tsx
  const [tosAceptado, setTosAceptado] = useState(false);
```

Añádelo también al bloque de reset síncrono que corre cuando cambia la identidad de sesión (`if (trackedSession !== session)`), con `setTosAceptado(false)`.

2. `aplicarPerfil` pasa a recibir ambas cosas, porque el guardián necesita las dos a la vez:

```tsx
  const aplicarPerfil = useCallback(
    (profile: Awaited<ReturnType<typeof getOwnProfile>>, aceptado: boolean) => {
      setProfileStatus(
        profile === null ? 'none' : isProfileComplete(profile) ? 'complete' : 'incomplete',
      );
      setKycEstado(profile?.kyc_estado ?? 'pendiente');
      setTosAceptado(aceptado);
      setProfileLoading(false);
    },
    [],
  );
```

3. Ambos caminos de carga piden las dos cosas en paralelo:

```tsx
  useEffect(() => {
    if (!session) return;
    let mounted = true;
    Promise.all([getOwnProfile(), getTosAceptado()]).then(([profile, aceptado]) => {
      if (!mounted) return;
      aplicarPerfil(profile, aceptado);
    });
    return () => {
      mounted = false;
    };
  }, [session, aplicarPerfil]);

  const refreshProfile = useCallback(() => {
    return Promise.all([getOwnProfile(), getTosAceptado()]).then(([profile, aceptado]) =>
      aplicarPerfil(profile, aceptado),
    );
  }, [aplicarPerfil]);
```

**`refreshProfile` DEBE releer el ToS también.** Es lo que la pantalla de la Tarea 4 espera antes de navegar; si solo releyera el perfil, el guardián seguiría viendo `tosAceptado: false` y devolvería al usuario a la misma pantalla — el bug de bucle que este proyecto ya sufrió dos veces.

Añade `tosAceptado` a la llamada de `computeRedirect` y al array de dependencias del efecto de redirección. Importa `getTosAceptado` de `@/lib/tos`. Añade `'carrusel'` y `'tos'` a la constante `AUTH_SEGMENTS` del fichero.

- [ ] **Step 5: Correr y verificar que PASAN**

```bash
npx jest tests/lib/route-guard.test.ts tests/app/_layout.test.tsx
```

Si los tests de `_layout` mockean `@/lib/tos`, añade el mock; si no lo mockean, comprueba que no rompen.

- [ ] **Step 6: Commit**

```bash
git add lib/route-guard.ts app/_layout.tsx tests/lib/route-guard.test.ts
git commit -m "feat(guardia): exigir la version vigente del ToS antes del alta"
```

---

## Task 4: Pantalla de aceptación de términos

**Files:**
- Create: `app/(auth)/tos.tsx`
- Create: `tests/app/tos.test.tsx`

**Interfaces:**
- Consumes: `TOS_RESUMEN`, `TOS_TEXTO`, `aceptarTos` (Tarea 2); `useProfileRefresh` de `lib/profile-context`.
- Produces: nada aguas abajo.

- [ ] **Step 1: Escribir los tests que fallan**

Crea `tests/app/tos.test.tsx`, con el estilo de `tests/app/kyc.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import TosScreen from '@/app/(auth)/tos';
import { aceptarTos } from '@/lib/tos';
import { ProfileRefreshContext } from '@/lib/profile-context';

jest.mock('@/lib/tos', () => ({
  ...jest.requireActual('@/lib/tos'),
  aceptarTos: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const mockedAceptar = aceptarTos as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('el botón no avanza sin aceptación explícita, y dice por qué', async () => {
  await render(<TosScreen />);

  expect(
    screen.getByRole('button', { name: 'Aceptar y continuar' }).props.accessibilityState?.disabled,
  ).toBe(true);
  expect(screen.getByText(/marca la casilla/i)).toBeTruthy();
});

it('muestra el aviso de que el texto es un borrador sin revisión legal', async () => {
  await render(<TosScreen />);
  expect(screen.getByText(/borrador/i)).toBeTruthy();
});

it('al marcar la casilla habilita el botón', async () => {
  await render(<TosScreen />);
  await fireEvent.press(screen.getByRole('checkbox'));

  expect(
    screen.getByRole('button', { name: 'Aceptar y continuar' }).props.accessibilityState?.disabled,
  ).toBe(false);
});

it('acepta, relee el perfil y recién entonces navega', async () => {
  mockedAceptar.mockResolvedValue({ error: null });
  const refreshProfile = jest.fn().mockResolvedValue(undefined);
  await render(
    <ProfileRefreshContext.Provider value={refreshProfile}>
      <TosScreen />
    </ProfileRefreshContext.Provider>,
  );

  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByText('Aceptar y continuar'));

  await waitFor(() => expect(mockedAceptar).toHaveBeenCalledTimes(1));
  expect(refreshProfile).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});

it('si aceptar falla, muestra el motivo y no navega', async () => {
  mockedAceptar.mockResolvedValue({ error: 'sin red' });
  await render(<TosScreen />);

  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByText('Aceptar y continuar'));

  expect(await screen.findByText('sin red')).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Correr y verificar que FALLAN**

```bash
npx jest tests/app/tos.test.tsx
```

- [ ] **Step 3: Implementar la pantalla**

Crea `app/(auth)/tos.tsx`:

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { TOS_RESUMEN, TOS_TEXTO, aceptarTos } from '@/lib/tos';
import { useProfileRefresh } from '@/lib/profile-context';
import { colors, spacing, fontSize, textStyles, touchTarget } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Icon } from '@/components/Icon';

export default function TosScreen() {
  const router = useRouter();
  const refreshProfile = useProfileRefresh();
  const [aceptado, setAceptado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleAceptar() {
    setError(null);
    setEnviando(true);
    const r = await aceptarTos();
    setEnviando(false);

    if (r.error) {
      setError(r.error);
      return;
    }

    // Esperar el refresco ANTES de navegar: el guardián lee `tosAceptado` del
    // layout, y navegar sin esperar lo devolvería a esta misma pantalla.
    // Si el refresco falla, navega igual — dejarlo atrapado es peor.
    try {
      await refreshProfile();
    } catch {
      // Silencio deliberado — ver arriba.
    }
    router.replace('/');
  }

  return (
    <Screen scroll textured contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Antes de empezar</Text>
      <Text style={styles.title}>Las reglas de Ayni</Text>

      <View style={styles.lista}>
        {TOS_RESUMEN.map((regla) => (
          <View key={regla.texto} style={styles.item}>
            <Icon name={regla.icono} size="md" />
            <Text style={styles.itemTexto}>{regla.texto}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.legal}>{TOS_TEXTO}</Text>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: aceptado }}
        accessibilityLabel="Acepto los términos"
        onPress={() => setAceptado((v) => !v)}
        style={styles.check}
      >
        <Icon name={aceptado ? 'checkbox-marked' : 'checkbox-blank-outline'} size="md" />
        <Text style={styles.itemTexto}>Leí y acepto los términos</Text>
      </Pressable>

      {error && (
        <View style={styles.item}>
          <Icon name="alert-circle-outline" size="md" />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
      {!aceptado && <Text style={styles.hint}>Marca la casilla para continuar.</Text>}

      <Button label="Aceptar y continuar" onPress={handleAceptar} disabled={!aceptado || enviando} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[6], gap: spacing[4] },
  eyebrow: { ...textStyles.label, fontSize: fontSize.caption, color: colors.primary },
  title: { ...textStyles.displaySemiBold, fontSize: fontSize.heading, color: colors.foreground },
  lista: { gap: spacing[3] },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  itemTexto: { ...textStyles.body, color: colors.foreground, flexShrink: 1 },
  legal: { ...textStyles.body, fontSize: fontSize.caption, color: colors.mutedForeground },
  check: { ...touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  error: { ...textStyles.body, color: colors.destructiveText, flexShrink: 1 },
  hint: { ...textStyles.body, fontSize: fontSize.caption, color: colors.mutedForeground },
});
```

**Comprueba que los nombres de icono existen** en el glyphmap de MaterialCommunityIcons antes de darlos por buenos — se escribieron de memoria:

```bash
node -e "const g=require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json'); for (const n of ['account-heart-outline','shield-check-outline','calendar-check-outline','checkbox-marked','checkbox-blank-outline','alert-circle-outline']) console.log((n in g ? 'OK  ' : 'FALTA ') + n)"
```

Si alguno falta, elige el equivalente más cercano del mismo set y mantén un solo grosor de trazo.

- [ ] **Step 4: Correr y verificar que PASAN**

```bash
npx jest tests/app/tos.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/tos.tsx" tests/app/tos.test.tsx
git commit -m "feat(tos): pantalla de aceptacion de terminos"
```

---

## Task 5: Carrusel "Cómo funciona"

**Files:**
- Create: `lib/carrusel.ts`
- Create: `app/(auth)/carrusel.tsx`
- Create: `tests/lib/carrusel.test.ts`
- Create: `tests/app/carrusel.test.tsx`

**Interfaces:**
- Consumes: `AsyncStorage` de `@react-native-async-storage/async-storage`.
- Produces: `carruselVisto(): Promise<boolean>` y `marcarCarruselVisto(): Promise<void>`. Ambas fallan en silencio: el almacenamiento no debe romper el arranque.

- [ ] **Step 1: Escribir los tests de `lib/carrusel.ts` que fallan**

Crea `tests/lib/carrusel.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { carruselVisto, marcarCarruselVisto } from '@/lib/carrusel';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedGet = AsyncStorage.getItem as jest.Mock;
const mockedSet = AsyncStorage.setItem as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('es false cuando no hay marca', async () => {
  mockedGet.mockResolvedValue(null);
  await expect(carruselVisto()).resolves.toBe(false);
});

it('es true cuando hay marca', async () => {
  mockedGet.mockResolvedValue('1');
  await expect(carruselVisto()).resolves.toBe(true);
});

it('no rompe si el almacenamiento falla: devuelve false', async () => {
  mockedGet.mockRejectedValue(new Error('sin storage'));
  await expect(carruselVisto()).resolves.toBe(false);
});

it('marcar escribe la clave', async () => {
  mockedSet.mockResolvedValue(undefined);
  await marcarCarruselVisto();
  expect(mockedSet).toHaveBeenCalledWith('ayni.carrusel.visto', '1');
});

it('marcar no lanza si el almacenamiento falla', async () => {
  mockedSet.mockRejectedValue(new Error('sin storage'));
  await expect(marcarCarruselVisto()).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Correr y verificar que FALLAN**

```bash
npx jest tests/lib/carrusel.test.ts
```

- [ ] **Step 3: Implementar `lib/carrusel.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE = 'ayni.carrusel.visto';

/**
 * El carrusel va ANTES del sign-in, así que no hay usuario a quien atarlo:
 * la marca vive en el dispositivo. Se ve una vez por dispositivo y reaparece
 * si el usuario cambia de teléfono o limpia datos — coste aceptable para
 * cuatro slides saltables.
 *
 * Falla en silencio a propósito: que el almacenamiento no esté disponible
 * (modo privado, permisos) no puede impedir entrar a la app. Ante la duda,
 * mostrar el carrusel es inofensivo.
 */
export async function carruselVisto(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAVE)) !== null;
  } catch {
    return false;
  }
}

export async function marcarCarruselVisto(): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE, '1');
  } catch {
    // Silencio deliberado — ver arriba.
  }
}
```

- [ ] **Step 4: Escribir los tests de la pantalla que fallan**

Crea `tests/app/carrusel.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CarruselScreen from '@/app/(auth)/carrusel';
import { marcarCarruselVisto } from '@/lib/carrusel';

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
```

- [ ] **Step 5: Correr y verificar que FALLAN**

```bash
npx jest tests/app/carrusel.test.tsx
```

- [ ] **Step 6: Implementar la pantalla**

Crea `app/(auth)/carrusel.tsx`. Las cuatro slides son las del spec §4, en ese orden:

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { marcarCarruselVisto } from '@/lib/carrusel';
import { colors, spacing, fontSize, textStyles, touchTarget } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Icon } from '@/components/Icon';

const SLIDES = [
  {
    icono: 'account-group-outline',
    titulo: 'Compañía, no citas',
    texto: 'Ayni conecta gente que quiere compañía para un café, una conversación o un evento.',
  },
  {
    icono: 'glass-cocktail',
    titulo: 'Compras una bebida',
    texto: 'No le pagas a una persona: compras una bebida virtual que representa el encuentro.',
  },
  {
    icono: 'lock-outline',
    titulo: 'El dinero queda retenido',
    texto: 'Nadie cobra nada hasta que ustedes dos se encuentren de verdad.',
  },
  {
    icono: 'qrcode-scan',
    titulo: 'Se libera al encontrarse',
    texto: 'Al confirmar el encuentro con un código QR, el pago se libera. Así de simple.',
  },
];

export default function CarruselScreen() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const esUltima = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  async function salir() {
    await marcarCarruselVisto();
    router.replace('/(auth)/sign-in');
  }

  return (
    <Screen scroll center textured contentStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Saltar"
        onPress={salir}
        style={styles.saltar}
      >
        <Text style={styles.saltarTexto}>Saltar</Text>
      </Pressable>

      <View style={styles.slide}>
        <Icon name={slide.icono} size="lg" />
        <Text style={styles.titulo}>{slide.titulo}</Text>
        <Text style={styles.texto}>{slide.texto}</Text>
      </View>

      <Text style={styles.indicador}>
        {i + 1} de {SLIDES.length}
      </Text>

      <Button
        label={esUltima ? 'Entrar' : 'Siguiente'}
        onPress={esUltima ? salir : () => setI((v) => v + 1)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[6], gap: spacing[4] },
  saltar: { ...touchTarget, alignSelf: 'flex-end' },
  saltarTexto: { ...textStyles.label, fontSize: fontSize.caption, color: colors.mutedForeground },
  slide: { alignItems: 'center', gap: spacing[3] },
  titulo: {
    ...textStyles.displaySemiBold,
    fontSize: fontSize.heading,
    color: colors.foreground,
    textAlign: 'center',
  },
  texto: { ...textStyles.body, color: colors.mutedForeground, textAlign: 'center' },
  indicador: {
    ...textStyles.label,
    fontSize: fontSize.caption,
    color: colors.primary,
    textAlign: 'center',
  },
});
```

Verifica los iconos con el mismo comando de la Tarea 4, cambiando la lista por `['account-group-outline','glass-cocktail','lock-outline','qrcode-scan']`.

- [ ] **Step 7: Enviar al carrusel desde el arranque**

En `app/_layout.tsx`, la decisión de entrar al carrusel se toma **antes** del guardián, no dentro: leer el almacenamiento es asíncrono y `computeRedirect` debe seguir siendo puro y sincrónico.

Estado nuevo, junto a los demás. `null` significa "todavía no sé", y es distinto de `false`:

```tsx
  const [carruselPendiente, setCarruselPendiente] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    carruselVisto().then((visto) => {
      if (mounted) setCarruselPendiente(!visto);
    });
    return () => {
      mounted = false;
    };
  }, []);
```

Y en el efecto de redirección, antes de llamar al guardián:

```tsx
  useEffect(() => {
    if (sessionLoading || profileLoading || (!fontsLoaded && !fontError)) return;
    // Desconocido todavía: no decidir nada. Redirigir con `carruselPendiente`
    // sin resolver mandaría al sign-in a quien debía ver el carrusel.
    if (carruselPendiente === null) return;

    if (carruselPendiente && !session) {
      if (authSegment !== 'carrusel') router.replace('/(auth)/carrusel');
      return;
    }

    const redirect = computeRedirect({ ... });
    if (redirect) router.replace(redirect as never);
  }, [/* ...deps existentes..., */ carruselPendiente, session]);
```

Importa `carruselVisto` de `@/lib/carrusel`. Añade `carruselPendiente` al array de dependencias.

**Por qué la guarda de `null` importa:** sin ella, el primer render decide con `carruselPendiente` sin resolver y manda al sign-in a quien tenía que ver el carrusel. Es la misma clase de carrera que ya mordió dos veces en este proyecto.

- [ ] **Step 8: Correr los tests y verificar que PASAN**

```bash
npx jest tests/lib/carrusel.test.ts tests/app/carrusel.test.tsx tests/app/_layout.test.tsx
```

- [ ] **Step 9: Commit**

```bash
git add lib/carrusel.ts "app/(auth)/carrusel.tsx" tests/lib/carrusel.test.ts tests/app/carrusel.test.tsx app/_layout.tsx
git commit -m "feat(onboarding): carrusel Como funciona antes del sign-in"
```

---

## Task 6: Campo de referido en el alta

**Files:**
- Modify: `app/(auth)/profile-setup.tsx`
- Modify: `lib/profile.ts`
- Modify: `tests/app/profile-setup.test.tsx`

**Interfaces:**
- Consumes: columna `profiles.referido_por` (Tarea 1).
- Produces: nada. **Nada lee esta columna** — es la costura de la fase 9.1.

- [ ] **Step 1: Escribir los tests que fallan**

**Lee `tests/app/profile-setup.test.tsx` entero antes de escribir nada.** Ese fichero ya recorre el wizard de punta a punta en sus tests de "persistencia al terminar"; los dos casos nuevos deben recorrerlo **de la misma forma que él lo hace hoy**, no con una secuencia inventada. Si el recorrido está duplicado entre varios tests, extráelo a un helper local y úsalo también en los existentes; si ya está extraído, reúsalo.

Los dos casos, con sus aserciones exactas — lo único que cambia respecto a un test de persistencia existente es escribir (o no) el campo nuevo en el paso 1 antes de terminar:

```tsx
it('guarda el código de referido cuando el usuario lo escribe', async () => {
  // ...recorrido del wizard igual que los tests de persistencia existentes,
  // escribiendo 'ANA2026' en el input de referido del paso 1...

  expect(mockedUpdateOwnProfile).toHaveBeenCalledWith(
    expect.objectContaining({ referido_por: 'ANA2026' }),
  );
});

it('deja el referido en null si el usuario no escribe nada: es opcional', async () => {
  // ...mismo recorrido, sin tocar el input de referido...

  expect(mockedUpdateOwnProfile).toHaveBeenCalledWith(
    expect.objectContaining({ referido_por: null }),
  );
});
```

El nombre real del mock de `updateOwnProfile` sale del fichero; úsalo tal cual esté ahí en vez de renombrarlo.

- [ ] **Step 2: Correr y verificar que FALLAN**

```bash
npx jest tests/app/profile-setup.test.tsx
```

- [ ] **Step 3: Implementar**

En `app/(auth)/profile-setup.tsx`, añade `referido` al estado `Datos` (string, inicial `''`) y un `TextInput` **en el primer paso**, debajo de nombre y alias, con el mismo `styles.input` que los demás:

```tsx
          <TextInput
            style={styles.input}
            placeholder="¿Alguien te invitó? Su código (opcional)"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            value={datos.referido}
            onChangeText={(referido) => actualizar({ referido })}
          />
```

**No lo añadas a `validarPaso`:** es opcional y no debe bloquear el avance.

Al guardar, normaliza vacío a `null` para no meter cadenas vacías en la base:

```tsx
      referido_por: datos.referido.trim() === '' ? null : datos.referido.trim(),
```

En `lib/profile.ts`, añade `referido_por?: string | null` al tipo que acepta `updateOwnProfile`.

- [ ] **Step 4: Correr y verificar que PASAN**

```bash
npx jest tests/app/profile-setup.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/profile-setup.tsx" lib/profile.ts tests/app/profile-setup.test.tsx
git commit -m "feat(onboarding): capturar el codigo de referido en el alta"
```

---

## Cierre

- [ ] **Verificación completa, con la salida mostrada**

```bash
npm run lint && npm run typecheck && npm test
```

```bash
set -a; . ./.env; set +a; npm run test:db
```

```bash
git status --short && git diff tsconfig.json
```

`git diff tsconfig.json` debe salir vacío. Si Expo lo reescribió, `git checkout tsconfig.json` antes de commitear.

- [ ] **Verificación visual en el preview web**

Levanta el preview y recorre, con capturas: el carrusel completo, el carrusel saltado, y la pantalla de ToS.

**Ojo con la marca del carrusel:** una vez visto no vuelve a aparecer. Para volver a verlo, limpia la clave `ayni.carrusel.visto` del `localStorage` desde la consola del navegador.

**Ojo con el ToS:** la cuenta del usuario no lo tiene aceptado, así que el guardián la llevará ahí en el próximo ingreso. Es el comportamiento correcto.

- [ ] **`security-review`**

La fase toca esquema con RLS, así que cierra con `superpowers:security-review` sobre la migración de la Tarea 1: aislamiento de `tos_aceptaciones` entre usuarios, carácter append-only para el cliente, y que la columna `referido_por` no haya abierto nada en `profiles` ni en la vista `perfiles_publicos`.

- [ ] **Reportar**

Incluye: la salida de las cuatro suites, el conteo de pgTAP antes y después, capturas de las tres pantallas, y confirmación de que **nada lee `referido_por`** (`git grep referido_por` debe mostrar solo la migración, el alta y el tipo).

**No toques `docs/ESTADO.md` ni `FASE ACTUAL`.** El cierre lo declara el usuario.
