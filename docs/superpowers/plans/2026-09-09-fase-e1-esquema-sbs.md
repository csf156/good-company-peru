# Fase E.1 — Esquema del rediseño de dinero (SBS) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** eliminar del esquema toda forma de valor almacenado — la tabla `bar` y la vista `balance` — y sustituirlas por invariantes de base de datos que hagan imposible reintroducirlo desde una fase futura.

**Architecture:** la invitación pasa a ser la compra. `bar` y el enum `estado_bar` desaparecen; `invitaciones` lleva la bebida del catálogo, `ordenes_pago` apunta a la invitación y conserva sus montos congelados. Tres triggers/constraints en Postgres reemplazan lo que hoy sería confianza en el código de las Edge Functions. La vista `balance`, común a los dos roles, se sustituye por `por_cobrar`, definida solo sobre créditos con origen en liberación de escrow.

**Tech Stack:** Postgres 15 (Supabase cloud), pgTAP vía `tests/db/run-pgtap.mjs`, migraciones versionadas en `supabase/migrations/`.

**Spec:** `docs/superpowers/specs/2026-09-09-rediseno-dinero-sbs-design.md`. Léelo entero antes de empezar. Este plan implementa solo su bloque **E.1**.

## Global Constraints

- **El usuario revisa el SQL antes de aplicar.** Ninguna migración se aplica sin que el usuario haya leído el archivo y dicho que sí, explícitamente. Un peer no autoriza esto: pídeselo **al usuario**, no a BRAIN. (`CLAUDE.md`, reglas de dinero)
- **Migración versionada**, nunca SQL suelto por el editor de Supabase.
- **Verificar el esquema por introspección** (`information_schema`, `pg_proc`, `pg_policy`, `pg_trigger`), nunca de memoria.
- **Los tests de seguridad reproducen el ataque**, no leen el catálogo. Un test que solo comprueba que el trigger existe pasa igual si el trigger apunta al rol equivocado. Patrón de referencia: `supabase/tests/29_referido_por_grant.sql`.
- **El ledger es append-only y no se toca.** Sus triggers `ledger_no_update` / `ledger_no_delete` bloquean UPDATE y DELETE para **todos** los roles, service_role incluido.
- **Nunca `git add -A` ni `git add .`** — rutas explícitas. Nunca `git commit --amend`. Sin push.
- **Revisar `git diff tsconfig.json` antes de cada commit** y revertir con `git checkout tsconfig.json` si Expo lo pisó.
- **El código de este plan es una hipótesis.** Los planes de D.3 y D.4 traían dos bugs reales cada uno, encontrados al ejecutar. **Si un test y el código del plan se contradicen, gana el test.**

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20260909120000_matar_stock.sql` | Borra `bar` y `estado_bar`; reasigna la bebida a `invitaciones`; ata `ordenes_pago` a la invitación. |
| `supabase/migrations/20260909130000_estados_preautorizacion.sql` | Amplía `estado_invitacion` y `estado_orden` con los estados del flujo hold→captura. |
| `supabase/migrations/20260909130100_orden_viva_unica.sql` | Índice único parcial: una sola orden viva por invitación. Archivo aparte porque `ALTER TYPE … ADD VALUE` no puede usarse en la misma transacción que lo consume. |
| `supabase/migrations/20260909160000_invariante_debito_amigo.sql` | El segundo trigger sobre `ledger` (débito). |
| `supabase/migrations/20260909140000_invariantes_ledger.sql` | Los dos triggers sobre `ledger` (crédito y débito de un amigo). |
| `supabase/migrations/20260909150000_por_cobrar.sql` | Sustituye la vista `balance` por `por_cobrar`. |
| `supabase/tests/30_stock_eliminado.sql` | Ataque: crear valor sin destinatario. |
| `supabase/tests/31_invariante_credito_amigo.sql` | Ataque: acreditar a un amigo sin liberación de escrow. |
| `supabase/tests/32_invariante_debito_amigo.sql` | Ataque: gastar el importe del amigo dentro de la app. |
| `supabase/tests/33_por_cobrar.sql` | La vista existe, aísla por RLS y no expone la de otro. |
| `scripts/seed-demo.mjs` | Actualizado: ya no siembra `bar`. |

**Cuatro migraciones y no una sola** porque cada una tiene su propio test y su propio momento de aprobación del usuario: una migración monolítica obliga a aprobar a ciegas y, si falla a mitad, deja el esquema en un estado que nadie diseñó.

---

## Task 0: Vaciar los datos de demo

Las filas de demo en `bar` y `ordenes_pago` bloquean el `NOT NULL` de la Tarea 2, y sus filas de `ledger` no se pueden borrar después (el trigger append-only prohíbe DELETE a todos los roles). El script de limpieza ya sabe hacerlo en el orden correcto.

**Files:**
- Ejecutar: `scripts/seed-demo.mjs --limpiar`

**Interfaces:**
- Produces: base sin filas en `bar`, `ordenes_pago` ni sus `ledger` asociados. Las tareas 1 y 2 lo asumen.

- [ ] **Step 1: Contar lo que hay antes**

```bash
node -e "const{Client}=require('pg');const c=new Client(process.env.DATABASE_URL);c.connect().then(async()=>{for(const t of ['bar','ordenes_pago','ledger','invitaciones']){const r=await c.query('select count(*) from public.'+t);console.log(t,r.rows[0].count)}await c.end()})"
```

Anota los números. Si `ledger` tiene filas que **no** provienen de la siembra, para y avisa al usuario: hay dinero real y este plan no contempla migrar historial productivo.

- [ ] **Step 2: Limpiar**

```bash
npm run demo:limpiar
```

- [ ] **Step 3: Verificar que quedó vacío**

Repite el conteo del Step 1. Esperado: `bar` = 0, `ordenes_pago` = 0.

Si `ledger` no bajó a 0 pero `ordenes_pago` sí, revisa qué filas quedaron antes de seguir — son filas huérfanas cuyo `referencia_id` ya no resuelve. No las borres (no se puede); solo confirma con el usuario que son residuo de demo.

- [ ] **Step 4: Sin commit**

No hay cambios en el árbol. Esta tarea es solo estado de la base.

---

## Task 1: Matar el stock

**Files:**
- Create: `supabase/migrations/20260909120000_matar_stock.sql`
- Create: `supabase/tests/30_stock_eliminado.sql`

**Interfaces:**
- Produces: `invitaciones.bebida_catalogo_id uuid references bebidas_catalogo(id)`; `ordenes_pago.invitacion_id uuid not null references invitaciones(id)`. Las tareas 2, 3 y 4 y todo el bloque E.2 dependen de estos nombres exactos.
- Deja de existir: la tabla `bar`, el enum `estado_bar`, la columna `invitaciones.bebida_bar_id`, la columna `ordenes_pago.bebida_catalogo_id`.

- [ ] **Step 1: Escribir el test que falla**

Crea `supabase/tests/30_stock_eliminado.sql`:

```sql
-- pgTAP: no existe ninguna forma de crear valor sin destinatario (Fase E.1).
--
-- Reproduce los ataques de los vetos 1, 2 y 3 del backlog: comprar sin
-- destinatario, acumular stock, reasignar una bebida ya comprada. No basta con
-- mirar el catálogo — un test que solo comprobara que `bar` no existe pasaría
-- igual si quedara otra vía para insertar una orden huérfana.
begin;
select plan(4);

