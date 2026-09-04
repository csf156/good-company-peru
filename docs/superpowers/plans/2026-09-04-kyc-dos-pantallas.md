# KYC paso a paso (D.3, Bloque 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la pantalla única de KYC (dos botones sueltos) en una secuencia de cuatro pasos con la misma sensación premium que el wizard de alta, pidiendo cámara trasera para el DNI y frontal para la selfie.

**Architecture:** Una sola ruta (`app/(auth)/kyc.tsx`) con estado `paso` de 1 a 4, exactamente el patrón que el Bloque 2 ya estableció en `profile-setup.tsx`: `<Screen scroll textured>`, `<StepHeader>` arriba, un único `<Button>` al pie. La lógica de verificación (`startKycVerification`, Edge Function `kyc-start`) **no se toca** — en modo demo devuelve `verificado` al instante. Lo único que se añade fuera de la pantalla es la analítica de embudo, que obliga a ensanchar un CHECK en `onboarding_eventos`.

**Tech Stack:** React Native + Expo Router · `expo-image-picker` 57.0.2 (ya instalado) · Supabase (Postgres + RLS) · Jest + @testing-library/react-native · pgTAP

## Global Constraints

- **Sin dependencias nuevas.** `expo-image-picker` 57.0.2 ya expone `cameraType` (`CameraType.back` / `CameraType.front`) — verificado por introspección en `node_modules/expo-image-picker/build/ImagePicker.types.d.ts:508`. No instalar `expo-camera`.
- **La lógica de verificación no se toca.** `lib/kyc.ts`, `supabase/functions/kyc-start/`, `supabase/functions/_shared/kyc.ts` y `kyc-webhook` quedan exactamente como están. Esta fase es UI + analítica.
- **Nada de falso análisis.** En modo demo la verificación es instantánea. La pantalla de resultado no simula una revisión que no existe: spinner solo mientras la petición está realmente en vuelo.
- **Español de Perú, informal "tú".** Todo el copy de UI.
- **Estados con icono + texto**, nunca solo color. Contraste AA. Targets ≥44dp (usa `touchTarget` de `lib/theme`).
- **Rojo solo para error.** Nunca decorativo.
- **Modo oscuro:** usar los tokens de `lib/theme` (`colors`, `spacing`, `fontSize`, `textStyles`), nunca colores literales.
- **El usuario revisa el SQL antes de aplicar** (Tarea 1). Migración versionada, nunca por SQL editor suelto.
- **TDD:** test que falla → implementación mínima → verde → commit, un commit por tarea.
- **Antes de cualquier `git add -A`:** revisar `git diff tsconfig.json` y revertir con `git checkout tsconfig.json` si el servidor de Expo lo reescribió. Ver Gotchas de `CLAUDE.md`.
- **Cierre:** `npm run lint` + `npm run typecheck` + `npm test` + `npm run test:db` verdes, con la salida mostrada. **Sin push.**
- **No tocar `docs/ESTADO.md` ni `FASE ACTUAL`.** El cierre de D.3 lo declara el usuario, no el implementador.

---

## Contexto: lo que ya existe y no hay que redescubrir

Verificado por introspección hoy (2026-09-04):

| Pieza | Dónde | Estado |
|---|---|---|
| `startKycVerification(dniPath, selfiePath)` → `{estado, error}` | `lib/kyc.ts:12` | Listo, no tocar |
| `uploadDniDocument(kind, localUri)` → `{path, error}` | `lib/storage.ts:47` | Listo, sube a `dni/<uid>/<kind>.jpg` |
| `StepHeader({paso, total, titulo, onVolver})` | `components/StepHeader.tsx` | Listo, reusar tal cual |
| `<Screen scroll textured contentStyle>` | `components/Screen.tsx` | Listo (textura de Bloque 2b) |
| `Icon({name, size})`, `Button({label, onPress, disabled, variant})` | `components/` | Listos |
| `useProfileRefresh()` | `lib/profile-context.tsx` | Listo |
| `registrarPasoOnboarding(paso)` / `registrarOnboardingCompletado()` | `lib/onboarding-analytics.ts` | Existe; se amplía en Tarea 2 |
| Tabla `onboarding_eventos` | `supabase/migrations/20260826120000_onboarding_eventos.sql` | **`check (paso between 1 and 7)`** ← lo que la Tarea 1 ensancha |

**Dos comportamientos ganados con dolor que la reescritura DEBE conservar** (están comentados en `app/(auth)/kyc.tsx:55-63` y cubiertos por `tests/app/kyc.test.tsx`):

