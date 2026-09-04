# Catálogo de bebidas y datos de demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el usuario pueda recorrer la dinámica completa de la app: perfiles con foto en el descubrimiento, bebidas en el bar, invitaciones y solicitudes en todos sus estados, y chats con historia.

**Architecture:** Dos entregables **deliberadamente separados**. (1) El **catálogo de bebidas** es dato de producto —sin él la tienda no funciona ni para un usuario real— y va como migración versionada, permanente. (2) Los **datos de demo** (perfiles, bar, invitaciones, chats) son desechables y van en un script idempotente con su contrapartida de limpieza. Mezclarlos dejaría datos de prueba imposibles de distinguir de los reales.

**Tech Stack:** Node + `pg` (mismo patrón que `tests/db/`) · Supabase Storage · Postgres

---

## Contexto: el estado real de la base

Verificado por introspección hoy:

```
profiles              2   (el del usuario + uno viejo de prueba)
bebidas_catalogo      0   ← la tienda no tiene nada que vender
bar                   0
ledger                0
ordenes_pago          0
invitaciones          0
citas                 0
chat_mensajes         0
```

El usuario llegó al descubrimiento y no vio ningún perfil, que es el síntoma correcto de una base vacía. Su perfil (`Pepe Grillo`) es **amigo**, y el descubrimiento muestra siempre el rol opuesto.

**Decisiones del usuario (2026-09-04):**
1. **Sembrar los dos lados** y poder cambiar de rol a demanda. Su cuenta arranca como **rentador** (que es el lado que pidió: bar con bebidas para poder invitar).
2. **8 perfiles de prueba**, 4 de cada rol.

---

## Global Constraints

- **La consistencia del dinero no se negocia.** `bar`, `ledger` y `ordenes_pago` están atados por la conciliación (`detectar_discrepancias_sp3`): una de sus invariantes compara el conteo global de filas `escrow_lock` del ledger contra el conteo de filas de `bar`, y otra compara los montos del ledger contra los congelados en la orden. **Sembrar filas de `bar` a mano rompería las dos.** Usa las funciones que ya existen (§ Tarea 3), no `INSERT` sueltos.
- **La máquina de estados tampoco.** Las invitaciones y citas se crean con `crear_invitacion` / `responder_invitacion` / `confirmar_cita`, no insertando filas con el estado deseado. Un `INSERT` directo puede producir combinaciones que el código real nunca genera, y entonces estarías probando una app que no existe.
- **Todo lo sembrado debe ser identificable y borrable.** `profiles.flags` es `jsonb` (costura de la fase 1.1): marca cada perfil sembrado con `{"demo": true}`. La limpieza borra por esa marca; el `on delete cascade` se lleva lo dependiente.
- **Nunca tocar el perfil del usuario** salvo lo que él pida explícitamente. El script debe negarse a modificar perfiles sin la marca `demo`, con la única excepción del cambio de rol de la Tarea 6.
- **Sin secretos nuevos en `.env`.** Para subir fotos hace falta la clave `service_role`; el script la obtiene en tiempo de ejecución de la Management API con el `SUPABASE_ACCESS_TOKEN` que ya existe. **No la escribas a disco ni la imprimas.**
- **Idempotente.** Correrlo dos veces no debe duplicar nada.
- **Idioma:** los datos sembrados son de cara al usuario → español de Perú. Nombres, alias y mensajes de chat verosímiles, no `test1`/`test2`.
- **Cierre:** `npm run lint` + `npm run typecheck` + `npm test` + `npm run test:db` verdes.
- **No hagas push.**

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `supabase/migrations/20260904120000_catalogo_bebidas.sql` | Catálogo de bebidas (producto, permanente) | 1 |
| `scripts/seed-demo.mjs` | Siembra y limpieza de datos de demo | 2–5 |
| `scripts/demo-avatars.mjs` | Genera y sube las fotos | 2 |
| `package.json` | Scripts `demo:seed` y `demo:limpiar` | 2 |