-- La tabla de stock ya no existe.
select is(
  (select count(*)::int from information_schema.tables
    where table_schema = 'public' and table_name = 'bar'),
  0,
  'la tabla bar ya no existe'
);

-- Ni su enum.
select is(
  (select count(*)::int from pg_type where typname = 'estado_bar'),
  0,
  'el enum estado_bar ya no existe'
);

-- ATAQUE 1 (vetos 1 y 2): una orden de pago sin invitación es la definición de
-- comprar sin destinatario. Debe fallar por NOT NULL, como service_role — es
-- decir, ni siquiera el rol que bypassa RLS puede hacerlo.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000e1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'rentador-e1@martini.test', '', now(), now(), now());

insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000e1'::uuid, 'rentador');

select throws_ok(
  $$insert into public.ordenes_pago (perfil_id, valor_v, buyer_fee, total, provider)
    values ('00000000-0000-0000-0000-0000000000e1'::uuid, 50, 7.5, 57.5, 'mock')$$,
  '23502',
  null,
  'no se puede crear una orden de pago sin invitación (compra sin destinatario)'
);

-- ATAQUE 2 (veto 3): la invitación referencia el CATÁLOGO, no una fila de stock
-- reasignable. La columna vieja tiene que haber desaparecido.
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'invitaciones'
      and column_name = 'bebida_bar_id'),
  0,
  'invitaciones.bebida_bar_id ya no existe: no hay bebida reasignable'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm run test:db
```

Esperado: `30_stock_eliminado.sql` falla. Los dos primeros asserts dan `1` en vez de `0`, y el `throws_ok` falla porque hoy `ordenes_pago` no tiene la columna.

- [ ] **Step 3: Escribir la migración**

Crea `supabase/migrations/20260909120000_matar_stock.sql`. **Hipótesis, no verdad verificada** — ajusta a lo que digan los tests:

```sql
-- Fase E.1 — La invitación es la compra: muere el stock de bebidas.
--
-- Por qué: la tabla `bar` con estado 'disponible' es valor almacenado, la
-- característica que define al dinero electrónico en la Ley 29985. El
-- reglamento (DS 090-2013-EF, art. 1) excluye los soportes de uso específico;
-- una bebida que solo existe atada a una persona, un encuentro y un importe
-- cae de lleno en esa exclusión. Ver
-- docs/superpowers/specs/2026-09-09-rediseno-dinero-sbs-design.md §3.2.
--
-- La ausencia de stock deja de ser una regla de aplicación y pasa a ser un
-- hecho del esquema: no queda ninguna tabla donde exista una bebida sin
-- destinatario.