1. Tras `estado === 'verificado'` hay que **esperar** `await refreshProfile()` **antes** de navegar. `_layout` solo relee el perfil cuando cambia la sesión; sin esa espera el guardián redirige con el `kyc_estado` viejo y el usuario rebota. Si el refresco falla, **navega igual** (try/catch con silencio deliberado) — si no, queda atrapado.
2. Con `estado === 'pendiente'` (Truora real) **no** se navega y **no** se llama `refreshProfile`.

Los tests que cubren ambos ya existen y se conservan; la Tarea 4 los reubica al nuevo flujo.

**Decisiones del usuario (2026-09-04):**
1. **Una ruta con cuatro pasos internos**, no cuatro rutas.
2. **La verificación se dispara automáticamente al entrar al paso 4**, no con un botón.
3. **La analítica sí cubre KYC**, como pasos 8 a 11.

**Consecuencia de (3), asumida a sabiendas:** el Bloque 3 deja de ser UI pura y pasa a tocar esquema, porque `onboarding_eventos.paso` está limitado a 1–7. De ahí la Tarea 1 y el `security-review` de cierre.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `supabase/migrations/20260904190000_onboarding_eventos_kyc.sql` | Ensancha el CHECK de `paso` a 1–11 | 1 |
| `supabase/tests/23_onboarding_eventos_kyc.sql` | pgTAP: acepta 8–11, rechaza 0 y 12, RLS intacta | 1 |
| `lib/onboarding-analytics.ts` | Añade `registrarPasoKyc` y `registrarKycCompletado` | 2 |
| `tests/lib/onboarding-analytics.test.ts` | Cobertura de los helpers nuevos | 2 |
| `app/(auth)/kyc.tsx` | Reescritura: máquina de 4 pasos | 3, 4 |
| `tests/app/kyc.test.tsx` | Reescritura: navegación, cámaras, resultado | 3, 4 |

---

## Task 1: Ensanchar el rango de `paso` en `onboarding_eventos`

**Files:**
- Create: `supabase/migrations/20260904190000_onboarding_eventos_kyc.sql`
- Create: `supabase/tests/23_onboarding_eventos_kyc.sql`

**Interfaces:**
- Produces: `onboarding_eventos` acepta `paso` de 1 a 11. La Tarea 2 inserta 8–11.

- [ ] **Step 1: Verificar que el prefijo de la migración no colisiona**

El runner casero (`tests/db/apply-migrations.mjs`) deriva la versión del prefijo del nombre y **salta en silencio** una migración cuyo prefijo ya esté aplicado. Comprueba antes de nada:

```bash
ls supabase/migrations/ | cut -d_ -f1 | sort | uniq -d
```

Salida esperada: vacía. Si `20260904190000` ya existiera, elige otro timestamp y ajusta el nombre en todos los pasos siguientes.

- [ ] **Step 2: Escribir el test pgTAP primero (RED)**

Crea `supabase/tests/23_onboarding_eventos_kyc.sql`. Sigue el estilo de los ficheros vecinos (`supabase/tests/*.sql`): `begin;`, `select plan(N);`, aserciones, `select * from finish();`, `rollback;`.

```sql
begin;
select plan(6);

-- Un perfil de prueba propio para no depender de datos ajenos.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000k1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'kyc-paso@ayni.test', '',
        now(), now(), now());

insert into public.profiles (id, rol) values ('00000000-0000-0000-0000-0000000000k1'::uuid, 'amigo');

-- Los pasos del wizard de perfil siguen siendo válidos.
select lives_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('00000000-0000-0000-0000-0000000000k1'::uuid, 7, 'completado')$$,
  'el paso 7 (fin del alta de perfil) sigue aceptandose'
);

-- Los cuatro pasos de KYC son los que esta migracion habilita.
select lives_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('00000000-0000-0000-0000-0000000000k1'::uuid, 8, 'paso_visto')$$,
  'el paso 8 (intro de KYC) se acepta'
);
select lives_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('00000000-0000-0000-0000-0000000000k1'::uuid, 11, 'completado')$$,
  'el paso 11 (KYC completado) se acepta'
);

-- El rango sigue acotado por los dos extremos.
select throws_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('00000000-0000-0000-0000-0000000000k1'::uuid, 12, 'paso_visto')$$,
  '23514',
  null,
  'el paso 12 se rechaza: el rango sigue acotado por arriba'
);
select throws_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('00000000-0000-0000-0000-0000000000k1'::uuid, 0, 'paso_visto')$$,
  '23514',
  null,
  'el paso 0 se rechaza: el rango sigue acotado por abajo'
);

-- El ensanchado no debe haber tocado el aislamiento.
select ok(
  (select count(*) from pg_policy
    where polrelid = 'public.onboarding_eventos'::regclass) = 2,
  'las dos policies de RLS (select_own, insert_own) siguen en pie'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Correr el test y verificar que FALLA**

```bash
set -a; . ./.env; set +a; npm run test:db
```

Esperado: los dos `lives_ok` de los pasos 8 y 11 fallan con `23514` (violación del CHECK). Esa es la señal de RED.

- [ ] **Step 4: Escribir la migración**

Crea `supabase/migrations/20260904190000_onboarding_eventos_kyc.sql`:

```sql
-- El wizard de alta ocupa los pasos 1-7. El Bloque 3 de D.3 anade la captura
-- de KYC como cuatro pasos mas del mismo embudo (8 intro, 9 DNI, 10 selfie,
-- 11 resultado), para poder medir donde se abandona la verificacion — que es
-- justo donde mas se cae. Solo se ensancha el rango: la tabla, sus policies y
-- sus grants no cambian.
alter table public.onboarding_eventos
  drop constraint onboarding_eventos_paso_check;

