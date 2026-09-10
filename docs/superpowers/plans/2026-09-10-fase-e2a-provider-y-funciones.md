# Fase E.2a — Provider de preautorización y funciones SQL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mover el momento del dinero — de "comprar una bebida" a "preautorizar al invitar y capturar al aceptar" — en la capa que se puede probar sin Edge Functions: el módulo de pagos y las cuatro funciones SQL.

**Architecture:** `_shared/pagos.ts` gana las tres operaciones del ciclo hold (preautorizar, capturar, anular) detrás de la interfaz `PaymentProvider` ya existente, en modo `mock`. Las cuatro funciones `SECURITY DEFINER` que hoy referencian la tabla `bar` borrada se reescriben contra el esquema de E.1. La conciliación se **redefine**, no se parchea.

**Tech Stack:** Postgres 15 (Supabase cloud), pgTAP vía `tests/db/run-pgtap.mjs`, Jest para la lógica isomórfica de `_shared/`.

**Spec:** `docs/superpowers/specs/2026-09-09-rediseno-dinero-sbs-design.md`, §3.1, §4, §4.1 y §10. Léelo antes de empezar.

**Este plan es E.2a.** Las Edge Functions, el seed de demo y dejar el árbol verde son **E.2b**, plan aparte. No los toques aquí: al cerrar E.2a la app sigue rota y las tres suites jest siguen en `.skip`. Es esperado.

## Global Constraints

- **Red Pontis auth/capture/void está ASUMIDO, no confirmado** (decisión del usuario, 2026-09-10, spec §3.1). Todo el trabajo va contra `PaymentProvider` en modo `mock`. **No escribas el adaptador real de Red Pontis** más allá del stub que ya existe: si la respuesta llega y es "no", se tira.
- **El usuario revisa el SQL antes de aplicar, y lo autoriza él.** Un peer no autoriza un ALTO. Cada migración, una por una.
- **El runner de pgTAP ya valida el `plan(N)`** (commit `6c0082c`). Un archivo que pierda aserciones ahora sale rojo. Aprovéchalo: el `plan(N)` es el contrato.
- **Contrato de cobertura, no negociable** (spec §10.2). E.2a **no cierra** por debajo de: `13_confirmar_orden_pago` ≥ 15, `14_conciliacion_sp3` ≥ 8, `19_crear_invitacion` ≥ 19, `20_responder_invitacion` ≥ 30. Total ≥ 72.
- **El cliente nunca calcula ni mueve dinero.** Montos server-side, `EXECUTE` restringido a `service_role`, `SECURITY DEFINER` con `search_path` fijo.
- **Idempotencia en todo.** Preautorizar, capturar y anular son reintentables sin duplicar.
- Rutas explícitas en `git add`. Nunca `-A`, nunca `--amend`, sin push. `git diff tsconfig.json` antes de cada commit.
- **El código de este plan es una hipótesis.** Los planes de D.3, D.4 y E.1 traían bugs reales cada uno. **Si un test y el snippet se contradicen, gana el test** — y avísame para corregir el plan.
- **Todo estado en el que una fila puede NACER tiene que tener salida, y hay que probarlo.** Un estado sin transición de salida para algún tipo de fila es una trampa: la fila queda viva, invisible o inmóvil, y ninguna suite lo nota porque cada test mira su propio caso. Por cada combinación `(tipo, estado inicial)` que una función pueda crear, el test tiene que afirmar **quién la ve** y **qué función la mueve**. Esto ya falló una vez en esta fase: una `solicitud` nacía en `preautorizando`, invisible para su receptor y sin función capaz de sacarla de ahí (Tarea 3, corregido en la 3c).
- **Antes de reescribir cualquier función, comprueba cuál es la ÚLTIMA migración que la define, no la primera que la creó.** Este repo redefine funciones con `create or replace` en migraciones posteriores, casi siempre para **cerrar un agujero de seguridad**: `crear_invitacion` se redefinió para acotar la idempotencia por usuario, `responder_invitacion` para el scope del gate de KYC, `detectar_discrepancias_sp3` para añadir invariantes de montos. Partir de la original **reintroduce ese agujero en silencio, y los tests no lo ven** — porque el test que lo cubría se escribió contra la versión corregida y sigue pasando contra ella. Es el defecto más peligroso que ha tenido ninguno de mis planes, y lo tuvo este (encontrado por BUILDER en la Tarea 3, 2026-09-10).

  ```bash
  grep -l "create or replace function public.<nombre>" supabase/migrations/*.sql | sort | tail -1
  ```

  **Si este plan nombra una migración distinta de la que sale ahí, gana el grep** — y avísame.

---

## Nota sobre los tests de este plan

En las tareas 2 a 5 **no escribo las 72 aserciones**. Escribo el **contrato**: cuántas exige cada archivo y qué casos tiene que cubrir, enumerados. El SQL exacto lo escribes tú, por dos razones concretas:

1. Los fixtures viven en los archivos viejos (`13`, `14`, `19`, `20`), que aún tienen su estructura de setup aunque estén vaciados a un assert. Reusarlos es más rápido y más fiel que reinventarlos desde un plan.
2. Setenta aserciones escritas a ciegas por mí, sin ejecutarlas, serían ficción que tendrías que depurar. Los planes anteriores ya demostraron que mi código es hipótesis; a esta escala el coste sería absurdo.