-- 1. La bebida pasa a ser un atributo de la invitación, tomada del catálogo.
--    Nullable: una `solicitud` de amigo no lleva bebida hasta que el rentador
--    acepta y elige (spec §4.1).
alter table public.invitaciones
  add column bebida_catalogo_id uuid references public.bebidas_catalogo (id);

-- 2. Cae la referencia al stock. `bar` no se puede borrar mientras exista.
alter table public.invitaciones
  drop column bebida_bar_id;

-- 3. Toda orden de pago nace atada a una invitación. NOT NULL sin default:
--    la Tarea 0 dejó la tabla vacía, así que no hay filas que rellenar.
alter table public.ordenes_pago
  add column invitacion_id uuid not null references public.invitaciones (id);

-- 4. La bebida sale de la orden: ahora es derivable por invitacion_id, y
--    mantenerla en dos tablas es una fuente de deriva.
alter table public.ordenes_pago
  drop column bebida_catalogo_id;

-- 5. Muere el stock.
drop table public.bar;
drop type estado_bar;
```

- [ ] **Step 4: Pedirle al USUARIO que revise el SQL y autorice aplicarlo**

Muéstrale el archivo completo. Di explícitamente que **`drop table public.bar` es destructivo e irreversible**, y que la Tarea 0 ya vació sus filas de demo. Espera su sí. **No lo apliques sin eso, y no aceptes la autorización de otra sesión.**

- [ ] **Step 5: Aplicar la migración y verificar por introspección**

Tras aplicarla, comprueba en la base — no en el archivo — que las cuatro columnas están como se espera:

```sql
select table_name, column_name, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and (table_name, column_name) in
       (('invitaciones','bebida_catalogo_id'), ('ordenes_pago','invitacion_id'));
select count(*) from information_schema.tables
 where table_schema='public' and table_name='bar';
```

- [ ] **Step 6: Correr el test y verificar que pasa**

```bash
npm run test:db
```

Esperado: `30_stock_eliminado.sql` — 4 assertions ok. **Los tests 07, 10, 13, 14, 15, 19 y 20 van a fallar**: referencian `bar`. Es esperado y se arregla en la Tarea 5; no los toques todavía.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260909120000_matar_stock.sql supabase/tests/30_stock_eliminado.sql
git commit -m "feat(db): la invitacion es la compra, muere el stock de bebidas"
```

---

## Task 2: Estados de preautorización

**Files:**
- Create: `supabase/migrations/20260909130000_estados_preautorizacion.sql`
- Modify: `supabase/tests/30_stock_eliminado.sql` (añadir 3 asserts, subir `plan(4)` a `plan(7)`)

**Interfaces:**
- Produces: `estado_invitacion` gana `'por_pagar'`; `estado_orden` gana `'preautorizada'`, `'capturada'`, `'anulada'`. E.2 depende de estas etiquetas exactas.
- Produces: índice único parcial `ordenes_pago_viva_por_invitacion_uq`.

- [ ] **Step 1: Escribir los asserts que fallan**

En `supabase/tests/30_stock_eliminado.sql`, cambia `select plan(4);` por `select plan(7);` y añade antes de `select * from finish();`:

```sql
-- Los estados del flujo hold → captura existen (ampliación aditiva).
select is(
  (select count(*)::int from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'estado_invitacion' and e.enumlabel = 'por_pagar'),
  1,
  'estado_invitacion tiene por_pagar'
);

select is(
  (select count(*)::int from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'estado_orden'
      and e.enumlabel in ('preautorizada', 'capturada', 'anulada')),
  3,
  'estado_orden tiene preautorizada, capturada y anulada'
);

-- ATAQUE (veto 22, ciclo comprar-cancelar): dos holds vivos sobre la misma
-- invitación. Se permiten reintentos tras un fallo, jamás dos autorizaciones
-- vivas — si no, el mismo encuentro retiene dos veces la tarjeta.
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, estado)
values ('00000000-0000-0000-0000-0000000000e9'::uuid,
        '00000000-0000-0000-0000-0000000000e1'::uuid,
        '00000000-0000-0000-0000-0000000000e1'::uuid,
        'invitacion', 'especifica', 'por_pagar');

insert into public.ordenes_pago (perfil_id, invitacion_id, valor_v, buyer_fee, total, provider, estado)
values ('00000000-0000-0000-0000-0000000000e1'::uuid,
        '00000000-0000-0000-0000-0000000000e9'::uuid, 50, 7.5, 57.5, 'mock', 'preautorizada');

select throws_ok(
  $$insert into public.ordenes_pago (perfil_id, invitacion_id, valor_v, buyer_fee, total, provider, estado)
    values ('00000000-0000-0000-0000-0000000000e1'::uuid,
            '00000000-0000-0000-0000-0000000000e9'::uuid, 50, 7.5, 57.5, 'mock', 'preautorizada')$$,
  '23505',
  null,
  'no puede haber dos ordenes vivas sobre la misma invitacion'
);
```

