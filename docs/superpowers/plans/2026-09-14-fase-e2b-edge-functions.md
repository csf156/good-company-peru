# Fase E.2b — Edge Functions del ciclo hold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** conectar las funciones SQL de E.2a con el proveedor de pagos, y dejar la rama verde sin UI nueva.

**Architecture:** las Edge Functions quedan como cáscara delgada. **Toda decisión de orquestación —si hay que preautorizar, si esto es un reintento, qué RPC toca según el evento del webhook— vive en `_shared/` como función pura**, probada con Jest. Es el patrón que ya usa `pagos.ts` y es la única forma de tener cobertura: los `index.ts` corren en Deno y ninguna suite los ejecuta.

**Tech Stack:** Deno (Edge Functions), Jest para `_shared/`, pgTAP para lo que ya está en E.2a.

**Spec:** `docs/superpowers/specs/2026-09-09-rediseno-dinero-sbs-design.md` §4 y §4.1.

**Al cerrar E.2b la app sigue sin Tienda ni Bar y las 3 suites jest siguen en `.skip`.** Eso es E.3/E.4. No las toques.

## Global Constraints

- **Red Pontis auth/capture/void sigue ASUMIDO, no confirmado.** Todo contra `mock`. El adaptador real se queda en stub.
- **El cliente nunca calcula ni mueve dinero.** Montos server-side, RPC con `service_role`.
- **Lógica testeable en `_shared/`, cáscara en `index.ts`.** Si escribes un `if` de negocio dentro de un `index.ts`, va en el sitio equivocado.
- **ALTO de SQL: mío.** En E.2b no debería haber migraciones; si aparece una, mándamela igual.
- Rutas explícitas en `git add`. Nunca `-A`, nunca `--amend`, sin push. `git diff tsconfig.json` antes de cada commit. Mensajes de commit por `-F`, nunca `-m` inline con backticks.
- **El código de este plan es una hipótesis.** En E.2a, seis de nueve bloques destaparon defectos de premisa. **Si un test y el snippet se contradicen, gana el test** — y avísame.
- **Todo estado en el que una fila puede nacer o quedar tiene que tener salida, y hay que probarlo.** Regla heredada de E.2a, donde su ausencia dejó toda `solicitud` muerta al nacer.

---

## El problema central de esta fase, que hay que tener claro antes de la Tarea 1

En E.2a la atomicidad era gratis: todo corría dentro de una transacción de Postgres. **Aquí se acaba.** El flujo es:

```
transacción 1   crear_invitacion  → invitación 'preautorizando' + orden 'pendiente'
      ↓
   HTTP al proveedor (NO participa de ninguna transacción)
      ↓
transacción 2   confirmar_preautorizacion → invitación 'pendiente' + orden 'preautorizada'
```

Si el proceso muere entre medias, queda una invitación en `preautorizando` que el receptor no ve y que nada mueve. **Ya está anotado en backlog** como hueco conocido, y no se resuelve en esta fase — pero condiciona dos reglas que sí son de esta fase:

1. **Llamar al proveedor PRIMERO, escribir la base DESPUÉS.** Al revés, un fallo del proveedor dejaría la base diciendo que hay un hold que no existe. Un hold real sin registrar es recuperable (la conciliación lo ve); un registro sin hold real es dinero fantasma.
2. **Nunca preautorizar dos veces la misma orden.** Es la regla más importante de la fase: un doble hold retiene el dinero del rentador dos veces.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/functions/_shared/pagos.ts` | Gana el vocabulario de eventos del ciclo hold y las decisiones de orquestación, como funciones puras. |
| `tests/functions/pagos.test.ts` | Tests jest de esas decisiones. |
| `supabase/functions/crear-invitacion/index.ts` | Tras crear, preautoriza y confirma. |
| `supabase/functions/responder-invitacion/index.ts` | Parámetro renombrado; preautoriza al aceptar una `solicitud`. |
| `supabase/functions/pago-webhook/index.ts` | Enruta al RPC correcto según el evento. |
| `supabase/functions/comprar-bebida/` | **Se elimina entero.** |
| `lib/tienda.ts` | Pierde `comprarBebida`. |
| `scripts/seed-demo.mjs` | Siembra por el flujo nuevo. |

---

## Task 1: El vocabulario del ciclo hold, como lógica pura

**Files:**
- Modify: `supabase/functions/_shared/pagos.ts`
- Modify: `tests/functions/pagos.test.ts`

**Interfaces:**
- Produces:

```ts
export type EventoHold = 'autorizado' | 'capturado' | 'anulado' | 'fallido';
export type ParsedHoldWebhook = { ordenId: string; evento: EventoHold; providerRef: string | null };

/** Traduce el payload del partner al vocabulario del hold. Null si no aplica. */
export function parseHoldWebhookPayload(payload: unknown): ParsedHoldWebhook | null;