alter table public.onboarding_eventos
  add constraint onboarding_eventos_paso_check check (paso between 1 and 11);
```

**Confirma el nombre real de la constraint antes de escribir el `drop`** — no lo asumas:

```bash
set -a; . ./.env; set +a; node -e "
const {Client}=require('pg');
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
const r=await c.query(\"select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.onboarding_eventos'::regclass and contype='c'\");
console.log(r.rows);await c.end();})();
"
```

Si el nombre difiere del que asume la migración, usa el real.

- [ ] **Step 5: ALTO — el usuario revisa el SQL**

Regla del proyecto: toda migración la revisa el usuario antes de aplicarse. Muéstrale el fichero completo y la salida de la introspección del paso anterior, y espera su OK explícito.

- [ ] **Step 6: Aplicar y verificar por introspección**

```bash
set -a; . ./.env; set +a; node tests/db/apply-migrations.mjs
```

Después vuelve a correr la consulta de `pg_constraint` del Step 4 y confirma que el `check` ahora dice `between 1 and 11`. No te fíes de que el runner no haya dado error: comprueba el estado real.

- [ ] **Step 7: Correr el test y verificar que PASA**

```bash
set -a; . ./.env; set +a; npm run test:db
```

Esperado: las 6 aserciones del fichero 23 en verde, y el total de pgTAP sube en 6 sin que ninguna de las anteriores se rompa.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260904190000_onboarding_eventos_kyc.sql supabase/tests/23_onboarding_eventos_kyc.sql
git commit -m "feat(db): onboarding_eventos acepta los pasos de KYC"
```

---

## Task 2: Analítica de los pasos de KYC

**Files:**
- Modify: `lib/onboarding-analytics.ts`
- Modify: `tests/lib/onboarding-analytics.test.ts`

**Interfaces:**
- Consumes: `onboarding_eventos` con `paso` hasta 11 (Tarea 1).
- Produces: `registrarPasoKyc(pasoKyc: 1 | 2 | 3 | 4): void` y `registrarKycCompletado(): void`. Ambas devuelven `void` y **nunca lanzan**. La Tarea 3 llama a la primera; la Tarea 4 a la segunda.

- [ ] **Step 1: Escribir los tests que fallan**

Añade a `tests/lib/onboarding-analytics.test.ts`, siguiendo el estilo de mocking que el fichero ya usa para `@/lib/supabase`:

```ts
describe('analítica de KYC', () => {
  it('mapea los cuatro pasos de KYC al rango 8-11 del embudo', () => {
    registrarPasoKyc(1);
    registrarPasoKyc(4);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ paso: 8, evento: 'paso_visto' }),
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ paso: 11, evento: 'paso_visto' }),
    );
  });

  it('registra el fin de KYC como completado en el paso 11', () => {
    registrarKycCompletado();

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ paso: 11, evento: 'completado' }),
    );
  });

  it('no lanza si el insert falla: la analítica nunca rompe el flujo', () => {
    mockInsert.mockRejectedValueOnce(new Error('sin red'));

    expect(() => registrarPasoKyc(2)).not.toThrow();
  });
});
```

Los tres necesitan importar `registrarPasoKyc` y `registrarKycCompletado` desde `@/lib/onboarding-analytics`. Si el fichero de test no expone ya `mockInsert`, extrae el mock existente a una constante reusable en vez de duplicarlo.

- [ ] **Step 2: Correr los tests y verificar que FALLAN**

```bash
npx jest tests/lib/onboarding-analytics.test.ts
```

Esperado: FAIL, `registrarPasoKyc is not a function`.

- [ ] **Step 3: Implementar**

Añade al final de `lib/onboarding-analytics.ts`, **sin tocar** `registrar`, `registrarPasoOnboarding` ni `registrarOnboardingCompletado`:

```ts
/**
 * Los pasos 1-7 del embudo son el wizard de alta de perfil. La captura de KYC
 * son los cuatro siguientes: 8 intro, 9 DNI, 10 selfie, 11 resultado. Se
 * numeran corridos a propósito, para que el embudo se lea de un tirón desde el
 * registro hasta la verificación.
 */
const PRIMER_PASO_KYC = 7;

export function registrarPasoKyc(pasoKyc: 1 | 2 | 3 | 4): void {
  void registrar(PRIMER_PASO_KYC + pasoKyc, 'paso_visto');
}

export function registrarKycCompletado(): void {
  void registrar(PRIMER_PASO_KYC + 4, 'completado');
}
```

`registrar` ya traga sus propios errores, así que el tercer test pasa sin trabajo extra.

- [ ] **Step 4: Correr los tests y verificar que PASAN**

```bash
npx jest tests/lib/onboarding-analytics.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding-analytics.ts tests/lib/onboarding-analytics.test.ts
git commit -m "feat(onboarding): analitica de los pasos de KYC"
```

---

## Task 3: Los tres primeros pasos (intro, DNI trasera, selfie frontal)

**Files:**
- Modify: `app/(auth)/kyc.tsx` (reescritura completa)
- Modify: `tests/app/kyc.test.tsx` (reescritura completa)

**Interfaces:**
- Consumes: `registrarPasoKyc` (Tarea 2), `uploadDniDocument` (`lib/storage.ts:47`), `StepHeader`, `Screen`, `Button`, `Icon`.
- Produces: la pantalla mantiene `dniPath` y `selfiePath` en estado y llega al paso 4 con ambos. La Tarea 4 implementa ese paso 4.

**Ojo:** esta tarea deja el paso 4 como un marcador mínimo. No implementes la verificación aquí — es la Tarea 4.

- [ ] **Step 1: Escribir los tests que fallan**

Reescribe `tests/app/kyc.test.tsx`. El mock de `expo-image-picker` **debe** exponer `CameraType`, o la pantalla no podrá leer `CameraType.back`:

```tsx
jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  CameraType: { back: 'back', front: 'front' },
}));
jest.mock('@/lib/onboarding-analytics', () => ({
  registrarPasoKyc: jest.fn(),
  registrarKycCompletado: jest.fn(),
}));
```

Y los casos:

```tsx
it('arranca en el paso 1 de 4, explicando qué se va a pedir', async () => {
  await render(<KycScreen />);

  expect(screen.getByText('Paso 1 de 4')).toBeTruthy();
  expect(screen.getByText('Verifica tu identidad')).toBeTruthy();
});

it('la pantalla de DNI pide la cámara trasera', async () => {
  await render(<KycScreen />);
  await fireEvent.press(screen.getByText('Empezar'));

  mockedLaunchCamera.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///dni.jpg' }],
  });
  mockedUploadDni.mockResolvedValueOnce({ path: 'user-1/dni.jpg', error: null });

  await fireEvent.press(screen.getByText('Tomar foto del DNI'));

  expect(mockedLaunchCamera).toHaveBeenCalledWith(
    expect.objectContaining({ cameraType: 'back' }),
  );
  expect(mockedUploadDni).toHaveBeenCalledWith('dni', 'file:///dni.jpg');
});

it('la pantalla de selfie pide la cámara frontal', async () => {
  await render(<KycScreen />);
  await avanzarHastaSelfie();

  mockedLaunchCamera.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///selfie.jpg' }],
  });
  mockedUploadDni.mockResolvedValueOnce({ path: 'user-1/selfie.jpg', error: null });

  await fireEvent.press(screen.getByText('Tomar selfie'));

  expect(mockedLaunchCamera).toHaveBeenCalledWith(
    expect.objectContaining({ cameraType: 'front' }),
  );
  expect(mockedUploadDni).toHaveBeenCalledWith('selfie', 'file:///selfie.jpg');
});

it('no deja avanzar del paso de DNI sin haberlo capturado, y dice por qué', async () => {
  await render(<KycScreen />);
  await fireEvent.press(screen.getByText('Empezar'));

  expect(screen.getByText(/Toma la foto de tu DNI para continuar/i)).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Continuar' }).props.accessibilityState?.disabled,
  ).toBe(true);
});

it('retroceder y volver a avanzar conserva lo capturado', async () => {
  await render(<KycScreen />);
  await avanzarHastaSelfie();

  await fireEvent.press(screen.getByLabelText('Volver'));
  expect(screen.getByText('Paso 2 de 4')).toBeTruthy();
  expect(screen.getByText('DNI listo')).toBeTruthy();

  await fireEvent.press(screen.getByText('Continuar'));
  expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
  expect(mockedUploadDni).toHaveBeenCalledTimes(1);
});

it('muestra el motivo si la cámara no da permiso, y no avanza', async () => {
  mockedRequestPermission.mockResolvedValueOnce({ granted: false });
  await render(<KycScreen />);
  await fireEvent.press(screen.getByText('Empezar'));

  await fireEvent.press(screen.getByText('Tomar foto del DNI'));

  expect(await screen.findByText(/Necesitamos acceso a tu cámara/i)).toBeTruthy();
  expect(screen.getByText('Paso 2 de 4')).toBeTruthy();
});

it('muestra el motivo si la subida falla y deja reintentar', async () => {
  await render(<KycScreen />);
  await fireEvent.press(screen.getByText('Empezar'));

  mockedLaunchCamera.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///dni.jpg' }],
  });
  mockedUploadDni.mockResolvedValueOnce({ path: null, error: 'No se pudo subir la imagen.' });

  await fireEvent.press(screen.getByText('Tomar foto del DNI'));

  expect(await screen.findByText('No se pudo subir la imagen.')).toBeTruthy();
  expect(screen.getByText('Tomar foto del DNI')).toBeTruthy();
});

it('registra cada paso de KYC en la analítica', async () => {
  await render(<KycScreen />);
  expect(registrarPasoKyc).toHaveBeenCalledWith(1);

  await fireEvent.press(screen.getByText('Empezar'));
  expect(registrarPasoKyc).toHaveBeenCalledWith(2);
});
```

