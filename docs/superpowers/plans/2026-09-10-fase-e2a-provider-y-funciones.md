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
| `supabase/migrations/20260910130000_crear_invitacion_por_pagar.sql` | `crear_invitacion` reescrita: crea la invitación en `por_pagar` y su orden. |
| `supabase/migrations/20260910140000_responder_invitacion_captura.sql` | `responder_invitacion` reescrita: aceptar captura, rechazar anula. |
| `supabase/migrations/20260910150000_conciliacion_sin_bar.sql` | `detectar_discrepancias_sp3` **redefinida**. |
| `supabase/tests/13_confirmar_orden_pago.sql` | ≥ 15 aserciones. |
| `supabase/tests/14_conciliacion_sp3.sql` | ≥ 8 aserciones. |
| `supabase/tests/19_crear_invitacion.sql` | ≥ 19 aserciones. |
| `supabase/tests/20_responder_invitacion.sql` | ≥ 30 aserciones. |

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

## Task 3: `crear_invitacion` crea la invitación y su orden

**Files:**
- Create: `supabase/migrations/20260910130000_crear_invitacion_por_pagar.sql`
- Modify: `supabase/tests/19_crear_invitacion.sql` → **≥ 19 aserciones**

**Interfaces:**
- Produces: `public.crear_invitacion(p_emisor_id uuid, p_receptor_id uuid, p_tipo tipo_propuesta, p_bebida_catalogo_id uuid, p_tiempo_estimado_min integer, p_zona_aproximada text, p_idempotency_key text) returns public.invitaciones`.
- **Cambio de firma:** `p_bebida_bar_id` pasa a `p_bebida_catalogo_id`. La firma vieja se elimina con `drop function`.
- La invitación nace en **`por_pagar`** y **crea su `orden_pago` en `pendiente`** dentro de la misma transacción. La transición a `pendiente` (visible para el amigo) la hace la preautorización, en E.2b.

- [ ] **Step 1: Escribir el contrato de test**

`19_crear_invitacion.sql`, **≥ 19 aserciones**. Los casos viejos que **siguen valiendo** y hay que conservar: gate de KYC del emisor, nadie se invita a sí mismo, coherencia por tipo, idempotencia por `idempotency_key` (fast-path y carrera con `unique_violation`), `EXECUTE` denegado a `authenticated` y `anon`. Los casos **nuevos**:

- Una `invitacion` nace en estado **`por_pagar`**, no en `pendiente`.
- Crea **una** `orden_pago` ligada a esa invitación, en `pendiente`.
- Los montos de esa orden salen de `bebidas_catalogo.valor_v` **calculados en la base**, no de parámetros.
- Una `solicitud` **no** crea orden (el dinero lo pone el rentador al aceptar, spec §4.1) y lleva `bebida_catalogo_id` nulo.
- Un `p_bebida_catalogo_id` de una bebida **inactiva** falla.
- Un reintento con la misma `idempotency_key` devuelve la invitación ya creada y **no** crea una segunda orden.
- La invitación en `por_pagar` **no es visible para el receptor** bajo su RLS — reproduce la lectura como el receptor.

Ese último es el que sostiene "el amigo no ve una invitación que aún no está pagada". Si la RLS actual no lo cumple, **es un hallazgo, no un test que ajustar**: páralo y avísame.

- [ ] **Step 2: Rojo granular** → `npm run test:db`

- [ ] **Step 3: Escribir la migración**

Parte de `git show 9928e46:supabase/migrations/20260724120000_crear_invitacion.sql`. Conserva **intacto** el patrón de idempotencia: reclamar la fila de invitación **primero**, capturar `unique_violation` y devolver la existente. Ese orden fue deliberado en la fase 4.2 y sigue siendo correcto. Lo que cambia:

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
git add supabase/migrations/20260910130000_crear_invitacion_por_pagar.sql supabase/tests/19_crear_invitacion.sql docs/backlog.md
git commit -m "feat(db): la invitacion nace por_pagar con su orden de pago"
```

---

## Task 4: `responder_invitacion` — aceptar captura, rechazar anula

**Files:**
- Create: `supabase/migrations/20260910140000_responder_invitacion_captura.sql`
- Modify: `supabase/tests/20_responder_invitacion.sql` → **≥ 30 aserciones**

**Interfaces:**
- Produces: `public.responder_invitacion(p_invitacion_id uuid, p_receptor_id uuid, p_respuesta text, p_bebida_catalogo_id uuid default null) returns public.invitaciones`.

- [ ] **Step 1: Escribir el contrato de test**

**≥ 30 aserciones.** Conserva del archivo viejo: solo el receptor responde, `AY404` / `AY403`, idempotencia, apertura de la cita y el chat al aceptar, `EXECUTE` denegado a `authenticated` y `anon`. Lo nuevo:

- Aceptar una `invitacion` en `pendiente` invoca la captura de su orden y la deja `capturada`; la invitación queda `aceptada`.
- Rechazar una `invitacion` deja su orden **`anulada`** y **sin ninguna fila de ledger**.
- Aceptar una `solicitud` **exige** `p_bebida_catalogo_id`, crea la orden y la captura en el mismo acto (spec §4.1).
- Si la captura falla, la solicitud **queda en `pendiente`**, no `aceptada`, y **no** se abre chat. Atomicidad: todo o nada.
- Rechazar **no** acepta `p_bebida_catalogo_id`.
- Una invitación ya respondida no se re-responde ni re-captura.
- El receptor de una `solicitud` tiene que estar KYC-verificado (compromete dinero).

- [ ] **Step 2: Rojo granular** → `npm run test:db`

- [ ] **Step 3: Escribir la migración**

Parte de `git show 9928e46:supabase/migrations/20260724150000_responder_invitacion.sql`. Sustituye los bloques de `bar` (liberar / asignar) por llamadas a `capturar_orden`. Conserva el row lock y el patrón de idempotencia.

> **Ojo con la atomicidad.** `capturar_orden` es una función SQL, así que corre **dentro** de la transacción de `responder_invitacion`: si lanza, aborta todo. Eso es lo que quieres. En E.2b, cuando la captura real sea una llamada HTTP al proveedor, **esa propiedad se rompe** — un `fetch` no participa de la transacción. Anótalo en `docs/backlog.md` ahora: el orden correcto en E.2b es capturar en el proveedor **primero** y escribir la base después, con la idempotencia de `capturar_orden` como red ante un fallo entre medias. No lo resuelvas aquí.

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

**Files:** las tres primeras invariantes del original (`20260723150000_conciliacion_sp3.sql`) siguen siendo válidas — léelas antes de escribir. La cuarta, `escrow_bar_conteo_desbalance`, es la que muere.

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
