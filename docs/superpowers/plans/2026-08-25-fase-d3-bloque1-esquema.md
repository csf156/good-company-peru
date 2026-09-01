# Fase D.3 — Bloque 1: esquema de datos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar `public.profiles` de `edad` a `fecha_nacimiento`, renombrar `intereses` a `tipo_salida`, y sacar `profesion` de los campos obligatorios — dejando la app compilando, los tests verdes y el esquema listo para que el wizard (bloque 2) se construya encima.

**Architecture:** La edad deja de guardarse y pasa a calcularse en la vista `perfiles_publicos`. La fecha de nacimiento vive solo en la tabla base, que `profiles_select_own` restringe a la propia fila — los demás usuarios siguen viendo únicamente la edad derivada. El renombre de `intereses` a `tipo_salida` acompaña el cambio de semántica del campo (de temas de conversación a tipo de salida buscado) y viaja en la misma migración porque paga el mismo radio de impacto: vista pública + grants por columna.

**Tech Stack:** Postgres 15 (Supabase) · pgTAP vía `tests/db/run-pgtap.mjs` · TypeScript · Jest + @testing-library/react-native

**Spec:** [`docs/superpowers/specs/2026-08-25-onboarding-premium-design.md`](../specs/2026-08-25-onboarding-premium-design.md) §2

---

## Global Constraints

- **El usuario revisa el SQL antes de aplicarlo.** Es regla del proyecto (`CLAUDE.md`, "Migraciones"). La Tarea 2 tiene un alto obligatorio para eso. No apliques la migración sin su OK.
- **Migración versionada, nunca SQL suelto por el editor de Supabase.** El archivo vive en `supabase/migrations/` y se aplica con el runner del repo.
- **El prefijo de la migración debe ser único.** El runner (`tests/db/apply-migrations.mjs`) deriva la versión del número antes del primer `_` y **se salta en silencio** una migración cuyo prefijo ya esté aplicado. Verifica unicidad antes de nombrar el archivo.
- **`profesion` NO se borra.** Sale del formulario y de `REQUIRED_FIELDS`; la columna y su presencia en `perfiles_publicos` se conservan. Borrarla es explícitamente fuera de alcance (spec §6).
- **El repo queda compilando y verde al final de cada tarea.** Este bloque toca tipos que `profile-setup.tsx` usa; ver la nota de la Tarea 4 sobre el parche temporal.
- **Idioma:** UI en español de Perú, informal "tú". Código y commits en inglés técnico.
- **Cierre de cada tarea:** `npm run lint` + `npm run typecheck` + `npm test` en verde. Las que tocan SQL, además `npm run test:db`.
- **El runner de pgTAP no carga `.env` solo.** Antes de `npm run test:db`, en la misma línea de shell: `set -a; . ./.env; set +a`.
- **No hagas push.** El usuario no lo ha pedido.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `supabase/tests/23_fecha_nacimiento.sql` | pgTAP nuevo: columna, check 18+, grants, vista | 1 |
| `supabase/tests/06_perfiles_publicos.sql` | Ajuste: el insert usa `edad`, pasa a `fecha_nacimiento` | 1 |
| `supabase/migrations/20260825120000_fecha_nacimiento_tipo_salida.sql` | La migración | 2 |
| `lib/profile-complete.ts` | `OwnProfile` y `REQUIRED_FIELDS` | 3 |
| `lib/validation.ts` | `isValidEdad` → `isMayorDeEdad(fechaNacimiento)` | 3 |
| `lib/profile.ts` | `PROFILE_SELECT` | 3 |
| `tests/lib/validation.test.ts`, `tests/lib/profile-complete.test.ts` | Tests de las dos anteriores | 3 |
| `app/(auth)/profile-setup.tsx` | Parche mínimo para compilar (el wizard es el bloque 2) | 4 |
| `app/profile.tsx`, `app/profile/[id].tsx`, `app/index.tsx` | Consumidores de `edad`/`intereses` | 4 |

---