Y el helper que comparten, en el mismo fichero:

```tsx
async function avanzarHastaSelfie() {
  await fireEvent.press(screen.getByText('Empezar'));

  mockedLaunchCamera.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///dni.jpg' }],
  });
  mockedUploadDni.mockResolvedValueOnce({ path: 'user-1/dni.jpg', error: null });
  await fireEvent.press(screen.getByText('Tomar foto del DNI'));
  await screen.findByText('DNI listo');

  await fireEvent.press(screen.getByText('Continuar'));
}
```

- [ ] **Step 2: Correr los tests y verificar que FALLAN**

```bash
npx jest tests/app/kyc.test.tsx
```

Esperado: FAIL, no existe "Paso 1 de 4".

- [ ] **Step 3: Reescribir la pantalla**

Reemplaza el contenido de `app/(auth)/kyc.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { uploadDniDocument } from '@/lib/storage';
import { startKycVerification } from '@/lib/kyc';
import { registrarPasoKyc, registrarKycCompletado } from '@/lib/onboarding-analytics';
import { useProfileRefresh } from '@/lib/profile-context';
import { colors, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Icon } from '@/components/Icon';

const TOTAL_PASOS = 4;

const TITULOS: Record<number, string> = {
  1: 'Verifica tu identidad',
  2: 'Foto de tu DNI',
  3: 'Tu selfie',
  4: 'Listo',
};

export default function KycScreen() {
  const router = useRouter();
  const refreshProfile = useProfileRefresh();
  const [paso, setPaso] = useState(1);
  const [dniPath, setDniPath] = useState<string | null>(null);
  const [selfiePath, setSelfiePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);

  useEffect(() => {
    registrarPasoKyc(paso as 1 | 2 | 3 | 4);
  }, [paso]);

  async function capturar(
    kind: 'dni' | 'selfie',
    cameraType: ImagePicker.CameraType,
    onCaptured: (path: string) => void,
  ) {
    setError(null);
    setCapturando(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Necesitamos acceso a tu cámara para continuar.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ quality: 0.8, cameraType });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const upload = await uploadDniDocument(kind, result.assets[0].uri);
      if (upload.error || !upload.path) {
        setError(upload.error ?? 'No se pudo subir la imagen.');
        return;
      }
      onCaptured(upload.path);
    } finally {
      setCapturando(false);
    }
  }

  // El motivo por el que NO se puede avanzar, o null si sí se puede. Mismo
  // patrón que validarPaso() del wizard de alta: el usuario siempre ve por qué
  // el botón está apagado, nunca se queda adivinando.
  function motivoBloqueo(): string | null {
    if (paso === 2 && !dniPath) return 'Toma la foto de tu DNI para continuar.';
    if (paso === 3 && !selfiePath) return 'Toma tu selfie para continuar.';
    return null;
  }

  const motivo = motivoBloqueo();

  function handleVolver() {
    setError(null);
    setPaso((p) => Math.max(1, p - 1));
  }

  function handleContinuar() {
    setError(null);
    setPaso((p) => Math.min(TOTAL_PASOS, p + 1));
  }

  return (
    <Screen scroll textured contentStyle={styles.content}>
      <StepHeader
        paso={paso}
        total={TOTAL_PASOS}
        titulo={TITULOS[paso] ?? ''}
        onVolver={paso > 1 && paso < TOTAL_PASOS ? handleVolver : undefined}
      />

      {paso === 1 && (
        <>
          <Text style={styles.parrafo}>
            Para cuidar a toda la comunidad, necesitamos confirmar que eres tú. Son dos fotos y
            toma menos de un minuto.
          </Text>
          <View style={styles.lista}>
            <View style={styles.item}>
              <Icon name="card-account-details-outline" size="md" />
              <Text style={styles.itemTexto}>Tu DNI, por el frente</Text>
            </View>
            <View style={styles.item}>
              <Icon name="account-outline" size="md" />
              <Text style={styles.itemTexto}>Una selfie tuya</Text>
            </View>
          </View>
        </>
      )}

      {paso === 2 && (
        <>
          <Text style={styles.parrafo}>
            Coloca tu DNI sobre una superficie plana y encuádralo completo. Que se lean bien los
            datos.
          </Text>
          <Button
            label={dniPath ? 'Volver a tomar' : 'Tomar foto del DNI'}
            variant={dniPath ? 'secondary' : 'primary'}
            onPress={() => capturar('dni', ImagePicker.CameraType.back, setDniPath)}
            disabled={capturando}
          />
          {dniPath && (
            <View style={styles.item}>
              <Icon name="check-circle-outline" size="md" />
              <Text style={styles.itemTexto}>DNI listo</Text>
            </View>
          )}
        </>
      )}

      {paso === 3 && (
        <>
          <Text style={styles.parrafo}>
            Busca un lugar con buena luz y mira a la cámara. Sin lentes de sol ni gorra.
          </Text>
          <Button
            label={selfiePath ? 'Volver a tomar' : 'Tomar selfie'}
            variant={selfiePath ? 'secondary' : 'primary'}
            onPress={() => capturar('selfie', ImagePicker.CameraType.front, setSelfiePath)}
            disabled={capturando}
          />
          {selfiePath && (
            <View style={styles.item}>
              <Icon name="check-circle-outline" size="md" />
              <Text style={styles.itemTexto}>Selfie lista</Text>
            </View>
          )}
        </>
      )}

      {paso === 4 && <Text style={styles.parrafo}>Verificando…</Text>}

      {error && (
        <View style={styles.item}>
          <Icon name="alert-circle-outline" size="md" />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
      {motivo && <Text style={styles.hint}>{motivo}</Text>}

      {paso < TOTAL_PASOS && (
        <Button
          label={paso === 1 ? 'Empezar' : 'Continuar'}
          onPress={handleContinuar}
          disabled={!!motivo || capturando}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[6],
    gap: spacing[4],
  },
  parrafo: {
    ...textStyles.body,
    color: colors.mutedForeground,
  },
  lista: {
    gap: spacing[3],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  itemTexto: {
    ...textStyles.body,
    color: colors.foreground,
  },
  error: {
    ...textStyles.body,
    color: colors.destructiveText,
    flexShrink: 1,
  },
  hint: {
    ...textStyles.body,
    fontSize: fontSize.caption,
    color: colors.mutedForeground,
  },
});
```