---

## Task 1: Catálogo de bebidas (migración, dato de producto)

**Files:**
- Create: `supabase/migrations/20260904120000_catalogo_bebidas.sql`

**Interfaces:**
- Produces: filas en `bebidas_catalogo` con `activo = true`, que la tienda (fase 3.2) lista y `comprar-bebida` referencia.

- [ ] **Step 1: Leer el esquema real de la tabla antes de escribir**

```bash
grep -n "create table public.bebidas_catalogo" -A 12 supabase/migrations/20260723120000_money_ledger.sql
```

No inventes columnas. Usa las que hay, con los tipos que hay.

- [ ] **Step 2: Escribir la migración**

Cuatro o cinco bebidas con valores `V` escalonados, de la más barata a la más cara. Nombres en español de Perú, coherentes con una app de compañía social — bebidas de verdad, nada de contenido sexual (regla de posicionamiento del proyecto).

**Inserta con `on conflict do nothing`** sobre una clave estable (el nombre), para que reaplicar la migración no duplique.

**Verifica el prefijo antes de nombrar el archivo** — el runner se salta en silencio una migración cuyo prefijo ya esté aplicado:

```bash
ls supabase/migrations/ | cut -d_ -f1 | sort | uniq -d
```

- [ ] **Step 3: ALTO — el usuario revisa el SQL**

Regla del proyecto. Es dato de producto permanente: los valores `V` que elijas son los precios que verá cualquier usuario. Muéstrale la lista con sus valores y espera su OK.

- [ ] **Step 4: Aplicar y verificar por introspección**

```bash
set -a; . ./.env; set +a; node tests/db/apply-migrations.mjs
```

Después confirma con una consulta que las filas están y que `activo = true`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260904120000_catalogo_bebidas.sql
git commit -m "feat(db): catalogo de bebidas"
```

---

## Task 2: Perfiles de demo con foto

**Files:**
- Create: `scripts/seed-demo.mjs`, `scripts/demo-avatars.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: 8 perfiles (4 `amigo`, 4 `rentador`), todos `kyc_estado = 'verificado'`, con `foto_url` apuntando a un objeto real del bucket `fotos`.

- [ ] **Step 1: Crear los usuarios y perfiles**

Cada perfil necesita su fila en `auth.users` (`profiles.id` la referencia). El patrón exacto está en los pgTAP existentes — cópialo de `supabase/tests/06_perfiles_publicos.sql`, que inserta en `auth.users` con todas las columnas que Supabase exige.

Usa **UUID fijos y reconocibles** (por ejemplo con prefijo `demo`), no aleatorios: hace la siembra idempotente y la limpieza trivial.

Datos: nombres y alias peruanos verosímiles, edades repartidas entre 22 y 45 (vía `fecha_nacimiento`), géneros variados usando **exactamente** las opciones del wizard (`lib/onboarding-options.ts` no las tiene — están en `profile-setup.tsx`; léelas de ahí para no inventar valores que la UI no produce), hobbies y `tipo_salida` tomados de `lib/onboarding-options.ts` usando los `value`, **no los `label`**.

**Marca cada uno con `flags = '{"demo": true}'::jsonb`.**

Siembra también `preferencias_salida` con distritos para los `amigo`, tomados de la lista `DISTRITOS`.

- [ ] **Step 2: Fotos**

El bucket `fotos` es privado y la app lee con URL firmada (`lib/storage.ts:67`), así que **tiene que haber objetos reales**; una ruta inventada da imagen rota.

- Genera 8 PNG distintos y pequeños. Sin dependencias nuevas: un PNG de color sólido se puede construir a mano con `zlib` de Node. Colores distinguibles entre sí y coherentes con la paleta oscura.
- Súbelos al bucket `fotos` con la clave `service_role`, en la misma forma de ruta que usa la app (`<perfil_id>/foto.jpg` — confírmalo leyendo `uploadProfilePhoto` en `lib/storage.ts`).
- **La clave `service_role` se obtiene en tiempo de ejecución** de la Management API con el `SUPABASE_ACCESS_TOKEN` de `.env`. No la guardes en disco ni la imprimas en logs.