**Lo que sí es obligatorio y no interpretable:** el número mínimo por archivo, la lista de casos, y que los ataques se **reproduzcan** (intentar la operación prohibida como `service_role`), nunca leyendo `information_schema`.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/functions/_shared/pagos.ts` | Gana `preautorizar` / `capturar` / `anular` sobre `PaymentProvider`. Isomórfico (Jest + Deno), sin imports de runtime. |
| `tests/functions/pagos.test.ts` | Tests jest de esas tres operaciones. |
| `supabase/migrations/20260910120000_capturar_orden.sql` | `confirmar_orden_pago` → reescrita como captura, sin `bar`. |
| `supabase/migrations/20260910130000_crear_invitacion_preautorizando.sql` | `crear_invitacion` reescrita: crea la invitación en `preautorizando` y su orden. |
| `supabase/migrations/20260910135000_confirmar_preautorizacion.sql` | `confirmar_preautorizacion` + `abrir_cita` (interna, compartida). |
| `supabase/tests/34_confirmar_preautorizacion.sql` | ≥ 12 aserciones. |
| `supabase/migrations/20260910140000_responder_invitacion_captura.sql` | `responder_invitacion` reescrita: aceptar captura, rechazar anula. |
| `supabase/migrations/20260910150000_conciliacion_sin_bar.sql` | `detectar_discrepancias_sp3` **redefinida**. |
| `supabase/tests/13_confirmar_orden_pago.sql` | ≥ 15 aserciones. |
| `supabase/tests/14_conciliacion_sp3.sql` | ≥ 8 aserciones. |
| `supabase/tests/19_crear_invitacion.sql` | ≥ 19 aserciones. |
| `supabase/tests/20_responder_invitacion.sql` | ≥ 30 aserciones. |

---

## Task 0: Renombrar `por_pagar` → `preautorizando`

E.1 creó la etiqueta como `por_pagar`. El usuario la leyó como "pendiente de pago **hasta que se concrete el encuentro**", que es justo lo que no significa: dura segundos, entre pulsar "invitar" y la respuesta de la preautorización. Si el dueño del producto la malinterpreta, está mal elegida.

**Va primero y va sola.** Ahora cuesta una línea: **cero filas** en la base y **cero apariciones** en UI. Después de las tareas 2-5 estaría dentro de tres funciones nuevas, y después de E.3/E.4 en pantallas y copy.

**Files:**
- Create: `supabase/migrations/20260910110000_renombrar_preautorizando.sql`
- Modify: `supabase/tests/30_stock_eliminado.sql` (líneas 58-60, 78), `supabase/tests/13_confirmar_orden_pago.sql` (línea 36)

**Interfaces:**
- Produces: `estado_invitacion` con la etiqueta `preautorizando` en lugar de `por_pagar`. **Todas las tareas siguientes usan el nombre nuevo.**

- [ ] **Step 1: Cambiar los tests primero y verlos fallar**

Sustituye `por_pagar` por `preautorizando` en los dos archivos. Correr:

```bash
npm run test:db
```

Esperado: `30_stock_eliminado.sql` y `13_confirmar_orden_pago.sql` en rojo — la etiqueta nueva no existe. Ese rojo es la prueba de que el renombrado hace falta; sin él, el paso siguiente no está validado.

- [ ] **Step 2: Escribir la migración**

```sql
-- Fase E.2a, Tarea 0 — `por_pagar` pasa a llamarse `preautorizando`.
--
-- El nombre viejo se lee como "pendiente de pago hasta que se concrete el
-- encuentro". No es eso: el estado dura segundos, entre crear la invitación y
-- la respuesta de la preautorización. Cuando el amigo acepta, el dinero YA se
-- cobró y está en custodia; lo que falta hasta el encuentro verificado es
-- liberarlo (fase 5.4), no pagarlo.
--
-- Se renombra ahora porque hoy es gratis: cero filas con ese estado y cero
-- apariciones en UI.

alter type estado_invitacion rename value 'por_pagar' to 'preautorizando';
```

- [ ] **Step 3: ALTO — el USUARIO revisa y autoriza**

Sin `DROP`, sin pérdida de datos. Aun así, es esquema: gate normal.

- [ ] **Step 4: Aplicar y verificar por introspección**

```sql
select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
 where t.typname = 'estado_invitacion' order by e.enumsortorder;
```

Esperado: aparece `preautorizando`, **no** aparece `por_pagar`.

- [ ] **Step 5: Verde y commit**

```bash
npm run test:db
git add supabase/migrations/20260910110000_renombrar_preautorizando.sql supabase/tests/30_stock_eliminado.sql supabase/tests/13_confirmar_orden_pago.sql
git commit -m "refactor(db): por_pagar pasa a llamarse preautorizando"
```

> El plan de E.1 (`docs/superpowers/plans/2026-09-09-fase-e1-esquema-sbs.md`) y su entrada en `ESTADO.md` siguen diciendo `por_pagar`. **No los edites**: son el registro de lo que se ejecutó entonces. El renombrado se documenta en el cierre de E.2a.

---

## Task 1: Las tres operaciones del ciclo hold

Lógica pura, sin base de datos. Se prueba con Jest, no con pgTAP.

**Files:**
- Modify: `supabase/functions/_shared/pagos.ts`
- Create: `tests/functions/pagos.test.ts` (o extiende el existente si ya hay uno de pagos)

**Interfaces:**
- Produces:

```ts
export type ResultadoHold = { ok: true; providerRef: string } | { ok: false; motivo: string };

export function buildPreautorizacionRequest(params: RedPontisOrderParams): HttpRequestSpec;
export function buildCapturaRequest(apiKey: string, providerRef: string): HttpRequestSpec;
export function buildAnulacionRequest(apiKey: string, providerRef: string): HttpRequestSpec;