> **Ojo, esto es una hipótesis del plan:** la invitación de arriba se auto-invita (emisor = receptor) para no crear un segundo perfil. Si un `CHECK` existente lo prohíbe, crea un segundo perfil en vez de tocar el constraint. **Gana el test, no el snippet.**

- [ ] **Step 2: Correr y verificar que falla**

```bash
npm run test:db
```

Esperado: los tres asserts nuevos fallan (etiquetas de enum inexistentes, y el segundo insert **no** lanza `23505` porque el índice todavía no existe).

- [ ] **Step 3: Escribir la migración**

```sql
-- Fase E.1 — Estados del flujo preautorización → captura.
--
-- Se preautoriza al invitar y se captura al aceptar (spec §3.1): si el amigo
-- rechaza, se anula el hold y NO hubo cobro — con lo que no hay devolución que
-- gestionar, y el veto 4 (nunca devolver a crédito interno) se cumple solo.
--
-- Ampliación ADITIVA de ambos enums: las etiquetas viejas siguen valiendo.

alter type estado_invitacion add value if not exists 'por_pagar';

alter type estado_orden add value if not exists 'preautorizada';
alter type estado_orden add value if not exists 'capturada';
alter type estado_orden add value if not exists 'anulada';
```

Y en un **archivo de migración separado**, `20260909130100_orden_viva_unica.sql` — `ALTER TYPE ... ADD VALUE` no puede usarse en la misma transacción que lo consume:

```sql
-- Fase E.1 — Como máximo una orden viva por invitación.
--
-- No es `unique` a secas: un fallo de preautorización debe poder reintentarse.
-- Lo que no puede haber son dos holds o dos capturas vivas sobre el mismo
-- encuentro (veto 22: el ciclo comprar-cancelar es una ruta de cash-out).
create unique index ordenes_pago_viva_por_invitacion_uq
  on public.ordenes_pago (invitacion_id)
  where estado in ('preautorizada', 'capturada');
```

- [ ] **Step 4: Pedirle al USUARIO que revise el SQL y autorice aplicarlo**

Aditivo y no destructivo, pero el gate aplica igual: es esquema de dinero.

- [ ] **Step 5: Aplicar y verificar por introspección**

```sql
select t.typname, e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
 where t.typname in ('estado_invitacion','estado_orden') order by t.typname, e.enumsortorder;
select indexdef from pg_indexes where indexname = 'ordenes_pago_viva_por_invitacion_uq';
```

- [ ] **Step 6: Correr y verificar que pasa**

```bash
npm run test:db
```

Esperado: `30_stock_eliminado.sql` — 7 assertions ok.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260909130000_estados_preautorizacion.sql supabase/migrations/20260909130100_orden_viva_unica.sql supabase/tests/30_stock_eliminado.sql
git commit -m "feat(db): estados de preautorizacion y una sola orden viva por invitacion"
```

---

## Task 3: Invariante del crédito al amigo

La regla más importante del bloque. Cubre los vetos 8 (transferir entre usuarios), 9 (que el amigo use lo que ganó para invitar) y 14 (interés o cashback acreditado como importe liquidable).

**Files:**
- Create: `supabase/migrations/20260909140000_invariantes_ledger.sql`
- Create: `supabase/tests/31_invariante_credito_amigo.sql`

**Interfaces:**
- Produces: `public.ledger_credito_amigo()` + trigger `ledger_invariante_credito` (BEFORE INSERT ON `ledger`).

- [ ] **Step 1: Escribir el test que falla**

```sql
-- pgTAP: un amigo solo puede ser acreditado por una liberación de escrow
-- referida a un encuentro finalizado (Fase E.1).
--
-- Vetos 8, 9 y 14 del backlog. Reproduce los ataques COMO service_role: el rol
-- que bypassa RLS y que usan las Edge Functions. Si la regla viviera en
-- TypeScript, todos estos inserts pasarían.
--
-- Hoy esta invariante rechaza el 100% de los créditos, porque la fase 5.4 (que
-- lleva una cita a 'finalizada' por la vía del motor de cita) no existe. Eso es
-- lo correcto: la única puerta futura queda tapiada antes de que nadie la abra.
begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'amigo-e1@martini.test', '', now(), now(), now());

insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'amigo');