## Task 1: pgTAP que falla — el contrato del esquema nuevo

TDD: el test describe el esquema que queremos antes de que exista. Debe fallar por "column does not exist", no por otra cosa.

**Files:**
- Create: `supabase/tests/23_fecha_nacimiento.sql`
- Modify: `supabase/tests/06_perfiles_publicos.sql:20`

**Interfaces:**
- Produces: el contrato que la migración de la Tarea 2 debe satisfacer — `profiles.fecha_nacimiento date`, sin `profiles.edad`, `profiles.tipo_salida text[]`, y `perfiles_publicos` exponiendo `edad` calculada pero no `fecha_nacimiento`.

- [ ] **Step 1: Verificar que el prefijo de migración está libre**

```bash
ls supabase/migrations/ | cut -d_ -f1 | sort | uniq -d
ls supabase/migrations/ | grep '^20260825120000' || echo "prefijo libre"
```

Esperado: la primera línea sin salida (no hay prefijos duplicados hoy), la segunda imprime `prefijo libre`.

- [ ] **Step 2: Escribir el pgTAP nuevo**

Crear `supabase/tests/23_fecha_nacimiento.sql`. **El runner ya envuelve cada archivo en su propia transacción con ROLLBACK** — no escribas `begin`/`rollback`, ningún archivo existente los tiene. El archivo empieza directo con `select plan(N)`.

```sql
-- Fase D.3 bloque 1 — esquema de fecha_nacimiento y tipo_salida.
select plan(11);

-- Forma de la tabla
select has_column('public', 'profiles', 'fecha_nacimiento', 'profiles tiene fecha_nacimiento');
select col_type_is('public', 'profiles', 'fecha_nacimiento', 'date', 'fecha_nacimiento es date');
select hasnt_column('public', 'profiles', 'edad', 'profiles ya no guarda edad');
select has_column('public', 'profiles', 'tipo_salida', 'profiles tiene tipo_salida');
select hasnt_column('public', 'profiles', 'intereses', 'intereses fue renombrada');
select has_column('public', 'profiles', 'profesion', 'profesion sigue existiendo (columna muerta, no borrada)');

-- Grants por columna: el cliente puede escribir los campos nuevos de su perfil
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'fecha_nacimiento', 'UPDATE'),
  'authenticated puede actualizar fecha_nacimiento'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'tipo_salida', 'UPDATE'),
  'authenticated puede actualizar tipo_salida'
);

-- La vista pública expone edad calculada, nunca la fecha de nacimiento
select has_column('public', 'perfiles_publicos', 'edad', 'la vista pública expone edad');
select hasnt_column(
  'public', 'perfiles_publicos', 'fecha_nacimiento',
  'la vista pública NO expone fecha_nacimiento (dato sensible)'
);

-- 18+ se sigue exigiendo, ahora sobre la fecha.
--
-- `profiles.id` referencia `auth.users`, así que el usuario tiene que existir
-- primero: sin esto el insert fallaría por violación de FK (23503) y el test
-- pasaría por la razón equivocada, sin llegar nunca a probar el check.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000',
   'd3d3d3d3-0000-0000-0000-00000000d3d3', 'authenticated', 'authenticated',
   'menor@test.dev', '', now(), now(), now(), '', '', '', '');

select throws_ok(
  $$insert into public.profiles (id, rol, fecha_nacimiento)
    values ('d3d3d3d3-0000-0000-0000-00000000d3d3', 'amigo',
            current_date - interval '17 years')$$,
  '23514',
  null,
  'un menor de 18 es rechazado por el check'
);

select * from finish();
```

- [ ] **Step 3: Ajustar el pgTAP existente que inserta `edad`**

`supabase/tests/06_perfiles_publicos.sql:20` hace:

```sql
insert into public.profiles (id, rol, nombre, alias, edad, genero, profesion, kyc_estado)
```