/** Qué RPC toca para un evento dado, o null si el evento no requiere acción. */
export function rpcParaEvento(evento: EventoHold):
  | { rpc: 'confirmar_preautorizacion'; ok: boolean }
  | { rpc: 'capturar_orden'; resultado: 'capturada' | 'anulada' }
  | null;

/** ¿Hay que llamar al proveedor para preautorizar esta orden, o ya está hecho? */
export function debePreautorizar(estadoOrden: string): boolean;
```

- [ ] **Step 1: Escribir los tests que fallan**

Cubre como mínimo:

- `parseHoldWebhookPayload` mapea el vocabulario del partner (`authorized`, `captured`, `voided`, `failed`) a `EventoHold`, y devuelve `null` ante cualquier otro status. **`parsePagoWebhookPayload` (el viejo, con `paid`/`failed`) se elimina** — ese vocabulario describía una compra directa que ya no existe.
- Un payload sin `external_id` o sin `status` devuelve `null`.
- `rpcParaEvento('autorizado')` → `confirmar_preautorizacion` con `ok: true`; `'fallido'` → `confirmar_preautorizacion` con `ok: false`; `'capturado'` → `capturar_orden` con `'capturada'`; `'anulado'` → `capturar_orden` con `'anulada'`.
- **`debePreautorizar('pendiente')` es `true`; para `'preautorizada'`, `'capturada'`, `'anulada'` y `'fallida'` es `false`.** Este es el guardián del doble hold: escríbelo como una lista explícita de lo que **sí** permite, no como `estado !== 'preautorizada'`. Un estado nuevo debe caer en `false`, igual que la lista blanca de la RLS de E.2a.

- [ ] **Step 2: Rojo** → `npm test -- pagos`
- [ ] **Step 3: Implementar el mínimo.** Sin `Deno.` ni `node:` — `_shared/pagos.ts` tiene que seguir corriendo en Jest.
- [ ] **Step 4: Verde** → `npm test -- pagos && npm run typecheck && npm run lint`
- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/pagos.ts tests/functions/pagos.test.ts
git commit -F <archivo>
```

---

## Task 2: `crear-invitacion` preautoriza

**Files:**
- Modify: `supabase/functions/crear-invitacion/index.ts`

**El orden es el que manda, y no es negociable:**

```
1. RPC crear_invitacion                      → invitación + orden (tipo 'invitacion')
2. Si tipo = 'solicitud': devolver y parar   → no hay dinero todavía
3. Leer la orden de esa invitación
4. Si NO debePreautorizar(orden.estado): devolver sin llamar al proveedor  ← guarda del doble hold
5. Llamar al proveedor (mock)                → providerRef
6. RPC confirmar_preautorizacion(orden, ok, providerRef)
7. Devolver
```

- [ ] **Step 1: Renombrar el parámetro de la RPC**

`p_bebida_bar_id` pasa a `p_bebida_catalogo_id` (la firma cambió en E.2a). Y el nombre del campo del body, `bebidaBarId`, pasa a `bebidaCatalogoId` — **incluida su validación en `_shared/`**, que es donde vive `validarCrearInvitacion`. Ahí también va su test.

- [ ] **Step 2: Encadenar la preautorización**

El paso 4 es el importante: **un reintento del cliente con la misma `idempotency_key` recibe de `crear_invitacion` la invitación ya creada, y su orden ya estará `preautorizada`.** Sin esa guarda, el reintento dispara un segundo hold sobre la tarjeta del rentador.

En el paso 6, **pasa el `providerRef` que devolvió el proveedor**, nunca `null`.

- [ ] **Step 3: Verificar a mano lo que ninguna suite cubre**

Los `index.ts` no los ejecuta ningún test. Antes de commitear, con el seed cargado, ejecuta el flujo de verdad e inspecciona la base:

- Crear una invitación → la invitación termina en `pendiente` y su orden en `preautorizada`, **no** en `preautorizando`/`pendiente`.
- **Repetir el mismo request con la misma `idempotency_key`** → sigue habiendo **una sola** orden, y su `provider_ref` no cambió.
- Crear una solicitud → invitación en `pendiente`, **cero** órdenes.

Pega esas tres comprobaciones en el reporte. Son la única cobertura real de esta tarea.

- [ ] **Step 4: Verde y commit**

---

## Task 3: `responder-invitacion` preautoriza al aceptar una solicitud

**Files:**
- Modify: `supabase/functions/responder-invitacion/index.ts`

- [ ] **Step 1: Renombrar el parámetro** — `p_bebida_bar_id` → `p_bebida_catalogo_id`, y `bebidaBarId` → `bebidaCatalogoId` en el body y su validación en `_shared/`.