-- ATAQUE 1 (veto 14): acreditarle con un tipo que no es payout — el disfraz de
-- un cashback, un bono o una "compensación de soporte".
select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'compra', 100, 'ataque-credito-tipo')$$,
  'AY451',
  null,
  'no se puede acreditar a un amigo con un tipo que no es payout'
);

-- ATAQUE 2 (veto 9): payout sin referencia a ninguna cita — la forma que
-- tomaría un endpoint de crédito "solo para pruebas".
select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'payout', 100, 'ataque-credito-sin-cita')$$,
  'AY451',
  null,
  'no se puede acreditar a un amigo sin referencia a una cita'
);

-- ATAQUE 3 (veto 9): payout referido a una cita que NO está finalizada. Es el
-- ataque más realista: la cita existe, pero el encuentro no se verificó.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a2'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'rentador-e1b@martini.test', '', now(), now(), now());
insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000a2'::uuid, 'rentador');

insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, estado)
values ('00000000-0000-0000-0000-0000000000a3'::uuid,
        '00000000-0000-0000-0000-0000000000a2'::uuid,
        '00000000-0000-0000-0000-0000000000a1'::uuid,
        'invitacion', 'especifica', 'aceptada');

insert into public.citas (id, invitacion_id, estado)
values ('00000000-0000-0000-0000-0000000000a4'::uuid,
        '00000000-0000-0000-0000-0000000000a3'::uuid,
        'confirmada');

select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'payout', 100,
            '00000000-0000-0000-0000-0000000000a4'::uuid, 'ataque-credito-cita-viva')$$,
  'AY451',
  null,
  'no se puede acreditar a un amigo por una cita que no esta finalizada'
);

-- CAMINO LEGÍTIMO: la cita finalizada. Es lo que hará la fase 5.4.
update public.citas set estado = 'finalizada'
 where id = '00000000-0000-0000-0000-0000000000a4'::uuid;

select lives_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'payout', 100,
            '00000000-0000-0000-0000-0000000000a4'::uuid, 'payout-legitimo')$$,
  'un payout por una cita finalizada si pasa'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
npm run test:db
```

Esperado: los tres `throws_ok` fallan **individualmente** (`not ok 1`, `not ok 2`, `not ok 3`), no un abort del archivo entero. Un abort a la primera sentencia confirma que algo falta, pero no que cada assert mida lo que crees. El `lives_ok` pasa por casualidad; no cuenta como señal.

> **Corrección al plan, 2026-09-09.** Los tres `throws_ok` de arriba pasan `null` como mensaje esperado, así que **solo comprueban el errcode** — y los tres comparten `AY451`. Con eso, el test no distingue por qué rama del trigger saltó cada ataque, y si una fase futura colapsa las tres comprobaciones en un solo `if`, sigue verde. **Sustituye el `null` por el mensaje esperado de cada rama** (o `throws_like` con un patrón que ancle la frase distintiva, ya que dos de los tres interpolan valores):
>
> - tipo ≠ payout → `credito a un amigo solo por payout (recibido: compra)`
> - sin referencia → `un payout necesita referencia a la cita`
> - cita no finalizada → `payout solo por cita finalizada (cita: …, estado: confirmada)`
>
> Esto **no** aplica a la Tarea 4: allí hay un solo `raise` y una sola rama, así que el mensaje compartido es correcto y forzar una distinción sería inventarla.

- [ ] **Step 3: Escribir la migración**

```sql
-- Fase E.1 — Invariantes del ledger: la cuenta por cobrar del amigo no es un
-- monedero.
--
-- Exigencia del backlog, textual: "Nada de esto se sostiene como regla de
-- aplicación: dentro de dos fases alguien escribe un endpoint de crédito 'solo
-- para pruebas' y ahí muere el argumento." Estas reglas fallan en un INSERT de
-- Postgres, no en una revisión de código, y aplican TAMBIÉN a service_role.
--
-- Errcode AY451 (familia AY4xx del proyecto) para distinguirlo en los tests de
-- un fallo de constraint genérico.

create or replace function public.ledger_credito_amigo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rol rol_usuario;
  v_estado_cita estado_cita;
begin
  select rol into v_rol from public.profiles where id = new.perfil_id;

  if v_rol is distinct from 'amigo' then
    return new;
  end if;

  -- Crédito (veto 8, 9, 14): solo liberación de escrow por encuentro verificado.
  if new.monto > 0 then
    if new.tipo <> 'payout' then
      raise exception 'credito a un amigo solo por payout (recibido: %)', new.tipo
        using errcode = 'AY451';
    end if;

    if new.referencia_id is null then
      raise exception 'un payout necesita referencia a la cita'
        using errcode = 'AY451';
    end if;

    select estado into v_estado_cita
      from public.citas where id = new.referencia_id;

    if v_estado_cita is distinct from 'finalizada' then
      raise exception 'payout solo por cita finalizada (cita: %, estado: %)',
        new.referencia_id, coalesce(v_estado_cita::text, 'inexistente')
        using errcode = 'AY451';
    end if;
  end if;

  return new;