export function mockPreautorizar(externalId: string): ResultadoHold;
export function mockCapturar(providerRef: string): ResultadoHold;
export function mockAnular(providerRef: string): ResultadoHold;
```

Las tres `build*` son stubs equivalentes a `buildRedPontisOrderRequest`: **arman el request y no lo ejecutan**. El `fetch` vive en los `index.ts` de Deno, que son E.2b.

- [ ] **Step 1: Escribir los tests que fallan**

Cubre, como mínimo:

- `buildPreautorizacionRequest` manda el `external_id` de nuestra orden y el `total` calculado server-side, con la API key en el header y **no** en el body.
- `buildCapturaRequest` y `buildAnulacionRequest` referencian el `providerRef` del hold, **no** el `external_id` — capturar un hold exige el identificador que devolvió el proveedor.
- `mockPreautorizar` devuelve un `providerRef` **determinista y derivado del `externalId`**, para que un reintento del mismo intento produzca el mismo ref (idempotencia sin estado).
- `mockCapturar` y `mockAnular` sobre el mismo ref dos veces devuelven `ok: true` las dos (idempotentes).
- **`mockCapturar` tras `mockAnular` del mismo ref devuelve `ok: false`.** Un hold anulado no se captura; es la regla que impide cobrar una invitación rechazada.

- [ ] **Step 2: Correr y verificar que falla**

```bash
npm test -- pagos
```

- [ ] **Step 3: Implementar el mínimo**

Mantén la propiedad isomórfica de `_shared/pagos.ts`: **solo Web Crypto y APIs estándar**, sin `Deno.` ni `node:`. Es lo que permite probar la lógica de dinero en Jest sin Docker.

Para el estado del mock (anulado vs capturado) **no uses una variable de módulo**: el mock corre en procesos distintos entre invocaciones. Deriva el resultado del propio `providerRef` (por ejemplo, prefijándolo al anular) o acepta el estado como parámetro explícito. Un mock con memoria global miente en producción-mock y pasa los tests igual.

- [ ] **Step 4: Verde**

```bash
npm test -- pagos
npm run typecheck
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/pagos.ts tests/functions/pagos.test.ts
git commit -m "feat(pagos): preautorizar, capturar y anular sobre PaymentProvider"
```

---

## Task 2: `confirmar_orden_pago` → captura sin `bar`

**Files:**
- Create: `supabase/migrations/20260910120000_capturar_orden.sql`
- Modify: `supabase/tests/13_confirmar_orden_pago.sql` → **≥ 15 aserciones**

**Interfaces:**
- Produces: `public.capturar_orden(p_orden_id uuid, p_resultado estado_orden, p_provider_ref text default null) returns text`, con los mismos retornos `'aplicada'` / `'ya_resuelta'` que la función vieja.
- La función vieja `confirmar_orden_pago` **se elimina** en la misma migración: dejarla viva sería dejar una puerta que escribe `bar`.

- [ ] **Step 1: Escribir el contrato de test**

`13_confirmar_orden_pago.sql`, **≥ 15 aserciones**, cubriendo:

1. Capturar una orden `preautorizada` la deja `capturada`.
2. Escribe **exactamente tres** filas de ledger: `compra +total`, `fee −buyer_fee`, `escrow_lock −valor_v`.
3. Las tres netean a **cero** — capturar no da saldo disponible a nadie.
4. `referencia_id` de las tres apunta a **la invitación**, no a la orden (spec §4).
5. **No** crea ninguna fila en ninguna tabla de stock (no existe; el assert es que el ledger y `ordenes_pago` son lo único que cambió).
6. Segunda llamada sobre la misma orden devuelve `'ya_resuelta'` y **no** duplica ledger.
7. Dos llamadas concurrentes se serializan por el row lock: la segunda ve el estado resuelto.
8. Capturar una orden ya `anulada` **falla** — un hold anulado no se captura.
9. Capturar una orden en `pendiente` (sin hold) falla.
10. `p_resultado` fuera de `('capturada','anulada','fallida')` lanza excepción.
11. `authenticated` **no** puede ejecutar la función (`revoke execute`), reproduciendo la llamada, no leyendo `pg_proc`.
12. `anon` tampoco.
13. Los montos que escribe salen de **la orden persistida**, no de parámetros — pasar un monto por argumento no es posible porque la firma no lo acepta; el assert es que el ledger coincide con `ordenes_pago`.
14. Anular una orden `preautorizada` la deja `anulada` y **no escribe ledger** (spec §4: el hold no es un movimiento).
15. Anular una orden ya `capturada` falla.

Reusa el setup del archivo viejo (`git show 9928e46:supabase/tests/13_confirmar_orden_pago.sql`) — su fixture de perfiles y órdenes sigue siendo válido salvo por `bar` y `bebida_catalogo_id`.

- [ ] **Step 2: Correr y verificar que falla, granular**

```bash
npm run test:db
```

Con el runner nuevo, un `plan(15)` con menos asserts ejecutados también sale rojo. Eso es tu red.

- [ ] **Step 3: Escribir la migración**

Parte de `git show 9928e46:supabase/migrations/20260723140000_confirmar_orden_pago.sql` y cambia lo que sigue. **Hipótesis:**

- Renombra a `capturar_orden`; `drop function public.confirmar_orden_pago(uuid, estado_orden, text);`.
- El CAS de estado ya no es `pendiente → confirmada/fallida`, sino **`preautorizada → capturada/anulada`**.
- El bloque de ledger se conserva **tal cual salvo `referencia_id`**, que pasa de `p_orden_id` a `v_orden.invitacion_id`. Las `idempotency_key` siguen derivadas del id de la orden (`:compra`, `:fee`, `:escrow_lock`) — **no las cambies a la invitación**, o un reintento con otra orden sobre la misma invitación colisionaría.
- El `insert into public.bar` **desaparece**. No lo sustituyas por nada.
- La rama `anulada` **no escribe ledger**.

- [ ] **Step 4: ALTO — el USUARIO revisa y autoriza**

Hay un `drop function`. Dilo.

- [ ] **Step 5: Aplicar y verificar por introspección**

```sql
select proname, pg_get_function_identity_arguments(oid) from pg_proc
 where proname in ('capturar_orden','confirmar_orden_pago');