- [ ] **Step 3: Scripts en `package.json`**

```json
"demo:seed": "node scripts/seed-demo.mjs",
"demo:limpiar": "node scripts/seed-demo.mjs --limpiar"
```

Van por `npm run`, que ya está permitido — evita el bloqueo del clasificador que frenó el runner de migraciones.

- [ ] **Step 4: Verificar**

Corre la siembra, confirma 8 perfiles con `flags->>'demo' = 'true'`, y **abre una URL firmada de una foto** para comprobar que el objeto existe de verdad. Que la fila tenga `foto_url` no prueba que el archivo esté.

- [ ] **Step 5: Commit**

---

## Task 3: Bar y bebidas compradas

**Files:**
- Modify: `scripts/seed-demo.mjs`

**Este es el paso donde es fácil romper la conciliación.** Léelo entero antes de escribir código.

- [ ] **Step 1: Entender la cadena antes de sembrarla**

Lee `supabase/migrations/20260723140000_confirmar_orden_pago.sql`. Esa función es la que, en el flujo real, crea de forma atómica las filas de `ledger` y de `bar` a partir de una orden. Es `security definer` y solo `service_role` puede ejecutarla.

**Siembra llamándola a ella**, no insertando en `bar` a mano:
1. Inserta una fila en `ordenes_pago` como lo hace `comprar-bebida` (mira esa función para los campos y la `idempotency_key`).
2. Llama `confirmar_orden_pago(orden_id, 'confirmada', escrow_ref)`.

Así las tres tablas quedan consistentes **por construcción**, que es justo lo que las invariantes verifican.

- [ ] **Step 2: Sembrar**

Bebidas para el usuario (para que pueda invitar) y para los rentadores de demo (para que sus invitaciones tengan bebida). Deja algunas `disponible` y alguna `bloqueada` por una invitación pendiente — pero **la bloquea `crear_invitacion` en la Tarea 4**, no tú a mano.

- [ ] **Step 3: La verificación que importa**

```sql
select * from public.detectar_discrepancias_sp3();
```

**Debe devolver cero filas.** Si devuelve alguna, la siembra rompió una invariante del dinero: **para, no la ignores**. Esa consulta es la prueba objetiva de que los datos sembrados son consistentes; ningún test la sustituye.

- [ ] **Step 4: Commit**

---

## Task 4: Invitaciones, citas y chats

**Files:**
- Modify: `scripts/seed-demo.mjs`

- [ ] **Step 1: Usar las funciones reales, no `INSERT`**

`crear_invitacion`, `responder_invitacion` y `confirmar_cita` son `security definer` y ejecutables por `service_role`. Úsalas: garantizan que cada combinación de estados sea una que el código real puede producir.

- [ ] **Step 2: Cubrir los estados que el usuario pidió**

Para su cuenta, en ambas direcciones:

| Qué | Estado | Cómo |
|---|---|---|
| Invitación recibida | `pendiente` | `crear_invitacion` desde un rentador de demo hacia él |
| Invitación recibida | `aceptada` | la anterior + `responder_invitacion('aceptar')` |
| Invitación recibida | `rechazada` | otra + `responder_invitacion('rechazar')` |
| Invitación enviada | `pendiente` / `aceptada` / `rechazada` | mismas funciones, con él como emisor |
| Cita | `pendiente` | nace al aceptar |
| Cita | `confirmada` | + `confirmar_cita` con zona y hora |

**Ojo con la hora:** el bloque de saneamiento (fase 4.8) que corrige el offset de Perú **aún no se ha hecho**. Usa horas explícitas con offset `-05:00` al sembrar, y **anota en el reporte** que las citas sembradas lo llevan, para que cuando 4.8 llegue nadie se confunda con datos viejos.