end;
$$;

create trigger ledger_invariante_credito
  before insert on public.ledger
  for each row execute function public.ledger_credito_amigo();
```

- [ ] **Step 4: Pedirle al USUARIO que revise el SQL y autorice aplicarlo**

- [ ] **Step 5: Aplicar y verificar por introspección**

```sql
select tgname, tgenabled from pg_trigger where tgrelid = 'public.ledger'::regclass;
select proname, prosecdef from pg_proc where proname = 'ledger_credito_amigo';
```

- [ ] **Step 6: Correr y verificar que pasa**

```bash
npm run test:db
```

Esperado: `31_invariante_credito_amigo.sql` — 4 assertions ok.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260909140000_invariantes_ledger.sql supabase/tests/31_invariante_credito_amigo.sql
git commit -m "feat(db): invariante de credito al amigo solo por escrow liberado"
```

---

## Task 4: Invariante del débito al amigo

Cubre los vetos 10 (propinas desde el pendiente), 11 (pagar la suscripción con el pendiente) y 12 (liquidar a cuenta de un tercero). Es la mitad que impide **gastar** el importe dentro de la app.

**Files:**
- Create: `supabase/migrations/20260909160000_invariante_debito_amigo.sql`
- Create: `supabase/tests/32_invariante_debito_amigo.sql`
- **No tocar** `20260909140000_invariantes_ledger.sql`: ya está aplicada, y una migración aplicada no se edita — se corrige con otra encima.

**Interfaces:**
- Consumes: `public.ledger_credito_amigo()` de la Tarea 3 — este trigger es **independiente**, no la modifica.
- Produces: `public.ledger_debito_amigo()` + trigger `ledger_invariante_debito`.

- [ ] **Step 1: Escribir el test que falla**

```sql
-- pgTAP: el importe pendiente del amigo no se puede gastar dentro de la app
-- (Fase E.1). Vetos 10, 11 y 12 del backlog.
--
-- La única salida legítima es la liquidación bancaria, que es la fase 6.3 y no
-- existe todavía: por eso hoy esta invariante rechaza TODO débito sobre un
-- amigo. Cuando 6.3 llegue, añadirá su tipo de movimiento y su comprobación de
-- titularidad; no puede simplemente quitar el trigger.
begin;
select plan(3);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000b1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'amigo-e1c@martini.test', '', now(), now(), now());

insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000b1'::uuid, 'amigo');

-- ATAQUE 1 (veto 9, el más peligroso de la lista): el amigo usa lo que ganó
-- para invitar a alguien. Tomaría la forma de una compra debitada de su cuenta.
select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000b1'::uuid, 'compra', -50, 'ataque-debito-invitar')$$,
  'AY452',
  null,
  'un amigo no puede gastar su pendiente para invitar'
);

-- ATAQUE 2 (veto 11): pagar la suscripción premium con el importe pendiente.
-- Suena razonable y compensable, y es efecto cancelatorio dentro de la
-- plataforma.
select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000b1'::uuid, 'fee', -39, 'ataque-debito-suscripcion')$$,
  'AY452',
  null,
  'un amigo no puede pagar la suscripcion con su pendiente'
);

-- ATAQUE 3 (veto 10): propina descontada del pendiente.
select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000b1'::uuid, 'escrow_lock', -10, 'ataque-debito-propina')$$,
  'AY452',
  null,
  'un amigo no puede debitar su pendiente por ningun otro concepto'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
npm run test:db
```

Esperado: los tres `throws_ok` fallan.

- [ ] **Step 3: Escribir la migración**

```sql
-- Fase E.1 — El importe pendiente del amigo no se gasta dentro de la app.
--
-- Vetos 10, 11 y 12. Hoy rechaza TODO débito sobre un perfil `amigo`, porque la
-- única salida legítima —la liquidación bancaria a titular verificado— es la
-- fase 6.3 y no existe. Cuando llegue, amplía este trigger con su tipo y su
-- comprobación de titularidad: NO lo elimina.

create or replace function public.ledger_debito_amigo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rol rol_usuario;
begin
  select rol into v_rol from public.profiles where id = new.perfil_id;

  if v_rol is distinct from 'amigo' then
    return new;
  end if;

  if new.monto < 0 then
    raise exception
      'un amigo solo puede ser debitado por una liquidacion bancaria (fase 6.3); recibido: % %',
      new.tipo, new.monto
      using errcode = 'AY452';
  end if;

  return new;
end;
$$;

create trigger ledger_invariante_debito
  before insert on public.ledger
  for each row execute function public.ledger_debito_amigo();
```

- [ ] **Step 4: Pedirle al USUARIO que revise el SQL y autorice aplicarlo**