```

Esperado: aparece `capturar_orden`, **no** aparece `confirmar_orden_pago`.

- [ ] **Step 6: Verde y commit**

```bash
npm run test:db
git add supabase/migrations/20260910120000_capturar_orden.sql supabase/tests/13_confirmar_orden_pago.sql
git commit -m "feat(db): capturar_orden reemplaza a confirmar_orden_pago, sin stock"
```

---

## Task 2b: La RLS de `invitaciones` falla cerrada por estado

> **Añadida el 2026-09-10.** Hallazgo real de la Tarea 3, encontrado por BUILDER reproduciendo el acceso —no leyendo `pg_policy`— y confirmado: **el receptor ve una invitación en `preautorizando`.**

**La causa.** `invitaciones_select_parte` (migración `20260723180000`) filtra solo por identidad:

```sql
using (emisor_id = (select auth.uid()) or receptor_id = (select auth.uid()))
```

Nunca se acotó por estado porque en la fase 4.0 **no existía ningún estado que debiera ocultarse**: `pendiente`, `aceptada`, `rechazada` y `expirada` son todos visibles para las dos partes por diseño. `preautorizando` es el primer estado que debe ocultarse de una de las partes, y la política no se revisó al añadirlo.

**No es explotable hoy** —ninguna fila llega a ese estado porque `crear_invitacion` todavía no lo produce— pero **la Tarea 3 lo activaría**. Por eso va antes.

### La decisión: lista blanca, no lista negra

BUILDER preguntó si basta con `and estado <> 'preautorizando'` o si habrá futuros estados que necesiten el mismo trato. **No basta, y esa es la parte importante.**

Un `<> 'preautorizando'` es una lista negra: **cada estado nuevo del enum es visible para el receptor por defecto**, y protegerlo depende de que alguien se acuerde de volver aquí. Es exactamente el fallo que estamos arreglando, repetido — la fase 4.0 tampoco "se acordó".

La política se escribe como **lista blanca**:

```sql
using (
  emisor_id = (select auth.uid())
  or (
    receptor_id = (select auth.uid())
    and estado in ('pendiente', 'aceptada', 'rechazada', 'expirada')
  )
)
```

Así, **cualquier etiqueta que se añada a `estado_invitacion` en el futuro nace invisible para el receptor** y hay que abrirla a propósito. Falla cerrada. Si mañana existe un estado de error de preautorización, ya está protegido sin que nadie lo recuerde.

El emisor ve siempre su propia invitación, en cualquier estado: es suya y está en curso.

**Files:**
- Create: `supabase/migrations/20260910160000_rls_invitaciones_por_estado.sql`
- Modify: `supabase/tests/15_invitaciones_rls.sql` → `plan(9)` sube a **`plan(12)`**

**Interfaces:**
- Produces: `invitaciones_select_parte` redefinida. Sin cambio de nombre, sin cambio de firma; solo el `using`.

- [ ] **Step 1: Escribir los tres asserts que faltan**

En `15_invitaciones_rls.sql`, sube `plan(9)` a `plan(12)` y añade, **reproduciendo la lectura real** como cada rol (mismo patrón que el noveno assert que escribiste al arreglar el runner):

1. El receptor **no ve** una invitación en `preautorizando`.
2. El **emisor sí la ve** en `preautorizando` — es suya y está en curso; ocultársela sería un bug distinto.
3. El receptor **sí ve** la misma invitación una vez en `pendiente` — la lista blanca no debe romper el camino normal.

- [ ] **Step 2: Rojo granular**

```bash
npm run test:db
```

Esperado: el assert 1 falla (hoy la ve), los asserts 2 y 3 pasan ya. **Di explícitamente en el reporte que 2 y 3 no estuvieron en rojo** — son de regresión, no de validación; su valor es que fallen si la lista blanca se escribe mal.

- [ ] **Step 3: Escribir la migración**

```sql
-- Fase E.2a, Tarea 2b — La visibilidad de una invitación depende del estado,
-- no solo de la identidad.
--
-- `invitaciones_select_parte` (20260723180000) filtraba solo por identidad,
-- porque en la Fase 4.0 ningún estado debía ocultarse de una de las partes.
-- `preautorizando` es el primero: mientras la preautorización no responde, la
-- invitación no existe para el amigo — si el hold falla, nunca existió.
--
-- Se escribe como LISTA BLANCA a propósito. Con una lista negra
-- (`estado <> 'preautorizando'`) cada etiqueta nueva del enum nacería visible
-- para el receptor y dependería de que alguien recordara volver aquí — que es
-- justo el fallo que esta migración corrige. Así falla cerrada: un estado
-- nuevo es invisible hasta que se le abra la puerta a propósito.

drop policy invitaciones_select_parte on public.invitaciones;

create policy invitaciones_select_parte
  on public.invitaciones for select
  to authenticated
  using (
    emisor_id = (select auth.uid())
    or (
      receptor_id = (select auth.uid())
      and estado in ('pendiente', 'aceptada', 'rechazada', 'expirada')
    )
  );
```

- [ ] **Step 4: ALTO — el USUARIO revisa y autoriza**

Es un `drop policy` sobre una tabla con datos. **Dile que es la corrección de un hallazgo de seguridad**, no una mejora: hasta ahora el receptor podía ver invitaciones que aún no estaban pagadas.

- [ ] **Step 5: Aplicar y verificar por introspección**

```sql
select polname, pg_get_expr(polqual, polrelid) from pg_policy
 where polrelid = 'public.invitaciones'::regclass;