**Comprueba que los nombres de icono existen** en el set que usa `components/Icon.tsx` (MaterialCommunityIcons) antes de darlo por bueno. Si alguno no existe, elige el equivalente más cercano del mismo set y mantén un solo grosor de trazo.

Nota: `startKycVerification`, `registrarKycCompletado`, `refreshProfile` y `router` quedan importados pero sin usar hasta la Tarea 4. Si `npm run lint` se queja de variables sin usar, **no las borres** — implementa la Tarea 4 a continuación; son su cimiento. Si necesitas que el lint pase para commitear esta tarea, haz las dos tareas en un solo commit y dilo en el reporte.

- [ ] **Step 4: Correr los tests y verificar que PASAN**

```bash
npx jest tests/app/kyc.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/kyc.tsx tests/app/kyc.test.tsx
git commit -m "feat(kyc): captura en pasos con camara trasera y frontal"
```

---

## Task 4: El paso 4 — resultado con verificación automática

**Files:**
- Modify: `app/(auth)/kyc.tsx`
- Modify: `tests/app/kyc.test.tsx`

**Interfaces:**
- Consumes: `dniPath` y `selfiePath` del estado (Tarea 3), `startKycVerification` (`lib/kyc.ts:12`), `registrarKycCompletado` (Tarea 2).
- Produces: nada aguas abajo. Es el final del flujo.

**Los dos comportamientos del contexto son requisito de esta tarea, no un detalle:** esperar `refreshProfile()` antes de navegar (navegando igual si falla), y no navegar ni refrescar cuando el estado es `pendiente`.