- [ ] **Step 5: Aplicar y verificar por introspección**

```sql
select tgname from pg_trigger where tgrelid = 'public.ledger'::regclass order by tgname;
```

Esperado: `ledger_invariante_credito`, `ledger_invariante_debito`, `ledger_no_delete`, `ledger_no_update`.

- [ ] **Step 6: Correr y verificar que pasa**

```bash
npm run test:db
```

Esperado: `32_invariante_debito_amigo.sql` — 3 assertions ok, y `31` sigue en 4 ok (los dos triggers conviven).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260909160000_invariante_debito_amigo.sql supabase/tests/32_invariante_debito_amigo.sql
git commit -m "feat(db): invariante de debito al amigo solo por liquidacion"
```

---

## Task 5: `por_cobrar` sustituye a `balance`

**Files:**
- Create: `supabase/migrations/20260909150000_por_cobrar.sql`
- Create: `supabase/tests/33_por_cobrar.sql`
- Modify: `supabase/tests/07_money_schema.sql`, `10_bar_rls.sql`, `12_ordenes_pago_rls.sql`, `13_confirmar_orden_pago.sql`, `14_conciliacion_sp3.sql`, `15_invitaciones_rls.sql`, `19_crear_invitacion.sql`, `20_responder_invitacion.sql` — los que referencian `bar` o `balance`.

> **Corrección al plan, 2026-09-09 (hallazgo de ejecución).** La lista original tenía siete archivos y son **ocho**: `12_ordenes_pago_rls.sql` también rompe, por la columna `ordenes_pago.bebida_catalogo_id` que la Tarea 1 elimina. Lo encontró BUILDER al ejecutar la Tarea 1, no el plan. Es el quinto caso registrado de que el código de un plan es una hipótesis.

**Interfaces:**
- Produces: vista `public.por_cobrar (perfil_id, por_cobrar)`, `security_invoker = on`.
- Deja de existir: la vista `public.balance`.

- [ ] **Step 1: Escribir el test que falla**

```sql
-- pgTAP: la vista de dinero del amigo es una cuenta por cobrar, no un saldo
-- (Fase E.1). Vetos 18 y 19 del backlog.
--
-- `balance` era común a los dos roles y sumaba TODO el ledger. `por_cobrar`
-- suma solo lo liberado de escrow: lo que la plataforma debe, no lo que el
-- usuario "tiene". Aísla por RLS igual que la vista vieja (security_invoker).
begin;
select plan(3);

select is(
  (select count(*)::int from information_schema.views
    where table_schema = 'public' and table_name = 'balance'),
  0,
  'la vista balance ya no existe'
);

select is(
  (select count(*)::int from information_schema.views
    where table_schema = 'public' and table_name = 'por_cobrar'),
  1,
  'existe la vista por_cobrar'
);

-- Aislamiento: un usuario no ve la fila de otro. Reproduce la lectura real
-- como `authenticated`, no mira pg_policy.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000c1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'amigo-e1d@martini.test', '', now(), now(), now());
insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'amigo');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1"}';

select is(
  (select count(*)::int from public.por_cobrar
    where perfil_id <> '00000000-0000-0000-0000-0000000000c1'::uuid),
  0,
  'por_cobrar no expone la fila de otro usuario'
);

reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
npm run test:db
```

- [ ] **Step 3: Escribir la migración**

```sql
-- Fase E.1 — `por_cobrar` sustituye a `balance`.
--
-- El veto 18 prohíbe "saldo", "billetera", "monedero" y "wallet" en UI, ToS,
-- soporte y marketing; el 19 prohíbe presentar el importe como poder de compra.
-- El nombre del objeto en la base importa igual: la siguiente fase construye lo
-- que encuentra escrito.
--
-- Diferencia de fondo, no de nombre: `balance` sumaba TODO el ledger y valía
-- para los dos roles. `por_cobrar` suma solo los payouts —lo que la plataforma
-- DEBE al amigo por servicios ya prestados—, que es una cuenta por cobrar y no
-- un valor almacenado. El rentador no tiene vista de dinero agregado: nunca
-- tuvo saldo.
--
-- Hoy devuelve 0 para todo el mundo, porque la fase 5.4 (liberación de escrow)
-- no existe. Es lo correcto.

drop view public.balance;

create view public.por_cobrar
  with (security_invoker = on) as
  select
    perfil_id,
    coalesce(sum(monto), 0)::numeric(12, 2) as por_cobrar
  from public.ledger
  where tipo = 'payout'
  group by perfil_id;

grant select on public.por_cobrar to authenticated;
revoke select on public.por_cobrar from anon;
```

- [ ] **Step 4: Pedirle al USUARIO que revise el SQL y autorice aplicarlo**

`drop view public.balance` es destructivo. Dile que `lib/bar.ts` la consume y que la app quedará rota hasta el bloque E.3 — es esperado y es la razón de que E.3 exista.

- [ ] **Step 5: Aplicar y verificar por introspección**

```sql
select table_name from information_schema.views
 where table_schema='public' and table_name in ('balance','por_cobrar');