```

- [ ] **Step 6: Verde y commit**

```bash
npm run test:db
git add supabase/migrations/20260910160000_rls_invitaciones_por_estado.sql supabase/tests/15_invitaciones_rls.sql
git commit -m "fix(db): el receptor no ve una invitacion en preautorizando"
```

---

## Task 3: `crear_invitacion` crea la invitación y su orden

**Files:**
- Create: `supabase/migrations/20260910130000_crear_invitacion_preautorizando.sql`
- Modify: `supabase/tests/19_crear_invitacion.sql` → **≥ 19 aserciones**

**Interfaces:**
- Produces: `public.crear_invitacion(p_emisor_id uuid, p_receptor_id uuid, p_tipo tipo_propuesta, p_bebida_catalogo_id uuid, p_tiempo_estimado_min integer, p_zona_aproximada text, p_idempotency_key text) returns public.invitaciones`.
- **Cambio de firma:** `p_bebida_bar_id` pasa a `p_bebida_catalogo_id`. La firma vieja se elimina con `drop function`.
- La invitación nace en **`preautorizando`** y **crea su `orden_pago` en `pendiente`** dentro de la misma transacción. La transición a `pendiente` (visible para el amigo) la hace la preautorización, en E.2b.

- [ ] **Step 1: Escribir el contrato de test**

`19_crear_invitacion.sql`, **≥ 19 aserciones**. Los casos viejos que **siguen valiendo** y hay que conservar: gate de KYC del emisor, nadie se invita a sí mismo, coherencia por tipo, idempotencia por `idempotency_key` (fast-path y carrera con `unique_violation`), `EXECUTE` denegado a `authenticated` y `anon`. Los casos **nuevos**:

- Una `invitacion` nace en estado **`preautorizando`**, no en `pendiente`.
- Crea **una** `orden_pago` ligada a esa invitación, en `pendiente`.
- Los montos de esa orden salen de `bebidas_catalogo.valor_v` **calculados en la base**, no de parámetros.
- Una `solicitud` **no** crea orden (el dinero lo pone el rentador al aceptar, spec §4.1) y lleva `bebida_catalogo_id` nulo.
- Un `p_bebida_catalogo_id` de una bebida **inactiva** falla.
- Un reintento con la misma `idempotency_key` devuelve la invitación ya creada y **no** crea una segunda orden.
- La invitación en `preautorizando` **no es visible para el receptor** bajo su RLS — reproduce la lectura como el receptor.

Ese último es el que sostiene "el amigo no ve una invitación que aún no está pagada". Si la RLS actual no lo cumple, **es un hallazgo, no un test que ajustar**: páralo y avísame.

- [ ] **Step 2: Rojo granular** → `npm run test:db`

- [ ] **Step 3: Escribir la migración**

Parte de **`20260724130000_invitacion_idempotency_scope.sql`**, que es la ultima migracion que define `crear_invitacion` — NO de la original `20260724120000`. Conserva **intacto** el patrón de idempotencia: reclamar la fila de invitación **primero**, capturar `unique_violation` y devolver la existente. Ese orden fue deliberado en la fase 4.2 y sigue siendo correcto. Lo que cambia:

- El bloque que bloqueaba la bebida del bar **se sustituye** por: calcular el desglose desde `bebidas_catalogo` e insertar la `orden_pago`.
- **El desglose se calcula en SQL.** Hoy vive en TypeScript (`calcularDesgloseCompra`, 15% en centavos). **Duplicarlo en SQL es una fuente de deriva y hay que decirlo en el commit** — anótalo en `docs/backlog.md` como deuda: el fee vive en dos sitios, y cuando los niveles (SP6) lo hagan variable habrá que unificarlo. Para E.2a, replica el cálculo en centavos (`round(v * 100 * 0.15)`) para que coincida al céntimo con el de TypeScript.

- [ ] **Step 4: ALTO — el USUARIO revisa y autoriza** (`drop function` de la firma vieja)

- [ ] **Step 5: Introspección**

```sql
select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'crear_invitacion';
```

Esperado: una sola firma, con `p_bebida_catalogo_id`.

- [ ] **Step 6: Verde y commit**

```bash
git add supabase/migrations/20260910130000_crear_invitacion_preautorizando.sql supabase/tests/19_crear_invitacion.sql docs/backlog.md
git commit -m "feat(db): la invitacion nace preautorizando con su orden de pago"
```

---

## Task 3b: `confirmar_preautorizacion` — la pieza que faltaba

> **Añadida el 2026-09-10, antes de arrancar la Tarea 4.** Defecto del plan encontrado en una revisión previa, no en ejecución.

**El agujero.** La Tarea 3 deja la invitación en `preautorizando` y su orden en `pendiente`. **Nada en todo E.2a las mueve de ahí.** Yo había escrito que "la transición a `pendiente` la hace la preautorización, en E.2b" — pero E.2b son Edge Functions, y esto son **dos escrituras acopladas que tienen que ser atómicas**: si se hacen desde TypeScript por separado, un fallo entre medias deja una orden preautorizada con su invitación invisible para siempre, o al revés. Es una función SQL, y por tanto es de esta fase.

Sin esta tarea, E.2b tendría que inventarla sin plan o hacer `update` sueltos desde el Edge Function — que es exactamente lo que prohíben las reglas de dinero del proyecto.

**Files:**
- Create: `supabase/migrations/20260910135000_confirmar_preautorizacion.sql`
- Create: `supabase/tests/34_confirmar_preautorizacion.sql` → **≥ 12 aserciones**

**Interfaces:**
- Produces: `public.confirmar_preautorizacion(p_orden_id uuid, p_ok boolean, p_provider_ref text default null) returns text`, con `'aplicada'` / `'ya_resuelta'` como la familia de funciones de esta fase.
- Consumes: `public.capturar_orden` de la Tarea 2.

**Qué hace, según el tipo de la invitación:**

| Caso | Orden queda | Invitación queda | Además |
|---|---|---|---|
| `p_ok` y tipo `invitacion` | `preautorizada` | `pendiente` | Recién ahora el amigo la ve |
| `p_ok` y tipo `solicitud` | `capturada` | `aceptada` | Captura en el acto y abre la cita: las dos partes ya acordaron |
| `not p_ok` y tipo `invitacion` | `fallida` | `expirada` | Sin ledger. Nunca llegó a ser visible para nadie |
| `not p_ok` y tipo `solicitud` | `fallida` | **`pendiente`** | Sin ledger. Vuelve a esperar respuesta del rentador |

> **Corrección del 2026-09-10, defecto mío detectado al revisar el SQL de la Tarea 3b.** La versión anterior de esta tabla mandaba la invitación a `expirada` en los dos caminos. Para una `solicitud` eso es incorrecto: el amigo manda la solicitud, el rentador la acepta y elige bebida, **falla la tarjeta del rentador** — y la petición del amigo moriría por un problema ajeno, obligándolo a mandarla otra vez sin entender por qué. Vuelve a `pendiente`: el rentador nunca llegó a aceptar y puede reintentar con otra tarjeta. El índice único parcial de E.1 ya permite ese segundo intento, porque solo bloquea órdenes `preautorizada`/`capturada` vivas y la fallida no cuenta.
>
> **Convención de locks para toda la serie E, fijada aquí:** `invitaciones` primero, `ordenes_pago` después. Es el orden que ya usaba `responder_invitacion`; tomarlos al revés en una función nueva abre un deadlock entre transacciones concurrentes.

El caso `solicitud` captura de inmediato porque el acuerdo ya está cerrado: el amigo pidió y el rentador aceptó. No hay a quién esperar.

- [ ] **Step 1: Escribir el test — ≥ 12 aserciones**

1. `p_ok` sobre una `invitacion`: orden a `preautorizada`, invitación a `pendiente`.
2. Y **no escribe ledger** — el hold no es un movimiento (spec §4).
3. Tras esa transición, **el receptor sí ve la invitación** (reproduce la lectura como el receptor; complementa la Tarea 2b por el otro lado).
4. `p_ok` sobre una `solicitud`: orden a `capturada`, invitación a `aceptada`.
5. Y **sí escribe las tres filas de ledger** de la captura.
6. Y crea la fila de `citas`.
7. `not p_ok`: orden a `fallida`, invitación a `expirada`.
8. Y **no escribe ledger**.
9. Segunda llamada con el mismo resultado devuelve `'ya_resuelta'` y no duplica nada.
10. Llamar sobre una orden que no está en `pendiente` es transición ilegal → excepción (mismo criterio que `capturar_orden`).
11. `authenticated` no puede ejecutarla — reprodúcelo, no leas `pg_proc`.
12. `anon` tampoco.

- [ ] **Step 2: Rojo granular** → `npm run test:db`

- [ ] **Step 3: Escribir la migración**

Row lock sobre la orden, igual que `capturar_orden`. Para el caso `solicitud`, **llama a `capturar_orden`** en vez de duplicar el bloque de ledger — corre dentro de la misma transacción, así que la atomicidad se mantiene.

> **La lógica de "aceptar" está en dos sitios y hay que decidirlo aquí, no descubrirlo en la Tarea 4.** Abrir la cita al aceptar la necesitan esta función (camino `solicitud`) y `responder_invitacion` (camino `invitacion`). **Extrae ese paso a una función interna** —por ejemplo `public.abrir_cita(p_invitacion_id uuid)`— y llámala desde las dos. Duplicar el `insert into public.citas` es garantía de que dentro de dos fases una de las dos copias se quede atrás.

- [ ] **Step 4: ALTO — el USUARIO revisa y autoriza**

- [ ] **Step 5: Introspección + Step 6: Verde y commit**

```bash
git add supabase/migrations/20260910135000_confirmar_preautorizacion.sql supabase/tests/34_confirmar_preautorizacion.sql
git commit -F <archivo>   # nunca -m inline con backticks
```

---

## Task 3c: Una `solicitud` nace en `pendiente`, no en `preautorizando`

> **Añadida el 2026-09-10.** Bug real en la Tarea 3 **ya aplicada**, encontrado por BUILDER antes de escribir el fixture de la Tarea 4. **Defecto del plan:** mi contrato decía en qué estado nace una `invitacion` y que una `solicitud` no crea orden, pero **nunca dijo en qué estado nace una `solicitud`** — y la lista de tests pedía comprobar el estado inicial de una rama y no el de la otra.

**El bug.** `crear_invitacion` inserta **toda** invitación con `estado = 'preautorizando'`, sin distinguir tipo, y solo crea `orden_pago` cuando `tipo = 'invitacion'`. Una `solicitud` queda entonces:

- **invisible para su receptor** — la lista blanca de la Tarea 2b no incluye `preautorizando`;
- **inmóvil** — `confirmar_preautorizacion` opera sobre una orden, y una `solicitud` recién creada no tiene ninguna.

No es un caso límite: **es el camino normal de toda solicitud**. El sub-proyecto 4 entero quedaría muerto por ese lado.

**Por qué `pendiente` es lo correcto.** Una `solicitud` no tiene nada que preautorizar al crearse: el dinero lo pone el rentador **al aceptar**, y hasta entonces no hay importe ni tarjeta. `preautorizando` describe un hold en vuelo, y aquí no hay ninguno. La solicitud pasa por `preautorizando` **más tarde**, cuando el rentador acepta y elige bebida (Tarea 4) — que es justo el momento en que aparece la orden.

**Files:**
- Create: `supabase/migrations/20260910145000_solicitud_nace_pendiente.sql`
- Modify: `supabase/tests/19_crear_invitacion.sql` → **≥ 29 aserciones** (26 actuales + 3)

- [ ] **Step 1: Escribir los tres asserts que faltan**

1. Una `solicitud` recién creada queda en **`pendiente`**, no en `preautorizando`.
2. **Su receptor la ve** — reproduce la lectura como el rentador bajo su RLS. Este es el que habría cazado el bug.
3. Una `invitacion` recién creada **sigue** naciendo en `preautorizando` (regresión: la corrección no debe tocar la otra rama).

- [ ] **Step 2: Rojo granular** — el 1 y el 2 fallan, el 3 pasa ya. **Dilo en el reporte.**

- [ ] **Step 3: Escribir la migración**

`create or replace function public.crear_invitacion(...)` con la misma firma —**no cambia ningún parámetro, así que `create or replace` basta**— y el `estado` del insert pasa a ser condicional:

```sql
      (case when p_tipo = 'invitacion' then 'preautorizando' else 'pendiente' end)::estado_invitacion,