- [ ] **Step 3: Mensajes de chat**

El chat existe cuando existe la `cita`. Siembra conversaciones de tres formas: **iniciada** (2–3 mensajes), **con historia** (8–10 mensajes, ida y vuelta), y **una sin mensajes** (chat abierto que nadie estrenó).

Mensajes en español de Perú, verosímiles, coordinando una salida. **Ninguno debe disparar la moderación anti-fuga** — nada de teléfonos, números largos ni palabras de pago externo (yape, plin, bancos). Si un mensaje sembrado se marca como oculto, el trigger está haciendo su trabajo y el dato de demo es el equivocado: cámbialo.

**Un mensaje que SÍ dispare la moderación, deliberadamente**, en un solo chat: para que el usuario pueda ver cómo se comporta esa pantalla. Márcalo en el reporte.

- [ ] **Step 4: Verificar y commitear**

Consulta los conteos por estado y confirma que hay al menos uno de cada.

---

## Task 5: Limpieza

**Files:**
- Modify: `scripts/seed-demo.mjs`

- [ ] **Step 1: Implementar `--limpiar`**

Borra todo lo sembrado y **solo** lo sembrado: perfiles con `flags->>'demo' = 'true'`, y con ellos lo que cuelgue por `on delete cascade`.

**Cuidado con lo que NO cascadea.** `ledger.perfil_id` referencia `profiles` **sin** `on delete cascade` (a diferencia de `bar`), justo lo que la deuda de backlog sobre la invariante #4 anticipaba. Decide y documenta: o borras las filas de ledger de los perfiles demo explícitamente antes, o el borrado fallará por la FK. **Comprueba `detectar_discrepancias_sp3()` después de limpiar** — si la limpieza deja el ledger descuadrado, es peor que no limpiar.

- [ ] **Step 2: Proteger el perfil del usuario**

El script debe **negarse** a borrar o modificar cualquier perfil sin la marca `demo`. Si el `delete` fuera a alcanzar más filas de las sembradas, aborta.

- [ ] **Step 3: Probar el ciclo completo**

Sembrar → limpiar → sembrar. Al final: los mismos conteos que la primera vez, el perfil del usuario intacto, y la conciliación en cero.

- [ ] **Step 4: Commit**

---

## Task 6: Cambio de rol a demanda

**Files:**
- Modify: `scripts/seed-demo.mjs`

- [ ] **Step 1: Implementar `--rol=amigo|rentador`**

Cambia el `rol` del perfil del usuario. Es la forma de ver los dos lados con una sola cuenta.

**Advierte en la salida del comando** lo que el cambio implica: el descubrimiento pasa a mostrar el rol contrario, y las invitaciones ya sembradas quedan con él en el papel opuesto al que tenían. No es un bug, es consecuencia de tener una cuenta y dos roles — pero hay que decirlo o parecerá que la siembra se rompió.

- [ ] **Step 2: Dejar su cuenta como `rentador`**

Es el lado que pidió: bar con bebidas para poder invitar.

---

## Cierre

- [ ] **Verificación final, con la salida mostrada**

```bash
npm run lint && npm run typecheck && npm test
set -a; . ./.env; set +a; npm run test:db
git status --short && git diff tsconfig.json
```

Más, y esto es lo que de verdad prueba el trabajo:

```sql
select * from public.detectar_discrepancias_sp3();   -- debe dar cero filas
```

- [ ] **Reportar**

Incluye: conteos por tabla y por estado, confirmación de que las fotos existen de verdad en el bucket (no solo la ruta en la fila), el resultado de la conciliación, y **qué chat lleva el mensaje que dispara la moderación**.

**Esto no es una fase del plan MVP.** No toques `docs/ESTADO.md` ni `FASE ACTUAL`; D.3 sigue abierta con su bloque 3 (KYC en dos pantallas) pendiente. Sin push.