select definition from pg_views where viewname = 'por_cobrar';
```

- [ ] **Step 6: Arreglar los pgTAP viejos que referencian `bar` o `balance`**

Recorre los siete archivos listados arriba. Para cada assert que dependía del stock:

- Si probaba una **propiedad que ya no existe** (RLS de `bar`, bloqueo de bebida), **bórralo** y baja el `plan(N)`. Deja un comentario diciendo que E.1 lo eliminó y por qué.
- Si probaba una **propiedad que sigue existiendo** con otra forma (idempotencia de la orden, RLS de invitaciones), **adáptalo** al esquema nuevo.
- **No borres un assert solo porque falla.** Si no sabes a cuál de los dos casos pertenece, pregunta antes de tocarlo.

`13_confirmar_orden_pago.sql` y `14_conciliacion_sp3.sql` prueban `confirmar_orden_pago`, que **se reescribe en el bloque E.2**. Déjalos en el mínimo que compile contra el esquema nuevo; su cobertura real vuelve en E.2.

- [ ] **Step 7: Correr la suite entera y verificar que pasa**

```bash
npm run test:db
```

Esperado: **todos** los archivos en verde. Anota el total de aserciones — sale de 277 y va a cambiar; el número nuevo va a la bitácora.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260909150000_por_cobrar.sql supabase/tests/33_por_cobrar.sql supabase/tests/07_money_schema.sql supabase/tests/10_bar_rls.sql supabase/tests/12_ordenes_pago_rls.sql supabase/tests/13_confirmar_orden_pago.sql supabase/tests/14_conciliacion_sp3.sql supabase/tests/15_invitaciones_rls.sql supabase/tests/19_crear_invitacion.sql supabase/tests/20_responder_invitacion.sql
git commit -m "feat(db): por_cobrar sustituye a balance"
```

---

## Task 6: Dejar el árbol verde

E.1 rompe a propósito el código que consume `bar` y `balance`. La UI se rehace en E.3, pero **la rama tiene que compilar y tener tests verdes al cerrar el bloque**.

**Files:**
- Modify: `scripts/seed-demo.mjs`
- Modify: los tests jest que fallen (`tests/lib/bar.test.ts`, `tests/app/bar.test.tsx`, `tests/app/store.test.tsx`, `tests/app/wallet.test.tsx`, y los que toquen `bebida_bar_id`)

- [ ] **Step 1: Ver qué se rompió**

```bash
npm test 2>&1 | tail -40
npm run typecheck
```

- [ ] **Step 2: Quitar la siembra de `bar` del script de demo**

`scripts/seed-demo.mjs` siembra el bar vía `confirmar_orden_pago` (su "Tarea 3") y lo limpia en `--limpiar`. Esa función se reescribe en E.2, así que aquí **solo se elimina el bloque de siembra de bar y su limpieza**, dejando el resto del seed (perfiles, invitaciones, chats) funcionando. No intentes sembrar el flujo nuevo: no existe hasta E.2.

- [ ] **Step 3: Marcar como pendientes los tests de UI que E.3 rehace**

Los tests de `app/bar.tsx`, `app/store.tsx` y `app/wallet.tsx` prueban pantallas que E.3 borra o rehace. **No los borres**: renómbralos a `.skip` con un comentario que diga qué bloque los repone. Borrarlos pierde la lista de lo que había que reponer.

- [ ] **Step 4: Verificar verde**

```bash
npm test
npm run typecheck
npm run lint
npm run test:db
```

Los cuatro tienen que pasar. Si `npm test` pasa solo porque quedaron suites en `.skip`, **dilo explícitamente al reportar** — un verde con cobertura apagada no es un verde.

- [ ] **Step 5: Revisar tsconfig antes de commitear**

```bash
git diff tsconfig.json
```

Si Expo lo pisó: `git checkout tsconfig.json`.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-demo.mjs tests/lib/bar.test.ts tests/app/bar.test.tsx tests/app/store.test.tsx tests/app/wallet.test.tsx
git commit -m "chore: dejar el arbol verde tras matar el stock"
```

---

## Cierre del bloque

- [ ] Correr las cuatro suites y **pegar la salida real** al reportar (`npm test`, `npm run test:db`, `npm run typecheck`, `npm run lint`). Evidencia antes de afirmar.
- [ ] Reportar los números nuevos: suites y tests jest, aserciones pgTAP, y **cuántas suites quedaron en `.skip`**.
- [ ] **No cerrar la fase.** Solo el usuario declara una fase concluida.
- [ ] **No hacer push.**
- [ ] Confirmar que `git status` no arrastra `awesome-design-skills/` ni `tsconfig.json`.