Cambiar `edad` por `fecha_nacimiento` en la lista de columnas y el valor correspondiente por una fecha que dé la misma edad que el test esperaba (usa `current_date - interval 'N years'`). Revisa el resto del archivo: si alguna aserción compara el valor de `edad` que devuelve la vista, ahora vendrá calculado — el número debe seguir cuadrando.

- [ ] **Step 4: Correr y verificar que falla por la razón correcta**

```bash
set -a; . ./.env; set +a; npm run test:db
```

Esperado: **falla**, con errores del tipo `column "fecha_nacimiento" does not exist`. Si falla por otra cosa (sintaxis del test, conexión), arregla eso primero — un test que falla por el motivo equivocado no prueba nada.

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/23_fecha_nacimiento.sql supabase/tests/06_perfiles_publicos.sql
git commit -m "test(db): contrato de fecha_nacimiento y tipo_salida (falla)"
```

---

## Task 2: La migración

**Files:**
- Create: `supabase/migrations/20260825120000_fecha_nacimiento_tipo_salida.sql`

**Interfaces:**
- Consumes: el contrato de la Tarea 1.
- Produces: `profiles.fecha_nacimiento date`, `profiles.tipo_salida text[]`, `perfiles_publicos.edad` como expresión calculada.

- [ ] **Step 1: Escribir la migración**

```sql
-- Fase D.3 — la edad deja de guardarse y pasa a derivarse de la fecha de
-- nacimiento; `intereses` cambia de semántica (temas de conversación → tipo
-- de salida buscado) y se renombra en consecuencia.
--
-- Por qué la edad se calcula en la vista y no como columna generada: una
-- columna generada de Postgres debe ser IMMUTABLE, y la edad depende de la
-- fecha de hoy. Guardada como número suelto, envejece mal — el perfil diría
-- 24 para siempre.

-- 1. Fecha de nacimiento. Nace nullable: los perfiles existentes no la tienen
--    y el wizard (bloque 2) es quien la exige al dar de alta.
alter table public.profiles
  add column fecha_nacimiento date;

-- El check usa current_date, que es STABLE y no IMMUTABLE. Es seguro aquí
-- porque el predicado es monótono: quien ya cumplió 18 nunca vuelve a tener
-- 17, así que una fila válida no puede invalidarse con el paso del tiempo
-- (ni al restaurar un dump).
alter table public.profiles
  add constraint profiles_mayor_de_edad
  check (
    fecha_nacimiento is null
    or fecha_nacimiento <= current_date - interval '18 years'
  );

-- 2. Baja de `edad`. La vista se recrea abajo; hay que soltarla primero
--    porque depende de esta columna.
drop view public.perfiles_publicos;

alter table public.profiles
  drop column edad;

-- 3. `intereses` → `tipo_salida`. El rename conserva datos, grants de tabla
--    e índices; los grants POR COLUMNA se re-otorgan explícitamente abajo.
alter table public.profiles
  rename column intereses to tipo_salida;

-- 4. Vista pública. Se recrea con la misma allowlist explícita de columnas
--    que la fase 1.5 definió, con dos cambios: `edad` pasa a ser expresión
--    calculada, e `intereses` pasa a `tipo_salida`.
--
--    `fecha_nacimiento` queda DELIBERADAMENTE fuera: es dato sensible y solo
--    debe verlo su dueño vía profiles_select_own sobre la tabla base.
create view public.perfiles_publicos as
select
  id,
  rol,
  alias,
  case
    when fecha_nacimiento is null then null
    else extract(year from age(current_date, fecha_nacimiento))::int
  end as edad,
  genero,
  profesion,
  hobbies,
  tipo_salida,
  foto_url,
  kyc_estado
from public.profiles;

grant select on public.perfiles_publicos to authenticated;
revoke select on public.perfiles_publicos from anon;