```

Cuidado con el cast explícito: dentro de un `CASE`, Postgres tipa el resultado como `text` y no lo castea solo al enum. Ya mordió en la Tarea 3b.

Todo lo demás de la función queda **intacto**: el patrón de idempotencia scoped por emisor, el gate de KYC, la validación de bebida activa y el bloque de la orden.

- [ ] **Step 4: ALTO — BRAIN revisa y autoriza** (reversible: `create or replace`, sin `drop`)

- [ ] **Step 5: Introspección + Step 6: Verde y commit**

Comprueba además, sobre la base ya migrada, que no quedan filas huérfanas de una `solicitud` en `preautorizando`:

```sql
select count(*) from public.invitaciones where tipo = 'solicitud' and estado = 'preautorizando';
```

Esperado: 0. Si no lo es, **no las arregles por tu cuenta** — dímelo: serían datos y eso lo aprueba el usuario, no yo.

---

## Task 4: `responder_invitacion` — aceptar captura, rechazar anula

**Files:**
- Create: `supabase/migrations/20260910140000_responder_invitacion_captura.sql`
- Modify: `supabase/tests/20_responder_invitacion.sql` → **≥ 30 aserciones**

**Interfaces:**
- **La firma real de hoy es `responder_invitacion(p_receptor_id uuid, p_invitacion_id uuid, p_accion text, p_bebida_bar_id uuid) returns text`** — verifícala tú con `\df` o `pg_get_function_identity_arguments` antes de escribir nada; la que este plan traía antes tenía el orden, los nombres y el tipo de retorno mal.
- Produces: `responder_invitacion(p_receptor_id uuid, p_invitacion_id uuid, p_accion text, p_bebida_catalogo_id uuid) returns text`. **Solo cambia el cuarto parámetro.** Conserva el orden y el `returns text`: menos superficie que tocar en E.2b.
- **Cambia un nombre de parámetro → `drop function` + `create`, no `create or replace`.** Postgres rechaza el renombrado (`cannot change name of input parameter`); ya te mordió en la Tarea 3.

> ### Corrección de diseño, 2026-09-10 — leer antes del Step 1
>
> La versión anterior de esta tarea decía que aceptar una `solicitud` "crea la orden y la captura en el mismo acto". **Eso no se puede construir:** `capturar_orden` exige que la orden esté `preautorizada`, y **una función SQL no puede llamar al proveedor de pagos**. No hay forma de preautorizar desde aquí.
>
> **El camino de la `solicitud` se vuelve simétrico al de la `invitacion`:**
>
> ```
> solicitud pendiente
>   └→ rentador acepta y elige bebida
>      → responder_invitacion: crea la orden en `pendiente`
>        y deja la invitación en `preautorizando`
>      → (el Edge Function preautoriza — E.2b)
>      → confirmar_preautorizacion (Tarea 3b): captura y deja `aceptada` + abre la cita
> ```
>
> Una sola máquina de estados, sin caso especial. **`responder_invitacion` ya no captura nada en el camino `solicitud`** — solo prepara. Quien captura es la Tarea 3b.
>
> Beneficio lateral: desaparece el problema de atomicidad que este plan avisaba para E.2b en este camino. El `fetch` al proveedor queda **entre** dos funciones SQL, no dentro de una.

- [ ] **Step 1: Escribir el contrato de test**

**≥ 30 aserciones.** Conserva del archivo viejo: solo el receptor responde, `AY404` / `AY403`, idempotencia, apertura de la cita al aceptar, `EXECUTE` denegado a `authenticated` y `anon`, y el gate de KYC con el scope que trajo la migración `kyc_scope`. Lo nuevo:

- Aceptar una `invitacion` en `pendiente` captura su orden (queda `capturada`) y deja la invitación `aceptada`. Aquí **sí** captura: el hold ya existe, lo puso la Tarea 3b.
- Y escribe las tres filas de ledger de la captura, con `referencia_id` en la invitación.
- Rechazar una `invitacion` deja su orden **`anulada`** y **sin ninguna fila de ledger**.
- Rechazar una invitación cuya orden ya está `capturada` **falla** — no se rechaza algo ya cobrado.
- Aceptar una `solicitud` **exige** `p_bebida_catalogo_id`, crea su orden en `pendiente` y deja la invitación en **`preautorizando`**. **No captura, no escribe ledger, no abre cita todavía.**
- Aceptar una `solicitud` **no** deja la invitación en `aceptada` — el que la cierra es `confirmar_preautorizacion`.
- Aceptar una `solicitud` con una bebida **inactiva** del catálogo falla.
- Rechazar **no** acepta `p_bebida_catalogo_id`.
- Una invitación ya respondida no se re-responde ni re-captura.
- El receptor de una `solicitud` tiene que estar KYC-verificado (compromete dinero).
- Un tercero que no es el receptor no puede responder — reprodúcelo.

- [ ] **Step 2: Rojo granular** → `npm run test:db`

- [ ] **Step 3: Escribir la migración**

Parte de **`20260724160000_responder_invitacion_kyc_scope.sql`**, que es la última migración que define `responder_invitacion` — NO de la original `20260724150000`. Conserva el row lock, el patrón de idempotencia y el gate de KYC con su scope. Lo que cambia:

- El bloque que **liberaba** la bebida del bar al rechazar → `capturar_orden(orden, 'anulada')`.
- El bloque que **asignaba** una bebida del bar al aceptar una `solicitud` → crear la `orden_pago` en `pendiente` y mover la invitación a `preautorizando`. **Sin capturar.**
- Aceptar una `invitacion` → `capturar_orden(orden, 'capturada')` y `aceptada`.
- La apertura de la cita usa **`abrir_cita`**, la función interna que extrajiste en la Tarea 3b. No dupliques el `insert into public.citas`.

> **Sobre la atomicidad, actualizado.** En el camino `invitacion`, `capturar_orden` corre dentro de esta transacción: si lanza, aborta todo. En el camino `solicitud` ya no hay captura aquí, así que el `fetch` al proveedor de E.2b queda **entre** dos funciones SQL en vez de dentro de una — que es justo lo que evita el problema. **Anota igual en `docs/backlog.md`** que en E.2b el orden correcto es llamar al proveedor **primero** y escribir la base después, con la idempotencia como red ante un fallo entre medias.

- [ ] **Step 4: ALTO — el USUARIO revisa y autoriza**

- [ ] **Step 5: Introspección + Step 6: Verde y commit**

```bash
git add supabase/migrations/20260910140000_responder_invitacion_captura.sql supabase/tests/20_responder_invitacion.sql docs/backlog.md
git commit -m "feat(db): aceptar captura el hold, rechazar lo anula"
```

---

## Task 5: Redefinir la conciliación

**Files:**
- Create: `supabase/migrations/20260910150000_conciliacion_sin_bar.sql`
- Modify: `supabase/tests/14_conciliacion_sp3.sql` → **≥ 8 aserciones**

**No es hacerla compilar.** `detectar_discrepancias_sp3` comparaba el ledger contra el stock del bar; sin `bar`, esa pregunta ya no significa nada (spec §10.1). Hay que decidir **qué concilia ahora**.

Las invariantes vigentes estan en **`20260723160000_conciliacion_montos.sql`**, que es la ultima migracion que define `detectar_discrepancias_sp3` — NO en la original `20260723150000`. Esa segunda migracion anadio invariantes de montos que la primera no tiene. Leelas antes de escribir: sobreviven todas menos la que compara contra el stock. La cuarta, `escrow_bar_conteo_desbalance`, es la que muere.

- [ ] **Step 1: Escribir el contrato de test**

**≥ 8 aserciones.** La invariante 4 se **reemplaza** por estas tres, que son las que el modelo nuevo puede violar:

- **`escrow_captura_desbalance`**: el número de filas `escrow_lock` del ledger tiene que igualar el número de `ordenes_pago` en `capturada`. Una captura sin ledger, o ledger sin captura, es una discrepancia.
- **`hold_huerfano`**: una `ordenes_pago` en `preautorizada` cuya invitación ya está `aceptada`, `rechazada` o `expirada`. Significa un hold que nadie capturó ni anuló — dinero retenido en la tarjeta de alguien sin motivo. **Es la discrepancia más cara para el usuario final** y no existía en el modelo viejo.
- **`anulada_con_ledger`**: una orden `anulada` que tenga cualquier fila de ledger. Sería un cobro por algo que se rechazó.

Cada una necesita su test: **fabricar la discrepancia y comprobar que la función la reporta**, y comprobar que con datos sanos devuelve cero filas.

- [ ] **Step 2: Rojo** → `npm run test:db`

- [ ] **Step 3: Escribir la migración** (`create or replace`, conservando las invariantes 1-3)

- [ ] **Step 4: ALTO — el USUARIO revisa y autoriza**

- [ ] **Step 5: Introspección + Step 6: Verde y commit**

```bash
git add supabase/migrations/20260910150000_conciliacion_sin_bar.sql supabase/tests/14_conciliacion_sp3.sql
git commit -m "feat(db): la conciliacion compara ledger contra capturas, no contra stock"
```

---

## Cierre de E.2a

- [ ] **Verificar el contrato de cobertura.** Pega la cuenta por archivo:

```bash
npm run test:db 2>&1 | grep -E "1[349]_|20_"
```

Esperado: `13` ≥ 15, `14` ≥ 8, `19` ≥ 19, `20` ≥ 30. **Si alguno queda por debajo, E.2a no está cerrada** — dilo en vez de cerrarla.

- [ ] **Confirmar que ninguna función referencia ya la tabla muerta:**

```sql
select proname from pg_proc where prosrc like '%public.bar%' or prosrc like '% bar %';
```

Esperado: **ninguna fila**. Al empezar E.2a eran cuatro.

- [ ] Correr las cuatro suites y pegar la salida real. Decir cuántas suites jest siguen en `.skip` (deberían seguir siendo 3 — las repone E.3/E.4).
- [ ] `git diff tsconfig.json` limpio. **Sin push.** **No cerrar la fase**: eso lo declara el usuario.
- [ ] Reportar las dos deudas nuevas anotadas en `docs/backlog.md`: el fee duplicado en SQL y TypeScript, y la atomicidad de la captura cuando pase a ser HTTP en E.2b.