- [ ] **Step 1: Escribir los tests que fallan**

Añade a `tests/app/kyc.test.tsx`, empezando por el helper que encadena con el de la Tarea 3:

```tsx
async function avanzarHastaResultado() {
  await avanzarHastaSelfie();

  mockedLaunchCamera.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///selfie.jpg' }],
  });
  mockedUploadDni.mockResolvedValueOnce({ path: 'user-1/selfie.jpg', error: null });
  await fireEvent.press(screen.getByText('Tomar selfie'));
  await screen.findByText('Selfie lista');

  await fireEvent.press(screen.getByText('Continuar'));
}
```

```tsx
it('verifica automáticamente al llegar al paso 4, sin botón de por medio', async () => {
  mockedStartKyc.mockResolvedValue({ estado: 'verificado', error: null });
  await render(<KycScreen />);
  await avanzarHastaResultado();

  await waitFor(() => {
    expect(mockedStartKyc).toHaveBeenCalledWith('user-1/dni.jpg', 'user-1/selfie.jpg');
  });
  expect(mockedStartKyc).toHaveBeenCalledTimes(1);
});

it('en modo demo muestra el resultado verificado con icono y texto', async () => {
  mockedStartKyc.mockResolvedValue({ estado: 'verificado', error: null });
  await render(<KycScreen />);
  await avanzarHastaResultado();

  expect(await screen.findByText('Identidad verificada')).toBeTruthy();
  expect(registrarKycCompletado).toHaveBeenCalledTimes(1);
});

it('espera a que termine de releer el perfil antes de navegar', async () => {
  mockedStartKyc.mockResolvedValue({ estado: 'verificado', error: null });
  let resolveRefresh: () => void = () => {};
  const refreshProfile = jest.fn(
    () => new Promise<void>((resolve) => { resolveRefresh = resolve; }),
  );
  await render(
    <ProfileRefreshContext.Provider value={refreshProfile}>
      <KycScreen />
    </ProfileRefreshContext.Provider>,
  );
  await avanzarHastaResultado();

  await waitFor(() => expect(refreshProfile).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByText('Ir al inicio'));
  expect(mockReplace).not.toHaveBeenCalled();

  resolveRefresh();
  await fireEvent.press(screen.getByText('Ir al inicio'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});

it('navega igual si releer el perfil falla (no deja al usuario atrapado)', async () => {
  mockedStartKyc.mockResolvedValue({ estado: 'verificado', error: null });
  const refreshProfile = jest.fn().mockRejectedValue(new Error('sin red'));
  await render(
    <ProfileRefreshContext.Provider value={refreshProfile}>
      <KycScreen />
    </ProfileRefreshContext.Provider>,
  );
  await avanzarHastaResultado();

  await screen.findByText('Identidad verificada');
  await fireEvent.press(screen.getByText('Ir al inicio'));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});

it('con Truora real muestra "en revisión", no navega y no relee el perfil', async () => {
  mockedStartKyc.mockResolvedValue({ estado: 'pendiente', error: null });
  const refreshProfile = jest.fn();
  await render(
    <ProfileRefreshContext.Provider value={refreshProfile}>
      <KycScreen />
    </ProfileRefreshContext.Provider>,
  );
  await avanzarHastaResultado();

  expect(await screen.findByText(/en revisión/i)).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(refreshProfile).not.toHaveBeenCalled();
});

it('si la verificación falla, muestra el motivo y deja reintentar', async () => {
  mockedStartKyc.mockResolvedValueOnce({ estado: null, error: 'Rutas inválidas.' });
  await render(<KycScreen />);
  await avanzarHastaResultado();

  expect(await screen.findByText('Rutas inválidas.')).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();

  mockedStartKyc.mockResolvedValueOnce({ estado: 'verificado', error: null });
  await fireEvent.press(screen.getByText('Reintentar'));

  expect(await screen.findByText('Identidad verificada')).toBeTruthy();
});
```

- [ ] **Step 2: Correr los tests y verificar que FALLAN**

```bash
npx jest tests/app/kyc.test.tsx
```

- [ ] **Step 3: Implementar el paso 4**

En `app/(auth)/kyc.tsx`, añade el estado y el efecto de verificación:

```tsx
type Resultado = { estado: 'verificado' | 'pendiente'; } | { estado: 'error'; motivo: string };

const [resultado, setResultado] = useState<Resultado | null>(null);
const [verificando, setVerificando] = useState(false);
const [refrescado, setRefrescado] = useState(false);
```

Y el efecto que dispara la verificación al entrar al paso 4:

```tsx
// La verificación arranca sola al llegar al paso 4: el usuario ya dio su
// consentimiento capturando las dos fotos, y un botón más solo añadiría
// fricción. En modo demo esto resuelve al instante — por eso NO hay
// animación de análisis: seria teatro sobre un proceso que no ocurre.
useEffect(() => {
  if (paso !== TOTAL_PASOS || !dniPath || !selfiePath) return;
  if (resultado || verificando) return;

  let cancelado = false;
  setVerificando(true);
  void (async () => {
    const r = await startKycVerification(dniPath, selfiePath);
    if (cancelado) return;

    if (r.error) {
      setResultado({ estado: 'error', motivo: r.error });
    } else if (r.estado === 'verificado') {
      registrarKycCompletado();
      // Hay que ESPERAR el refresco antes de dejar navegar: _layout solo
      // relee el perfil cuando cambia la sesión, así que sin esto el
      // guardián redirige con el kyc_estado viejo. Si falla, seguimos
      // igual — dejarlo atrapado es peor que un guardián desactualizado.
      try {
        await refreshProfile();
      } catch {
        // Silencio deliberado — ver arriba.
      }
      if (!cancelado) {
        setRefrescado(true);
        setResultado({ estado: 'verificado' });
      }
    } else {
      setResultado({ estado: 'pendiente' });
    }
    if (!cancelado) setVerificando(false);
  })();

  return () => {
    cancelado = true;
  };
}, [paso, dniPath, selfiePath, resultado, verificando, refreshProfile]);
```

Reemplaza el marcador `{paso === 4 && <Text style={styles.parrafo}>Verificando…</Text>}` de la Tarea 3 por:

```tsx
{paso === TOTAL_PASOS && (
  <>
    {verificando && !resultado && <Text style={styles.parrafo}>Verificando tu identidad…</Text>}

    {resultado?.estado === 'verificado' && (
      <>
        <View style={styles.item}>
          <Icon name="check-decagram-outline" size="md" />
          <Text style={styles.itemTexto}>Identidad verificada</Text>
        </View>
        <Button
          label="Ir al inicio"
          onPress={() => {
            if (refrescado) router.replace('/');
          }}
        />
      </>
    )}

    {resultado?.estado === 'pendiente' && (
      <View style={styles.item}>
        <Icon name="clock-outline" size="md" />
        <Text style={styles.itemTexto}>
          Tu identidad está en revisión. Te avisamos apenas se confirme.
        </Text>
      </View>
    )}

    {resultado?.estado === 'error' && (
      <>
        <View style={styles.item}>
          <Icon name="alert-circle-outline" size="md" />
          <Text style={styles.error}>{resultado.motivo}</Text>
        </View>
        <Button label="Reintentar" onPress={() => setResultado(null)} />
      </>
    )}
  </>
)}
```

- [ ] **Step 4: Correr los tests y verificar que PASAN**

```bash
npx jest tests/app/kyc.test.tsx
```

Si el test de "espera a que termine de releer el perfil" da un warning de `act(...)`, es el mismo benigno que el fichero ya documentaba — no lo silencies escondiendo el await.

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/kyc.tsx tests/app/kyc.test.tsx
git commit -m "feat(kyc): pantalla de resultado con verificacion automatica"
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

`git diff tsconfig.json` debe salir vacío. Si Expo lo reescribió, `git checkout tsconfig.json` antes de cualquier commit.

- [ ] **Verificación visual en el preview web**

El criterio final de esta fase es que se vea premium, y eso ningún test lo comprueba. Levanta el preview (`preview_start`, target `expo-web`), recorre los cuatro pasos y toma capturas.

**Límite honesto de esa verificación:** en navegador de escritorio el atributo `capture` del input se ignora, así que la elección de cámara trasera/frontal **no se puede comprobar a ojo ahí** — solo en dispositivo. Lo que sí prueba el navegador es el flujo, el copy, el paso a paso y el estado de resultado. La elección de cámara la cubren los tests de la Tarea 3, que asertan el argumento pasado a `launchCameraAsync`.

- [ ] **`security-review`**

Esta fase toca esquema (`onboarding_eventos`), así que cierra con `superpowers:security-review` sobre la migración de la Tarea 1: el CHECK ensanchado no debe haber alterado RLS, grants por columna ni el carácter append-only de la tabla para el cliente.

- [ ] **Reportar**

Incluye: la salida de las cuatro suites, el conteo de pgTAP antes y después, capturas de los cuatro pasos, y confirmación explícita de que `startKycVerification` y las Edge Functions de KYC no se tocaron (`git diff --stat` sobre `lib/kyc.ts` y `supabase/functions/` debe salir vacío).

**No toques `docs/ESTADO.md` ni `FASE ACTUAL`.** El Bloque 3 cierra D.3, pero la fase la declara concluida el usuario, no el implementador.