-- 5. Grants por columna. El `drop column edad` se llevó su grant; el rename
--    conservó el de `intereses` bajo el nombre nuevo, pero se re-otorga
--    explícitamente para que este archivo documente el conjunto completo y no
--    dependa del comportamiento del rename.
grant update (fecha_nacimiento, tipo_salida) on public.profiles to authenticated;
```

- [ ] **Step 2: ALTO — el usuario revisa el SQL antes de aplicarlo**

Regla del proyecto. Muéstrale el archivo completo y espera su OK explícito. Señálale los tres puntos que merecen su atención:

1. **`drop column edad` borra datos.** Hoy no hay usuarios reales, pero es irreversible.
2. **El check de 18+ usa `current_date`**, que no es IMMUTABLE. Es seguro porque el predicado es monótono (nadie rejuvenece), pero es una desviación consciente de la regla general.
3. **`fecha_nacimiento` nace nullable.** Los perfiles ya existentes quedan sin ella; el wizard del bloque 2 la exige al dar de alta.

No apliques nada sin su respuesta.

- [ ] **Step 3: Aplicar la migración**

```bash
set -a; . ./.env; set +a; node tests/db/apply-migrations.mjs
```

Esperado: aplica solo la migración nueva. Si dice que no hay nada que aplicar, revisa la colisión de prefijos del Step 1 de la Tarea 1 — es el modo de fallo silencioso conocido de este runner.

- [ ] **Step 4: Verificar por introspección, no de memoria**

```bash
set -a; . ./.env; set +a; node -e "
const pg=require('pg');
(async()=>{
 const c=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
 await c.connect();
 const cols=await c.query(\"select column_name,data_type from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('edad','fecha_nacimiento','intereses','tipo_salida','profesion') order by column_name\");
 console.table(cols.rows);
 const view=await c.query(\"select column_name from information_schema.columns where table_schema='public' and table_name='perfiles_publicos' order by ordinal_position\");
 console.log('vista:', view.rows.map(r=>r.column_name).join(', '));
 await c.end();
})();"
```

Esperado: `fecha_nacimiento` (date), `profesion` (text), `tipo_salida` (ARRAY). **Sin** `edad` ni `intereses`. La vista lista `edad` y **no** lista `fecha_nacimiento`.

- [ ] **Step 5: Correr pgTAP — ahora debe pasar**

```bash
set -a; . ./.env; set +a; npm run test:db
```

Esperado: 230 → **241** aserciones (11 nuevas del archivo 23), 0 fallos.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260825120000_fecha_nacimiento_tipo_salida.sql
git commit -m "feat(db): fecha_nacimiento reemplaza edad, intereses pasa a tipo_salida"
```

---

## Task 3: Tipos y validación en `lib/`

**Files:**
- Modify: `lib/profile-complete.ts`, `lib/validation.ts:28-30`, `lib/profile.ts:8`
- Test: `tests/lib/validation.test.ts`, `tests/lib/profile-complete.test.ts`

**Interfaces:**
- Produces: `isMayorDeEdad(fechaNacimiento: string): boolean` (`lib/validation.ts`) y el tipo `OwnProfile` con `fecha_nacimiento: string | null` y `tipo_salida: string[]`, sin `edad`. El bloque 2 (wizard) consume ambos.

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/lib/validation.test.ts`, añadir:

```typescript
describe('isMayorDeEdad', () => {
  // Fecha fija para que el test no dependa del día en que corre.
  const HOY = new Date('2026-08-25T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(HOY);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('acepta a quien cumple exactamente 18 hoy', () => {
    expect(isMayorDeEdad('2008-08-25')).toBe(true);
  });

  it('rechaza a quien cumple 18 mañana', () => {
    expect(isMayorDeEdad('2008-08-26')).toBe(false);
  });

  it('rechaza 17 años y 11 meses', () => {
    expect(isMayorDeEdad('2008-09-25')).toBe(false);
  });

  it('rechaza una fecha inválida', () => {
    expect(isMayorDeEdad('no-es-fecha')).toBe(false);
  });

  it('rechaza una fecha futura', () => {
    expect(isMayorDeEdad('2030-01-01')).toBe(false);
  });
});
```

En `tests/lib/profile-complete.test.ts`, añadir el test que impide el bucle del wizard (spec §5 y §8 — es el riesgo más probable de esta fase):

```typescript
it('considera completo un perfil sin profesion', () => {
  expect(
    isProfileComplete({
      rol: 'amigo',
      nombre: 'Ana',
      alias: 'ana',
      fecha_nacimiento: '2000-01-01',
      genero: 'Mujer',
      profesion: null,
      foto_url: 'perfil/ana.jpg',
      hobbies: ['Cine'],
      tipo_salida: ['Conversar / café'],
      kyc_estado: 'verificado',
    }),
  ).toBe(true);
});

it('considera incompleto un perfil sin fecha de nacimiento', () => {
  expect(
    isProfileComplete({
      rol: 'amigo',
      nombre: 'Ana',
      alias: 'ana',
      fecha_nacimiento: null,
      genero: 'Mujer',
      profesion: null,
      foto_url: 'perfil/ana.jpg',
      hobbies: ['Cine'],
      tipo_salida: ['Conversar / café'],
      kyc_estado: 'verificado',
    }),
  ).toBe(false);
});
```

Revisa el resto de `tests/lib/profile-complete.test.ts`: los casos existentes construyen `OwnProfile` con `edad` e `intereses` y hay que migrarlos a los campos nuevos.

- [ ] **Step 2: Correr y verificar que fallan**

```bash
npx jest tests/lib/validation.test.ts tests/lib/profile-complete.test.ts
```

Esperado: FAIL — `isMayorDeEdad is not a function` y errores de tipo en `fecha_nacimiento`/`tipo_salida`.

- [ ] **Step 3: Implementar**

En `lib/validation.ts`, reemplazar `isValidEdad` (líneas 28-30):

```typescript
/** True si la fecha de nacimiento (YYYY-MM-DD) corresponde a alguien de 18 o más. */
export function isMayorDeEdad(fechaNacimiento: string): boolean {
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return false;

  const hoy = new Date();
  const dieciocho = new Date(
    nacimiento.getFullYear() + 18,
    nacimiento.getMonth(),
    nacimiento.getDate(),
  );

  return dieciocho <= hoy;
}
```

En `lib/profile-complete.ts`, el tipo y la lista de obligatorios:

```typescript
export type OwnProfile = {
  rol: RolUsuario;
  nombre: string | null;
  alias: string | null;
  fecha_nacimiento: string | null;
  genero: string | null;
  profesion: string | null;
  foto_url: string | null;
  hobbies: string[];
  tipo_salida: string[];
  kyc_estado: KycEstado;
};

// `profesion` sale del alta en la fase D.3: la columna sigue existiendo pero
// nadie la escribe. Dejarla aquí devolvería al usuario al wizard en bucle,
// porque route-guard nunca consideraría su perfil completo.
const REQUIRED_FIELDS = ['nombre', 'alias', 'fecha_nacimiento', 'genero', 'foto_url'] as const;
```

En `lib/profile.ts:8`:

```typescript
const PROFILE_SELECT =
  'rol, nombre, alias, fecha_nacimiento, genero, profesion, foto_url, hobbies, tipo_salida, kyc_estado';
```

- [ ] **Step 4: Correr y verificar que pasan**

```bash
npx jest tests/lib/validation.test.ts tests/lib/profile-complete.test.ts
```

Esperado: PASS. `npm run typecheck` seguirá fallando en las pantallas — es lo que arregla la Tarea 4.

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts lib/profile-complete.ts lib/profile.ts tests/lib/
git commit -m "feat: tipos y validacion sobre fecha_nacimiento y tipo_salida"
```

---

## Task 4: Consumidores — dejar la app compilando

**Files:**
- Modify: `app/(auth)/profile-setup.tsx`, `app/profile.tsx`, `app/profile/[id].tsx`, `app/index.tsx`
- Test: los suites existentes de esas pantallas

**Interfaces:**
- Consumes: `OwnProfile` y `isMayorDeEdad` de la Tarea 3.
- Produces: repo compilando y suite verde. El bloque 2 reescribe `profile-setup.tsx` por completo.

**Nota de alcance — parche temporal deliberado:** `profile-setup.tsx` va a ser reemplazado por el wizard de seis pasos en el bloque 2. Aquí recibe **el parche mínimo para compilar**, no un rediseño: el input de "Edad" pasa a uno de fecha de nacimiento en texto (`YYYY-MM-DD`) validado con `isMayorDeEdad`, y "Intereses" pasa a escribir `tipo_salida`. Es trabajo que se tira en el bloque 2, y se acepta a cambio de que el repo nunca quede roto entre bloques — que es regla del proyecto. **No inviertas esfuerzo de diseño aquí.**

- [ ] **Step 1: Localizar todo lo que rompe**

```bash
npm run typecheck 2>&1 | head -40
grep -rn "edad\|intereses" app/ lib/ tests/ --include=*.ts --include=*.tsx | grep -v node_modules
```

Esperado: errores en `profile-setup.tsx`, `profile.tsx`, `profile/[id].tsx`, `index.tsx` y sus tests. La lista del `grep` es la de trabajo — trabaja sobre ella, no de memoria.

- [ ] **Step 2: Parche mínimo de `profile-setup.tsx`**

Reemplazar el estado `edadText`/`setEdadText` por `fechaNacimiento`/`setFechaNacimiento`, el `TextInput` de "Edad" por uno con `placeholder="Fecha de nacimiento (AAAA-MM-DD)"`, la validación `isValidEdad(edad)` por `isMayorDeEdad(fechaNacimiento)`, y en el objeto que se envía: `edad` → `fecha_nacimiento`, `intereses` → `tipo_salida`. **Sacar `profesion` de la condición de campos obligatorios** de la línea 61 y quitar su `TextInput` — es lo que el usuario pidió y lo que `REQUIRED_FIELDS` ya refleja.

- [ ] **Step 3: Actualizar las pantallas de lectura**

`app/profile.tsx` (perfil propio, editable), `app/profile/[id].tsx` y `app/index.tsx` (descubrimiento) leen `edad` e `intereses`. Los dos últimos consumen `perfiles_publicos`, donde `edad` **sigue existiendo** (ahora calculada) — ahí solo cambia `intereses` → `tipo_salida`. `app/profile.tsx` lee la tabla base y necesita los dos cambios.

Actualiza también los textos de UI: donde decía "Intereses" ahora es "Tipo de salida" (español de Perú, informal).

- [ ] **Step 4: Actualizar los tests de esas pantallas**

Los mocks construyen perfiles con `edad`/`intereses`. Migrarlos a `fecha_nacimiento`/`tipo_salida`. **No cambies las aserciones de comportamiento** — si una falla tras migrar el mock, es un hallazgo real, no ruido: repórtalo.

- [ ] **Step 5: Verificar todo**

```bash
npm run lint && npm run typecheck && npm test
set -a; . ./.env; set +a; npm run test:db
```

Esperado: lint y typecheck limpios; jest verde (el conteo sube por los tests nuevos de la Tarea 3); pgTAP 241 verdes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: migrar pantallas a fecha_nacimiento y tipo_salida"
```

---

## Cierre del bloque 1

- [ ] **Verificación final, con la salida mostrada**

```bash
npm run lint && npm run typecheck && npm test
set -a; . ./.env; set +a; npm run test:db
git status --short
```

- [ ] **Reportar y detenerse**

**Este bloque NO cierra la fase D.3.** No escribas en `docs/ESTADO.md`, no marques nada ✅ y no toques `FASE ACTUAL` — D.3 se cierra recién cuando los tres bloques estén hechos y el usuario apruebe el flujo visualmente.

Reporta: qué quedó en el esquema (salida de la introspección del Step 4 de la Tarea 2), conteos reales de ambas suites, y cualquier aserción de comportamiento que haya fallado al migrar los mocks. Lo siguiente es el **bloque 2 (wizard de seis pasos)**, cuyo plan se escribe cuando este cierre — no lo arranques.