- [ ] **Step 2: Encadenar según el resultado de la RPC**

`responder_invitacion` devuelve texto: `'aceptada'`, `'rechazada'`, `'preautorizando'` o `'ya_resuelta'`.

**Solo `'preautorizando'` requiere llamar al proveedor** — es el camino de la `solicitud` aceptada. Los demás ya terminaron dentro de la transacción.

Mismo orden que la Tarea 2: leer la orden, `debePreautorizar`, proveedor, `confirmar_preautorizacion` con el ref real.

> **`'ya_resuelta'` no es error y no dispara nada.** Es el reintento benigno. Si lo tratas como fallo, un doble clic del rentador devuelve un error sobre algo que sí funcionó.

- [ ] **Step 3: Verificar a mano**

- Aceptar una `solicitud` → invitación `aceptada`, orden `capturada`, **3 filas de ledger**, y existe la cita.
- Repetir el mismo request → sigue habiendo 3 filas de ledger, no 6.
- Rechazar una `invitacion` → orden `anulada` y **cero** filas de ledger.

- [ ] **Step 4: Verde y commit**

---

## Task 4: `pago-webhook` enruta por evento

**Files:**
- Modify: `supabase/functions/pago-webhook/index.ts`

Hoy llama a `confirmar_orden_pago`, que **ya no existe**. La función está rota desde E.2a.

- [ ] **Step 1: Sustituir por el enrutado de la Tarea 1**

`parseHoldWebhookPayload` → `rpcParaEvento` → la RPC que corresponda. La verificación de firma HMAC **no se toca**: sigue siendo la autenticación real de este endpoint.

- [ ] **Step 2: Arreglar el 404 indiscriminado, que ya estaba en backlog**

Hoy cualquier error de la RPC devuelve 404, y un 404 le dice al partner que deje de reintentar. Un error transitorio de base perdería la confirmación para siempre. Distingue: **orden inexistente → 404** (no hay nada que reintentar); **cualquier otro error → 500** (reintentable). Está anotado en `docs/backlog.md` desde el code-review de la fase 3.4; márcalo como resuelto ahí.

- [ ] **Step 3: Verde y commit**

---

## Task 5: Muere `comprar-bebida`

**Files:**
- Delete: `supabase/functions/comprar-bebida/` (entera)
- Modify: `lib/tienda.ts` (pierde `comprarBebida`), `supabase/config.toml`

**Por qué muere y no se adapta:** era el endpoint de "comprar una bebida sin destinatario". Esa operación **no existe** en el modelo nuevo y no puede volver a existir — es el veto 1 del backlog. Dejarla viva, aunque nadie la llame, es dejar la puerta puesta.

- [ ] **Step 1: Borrar la función y su entrada en `config.toml`**
- [ ] **Step 2: Quitar `comprarBebida` de `lib/tienda.ts`** y cualquier test suyo que no esté ya en `.skip`
- [ ] **Step 3: Verde y commit**

---

## Task 6: Seed de demo y árbol verde

**Files:**
- Modify: `scripts/seed-demo.mjs`

E.1 le quitó la siembra del bar y la dejó sin datos de dinero. Ahora hay flujo nuevo que sí se puede sembrar.

- [ ] **Step 1: Sembrar por el flujo real, no por inserts a mano**

Igual que hacía antes con `confirmar_orden_pago`: llamar a las funciones SQL, no fabricar filas. Siembra al menos un caso de cada estado que la conciliación sabe mirar: invitación aceptada con su captura, invitación rechazada con su hold anulado, y una solicitud en `pendiente`.

**No siembres discrepancias.** Tras sembrar, `detectar_discrepancias_sp3()` tiene que devolver **cero filas** — y eso es un assert del propio script, como ya hacía antes.

- [ ] **Step 2: Comprobar que `--limpiar` sigue funcionando** con el esquema nuevo. Ojo con el orden: el ledger es append-only para todos los roles.

- [ ] **Step 3: Las cuatro suites en verde**

```bash
npm test && npm run typecheck && npm run lint && npm run test:db
```

Las 3 suites de UI siguen en `.skip` — **dilo en el reporte**.

- [ ] **Step 4: Commit**

---

## Cierre de E.2b

- [ ] Las cuatro suites, salida real pegada.
- [ ] **Ninguna Edge Function referencia una RPC inexistente:**

```bash
grep -rn "rpc('" supabase/functions/*/index.ts
```

Cada nombre que salga tiene que existir en `pg_proc`. Compruébalo, no lo supongas — es el criterio objetivo de cierre de esta fase, como lo fue "cero funciones referencian `bar`" en E.2a.

- [ ] Las tres verificaciones manuales de las Tareas 2 y 3, pegadas.
- [ ] `git diff tsconfig.json` limpio. **Sin push. No cierres la fase.**
