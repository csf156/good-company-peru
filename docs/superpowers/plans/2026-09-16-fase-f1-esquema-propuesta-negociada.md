# Fase F.1 — Esquema y datos de la propuesta negociada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dejar la base lista para negociar propuestas: los estados nuevos, la intención de cada bebida, el momento propuesto, **la cantidad y lo que guarda una contrapropuesta**, y **una sola relación activa por par, garantizada por la base**.

**Architecture:** solo esquema y datos. **Ninguna función del flujo cambia en esta fase** — eso es F.2. Lo único que F.1 añade de comportamiento es la visibilidad de los estados nuevos y el índice que prohíbe la segunda relación activa.

**Tech Stack:** Postgres 15 (Supabase cloud), pgTAP vía `tests/db/run-pgtap.mjs`, migraciones versionadas.

**Spec:** `docs/superpowers/specs/2026-09-16-propuesta-negociada-design.md` — §2, §5, §6 y §8. Léelo antes de empezar.

## Global Constraints

- **Sin funciones del flujo.** `crear_invitacion`, `responder_invitacion` y demás **no se tocan**. Si una tarea te empuja a cambiarlas, para: es F.2.
- **Aprobación de SQL: BRAIN**, salvo lo destructivo. **La Tarea 4 borra datos y toca la cuenta real del usuario**: esa la ve y la aprueba **él**, con la lista exacta de filas delante.
- **El `ledger` no se toca y nunca se borra.** Si algo te empuja a desactivar su trigger append-only, para.
- **Antes de reescribir cualquier función SQL, comprueba la ÚLTIMA migración que la define.** Aquí no deberías reescribir ninguna; si pasa, aplica la regla.
- **Nada de `count(*)` global en los tests.** Esta base tiene datos demo permanentes. Escopa por fixture.
- **`ALTER TYPE ... ADD VALUE` va en migración propia**: el valor nuevo no se puede usar en la misma transacción que lo crea. Ya mordió en E.1.
- **Valida con el método de siempre**: migración + test en una transacción con rollback, antes de aplicar de verdad.
- Rutas explícitas en `git add`. Nunca `-A`, nunca `--amend`, sin push. `git diff tsconfig.json` antes de cada commit. Commits por `-F`.
- **El código de este plan es una hipótesis.** Si un test y el snippet se contradicen, gana el test — y avísame.

---

## Task 0: Confirmar el estado real antes de nada

- [ ] **Step 1:** Repetir la medición de BRAIN — relaciones activas **por par sin ordenar**, con el estado de sus órdenes, sus filas de `ledger` y si tienen cita:

```sql
with par as (
  select i.*, least(i.emisor_id, i.receptor_id) a, greatest(i.emisor_id, i.receptor_id) b
    from public.invitaciones i
   where i.estado not in ('rechazada', 'expirada')
)
select p.id, pe.alias emisor, pr.alias receptor, p.tipo, p.estado, p.created_at,
       (select string_agg(o.estado::text, ',') from public.ordenes_pago o where o.invitacion_id = p.id) ordenes,
       exists (select 1 from public.citas c where c.invitacion_id = p.id) tiene_cita
  from par p
  join public.profiles pe on pe.id = p.emisor_id
  join public.profiles pr on pr.id = p.receptor_id
 where (p.a, p.b) in (select a, b from par group by a, b having count(*) > 1)
 order by p.a, p.b, p.created_at, p.id;
```

Lo que BRAIN midió el 2026-09-16: **chris ↔ Vale 2** (una pendiente sin cobrar, una cobrada), **Rodri ↔ Vale 3** (todas cobradas), **Fer ↔ Seba 3** (todas cobradas).

- [ ] **Step 2: Si no coincide, para y avísame.** Significa que alguien creó o respondió propuestas desde entonces, y la resolución aprobada ya no aplica tal cual.
- [ ] **Step 3:** `detectar_discrepancias_sp3()` debe estar en **cero** antes de empezar. Anota el valor: es la línea base de la fase.

---

## Task 1: Los estados nuevos

**Files:**
- Create: `supabase/migrations/…_estados_propuesta_negociada.sql`
- Create: `supabase/tests/36_propuesta_negociada_esquema.sql`

`estado_invitacion` gana, en migración propia: **`contrapropuesta`**, **`contrapropuesta_rechazada`**, **`retirada`**, **`concluida`**.

- [ ] **Step 1: Test que falla** — que los cuatro valores existen.
- [ ] **Step 2: Rojo → Step 3: migración → Step 4: ALTO de BRAIN → Step 5: aplicar e introspección → Step 6: verde y commit.**

---

## Task 2: Intención de cada bebida, "Ayni" y momento propuesto

**Files:**
- Create: `supabase/migrations/…_intencion_y_momento.sql`
- Modify: `supabase/tests/36_propuesta_negociada_esquema.sql`

Tres cambios en una migración:

1. **`bebidas_catalogo.intencion text`**, rellenada con los textos aprobados (spec §2). Lectura: la misma política que ya tiene el catálogo. Escritura: nadie desde el cliente.

| Bebida | Intención |
|---|---|
| Chicha Morada de la Casa | Solo compañía. Un café, una conversación, sin plan fijo. |
| Pisco Sour Clásico | Para pasarla bien. Un bar, un juego, un rato de risas. |
| Maracuyá Sour | Salida casual. Pasear, comer algo, conocer un lugar. |
| Algarrobina Especial | Algo distinto. Un plan que no harías solo. |
| Cóctel de Autor | Evento especial. Un concierto, una exposición, una celebración. |

> **Cómo se guarda la parte en negrita queda a tu criterio** — un solo campo con las dos frases, o `intencion_titulo` + `intencion_detalle`. Si eliges dos campos, facilitas la jerarquía de F.4; si eliges uno, dime por qué.

2. **"Cóctel de Autor Ayni" → "Cóctel de Autor"** con un `update`. **No edites la migración `20260904120000_catalogo_bebidas.sql`**: ya está aplicada, y una migración aplicada no se reescribe.

3. **`invitaciones.momento_propuesto timestamptz`**, nullable.

> **Zona horaria.** `timestamptz` guarda el instante correctamente; el riesgo está en **convertir** texto a hora con la sesión en UTC, que ya corrió 5 horas en `confirmar_cita` (revisión 4.6). En esta fase solo se crea la columna, pero **el test tiene que dejar fijado el contrato**: un momento insertado como `'2026-10-01 20:00 America/Lima'` se lee de vuelta como las 20:00 de Lima.

- [ ] **Step 1: Tests que fallan:** las cinco intenciones presentes y **no vacías**; **ninguna bebida contiene "Ayni"**; la columna `momento_propuesto` existe; el ida y vuelta de la zona horaria; y **el cliente no puede escribir `intencion`** — reprodúcelo como `authenticated`.
- [ ] **Step 2: Rojo → Step 3: migración → Step 4: ALTO de BRAIN → Step 5: aplicar e introspección → Step 6: verde y commit.**

---

## Task 2b: Cantidad y las columnas de la contrapropuesta

> **Añadida el 2026-09-18**, tras dos decisiones nuevas del usuario (spec §8b). Y **tapa un hueco de este mismo plan**: la versión original definía los estados de la contrapropuesta pero **no dónde se guarda lo que la contrapropuesta propone**.

**Files:**
- Create: `supabase/migrations/…_cantidad_y_contrapropuesta.sql`
- Modify: `supabase/tests/36_propuesta_negociada_esquema.sql`

**1. `invitaciones.cantidad integer`**, `check (cantidad >= 1)`.

- **Nula en una solicitud hasta que el rentador actúa**: el amigo no fija cantidad (decisión del usuario). En una invitación la fija el rentador al proponer.
- **Sin tope de negocio** (decisión del usuario). **Pero sí un límite técnico:** el importe vive en `numeric(12,2)`, y `valor × cantidad` puede no caber. Eso **no** se resuelve con un tope en esta columna —sería meter por la puerta de atrás un tope que el usuario rechazó—, sino en F.2, donde `calcular_desglose` tendrá que rechazar con un error claro un total que no quepa. **En esta tarea solo `cantidad >= 1`.**

**2. `invitaciones.contra_bebida_catalogo_id uuid`** (FK al catálogo) y **`invitaciones.contra_tiempo_estimado_min integer`**, las dos nulas hasta que haya contrapropuesta.

- **Van como columnas y no como tabla aparte** porque solo hay **una** contrapropuesta por propuesta: la forma del esquema garantiza la unicidad, sin índice.
- **La cantidad no es contraproponible** (decisión del usuario), así que **no** hay `contra_cantidad`.
- **Una contrapropuesta tiene que cambiar algo:** `check` de que, si hay contrapropuesta, **al menos una** de las dos columnas difiere de la original.

**3. `tiempo_estimado_min` ya existe** desde la fase 4.2. No se toca. Queda en **minutos libres** (decisión del usuario).

- [ ] **Step 1: Tests que fallan:** las tres columnas existen; `cantidad = 0` y `cantidad = -1` se rechazan; una contrapropuesta **idéntica** a la original se rechaza; una que cambia **solo** la bebida pasa; una que cambia **solo** la duración pasa.
- [ ] **Step 2: Rojo → Step 3: migración → Step 4: ALTO de BRAIN → Step 5: aplicar e introspección → Step 6: verde y commit.**

> **Las invitaciones existentes tienen `cantidad` nula.** Es correcto para las solicitudes, pero una invitación ya retenida o capturada **tenía cantidad 1 de hecho**. Rellénalas a 1 en la misma migración — solo las de tipo `invitacion` con orden asociada —, o F.2 se encontrará órdenes cuyo importe no coincide con `valor × cantidad`.

---

## Task 3: Visibilidad de los estados nuevos

**Files:**
- Create: `supabase/migrations/…_rls_estados_negociacion.sql`
- Modify: `supabase/tests/15_invitaciones_rls.sql`

La lista blanca de E.2a hace que **los cuatro estados nuevos nazcan invisibles para quien recibe**. Es la protección funcionando. Se abren a propósito:

- **Visibles para las dos partes:** `contrapropuesta`, `contrapropuesta_rechazada`, `retirada`, `concluida`.
- **`preautorizando` sigue oculto** para quien recibe.

- [ ] **Step 1: Tests que fallan**, **reproduciendo la lectura como el receptor**, uno por estado nuevo: lo ve. Y uno de regresión: **sigue sin ver `preautorizando`**.
- [ ] **Step 2: Rojo → Step 3: migración** — `drop policy` + `create policy`, conservando la forma de lista blanca y **añadiendo** los cuatro, no convirtiéndola en lista negra.
- [ ] **Step 4: ALTO de BRAIN → Step 5: aplicar e introspección → Step 6: verde y commit.**

---

## Task 4: Resolver los duplicados — APROBACIÓN DEL USUARIO

**Destructivo y toca la cuenta real del usuario (`chris`).** Resolución aprobada por él el 2026-09-16 (spec §6.1).

**Files:**
- Create: `supabase/migrations/…_resolver_propuestas_duplicadas.sql` — como **migración versionada**, no como SQL suelto: el cambio de datos queda en el historial y se entiende dentro de tres fases.

**Qué se hace:**

| Par | Acción |
|---|---|
| chris ↔ Vale | **Borrar** la invitación `pendiente` y su orden `preautorizada`. No tiene movimientos contables ni cita. |
| Rodri ↔ Vale | Conservar la **más antigua** (`created_at`, desempate por `id`); las **otras dos → `concluida`**. |
| Fer ↔ Seba | Igual: la más antigua se queda, **las otras dos → `concluida`**. |

**Las cobradas no se borran:** sus filas de `ledger` no admiten borrado y quedarían huérfanas para siempre. Lo que se cambia es solo el estado de la invitación; **órdenes, citas y `ledger` no se tocan**.

- [ ] **Step 1: Escribir la migración por ids concretos**, no por una regla que pueda atrapar otras filas. Saca los ids de la Tarea 0.
- [ ] **Step 2: Validar en transacción con rollback** y comprobar dentro de ella: queda **exactamente una** relación activa por par, y `detectar_discrepancias_sp3()` sigue en **cero**.
- [ ] **Step 3: ENSEÑARLE AL USUARIO la lista exacta de filas** — qué se borra y qué pasa a `concluida`, con emisor, receptor, tipo y fecha — y **esperar su aprobación en su chat**. Yo no la doy: es destructivo y es su cuenta.
- [ ] **Step 4: Aplicar.**
- [ ] **Step 5: Verificar:** la consulta de la Tarea 0 **no devuelve filas**, y la conciliación sigue en **cero**.
- [ ] **Step 6: Commit.**

> **Anótalo en backlog:** esas cuatro invitaciones están en `concluida` **sin que su encuentro haya ocurrido**. Cualquier invariante futura del tipo "`concluida` implica cita finalizada" tiene que contar con ellas. Son datos demo y no deberían llegar a producción si se lanza sobre un proyecto limpio.

---

## Task 5: Una relación activa por par

**Files:**
- Create: `supabase/migrations/…_una_relacion_activa_por_par.sql`
- Modify: `supabase/tests/36_propuesta_negociada_esquema.sql`

```sql
create unique index invitaciones_una_relacion_activa_por_par
  on public.invitaciones (least(emisor_id, receptor_id), greatest(emisor_id, receptor_id))
  where estado not in ('rechazada', 'expirada', 'retirada', 'concluida');
```

**Va después de la Tarea 4**: con los duplicados vivos, el índice no se puede crear.

- [ ] **Step 1: Tests que fallan**, reproduciendo el intento real de crear la segunda relación:
  1. Segunda propuesta **en el mismo sentido** mientras la primera está `pendiente` → **falla**.
  2. Propuesta **en sentido contrario** mientras la primera está `pendiente` → **falla**. Es la regla que decidió el usuario, y la más fácil de que no funcione.
  3. Segunda propuesta mientras la primera está **`aceptada`** → **falla**. Es el "hasta que termine el encuentro".
  4. Segunda propuesta mientras la primera está **`preautorizando`** → **falla**.
  5. Nueva propuesta tras una **`rechazada`**, **`expirada`**, **`retirada`** o **`concluida`** → **funciona**. Un test por estado terminal.
  6. **Un par distinto** no se ve afectado.
- [ ] **Step 2: Rojo → Step 3: migración → Step 4: ALTO de BRAIN → Step 5: aplicar e introspección → Step 6: verde y commit.**

> **Consecuencia que el usuario aceptó:** hoy nada lleva una invitación a `concluida`, así que un par que acepta queda bloqueado hasta el sub-proyecto 5. **No lo "arregles".**

---

## Cierre de F.1

- [ ] Las cuatro suites, salida real pegada.
- [ ] **Criterio objetivo:** la consulta de la Tarea 0 **devuelve cero filas**, y `detectar_discrepancias_sp3()` está en **cero**, igual que al empezar.
- [ ] Ninguna función del flujo modificada: `git diff` de la fase sin cambios en `crear_invitacion` ni `responder_invitacion`.
- [ ] `git diff tsconfig.json` limpio. **Sin push. No cierres la fase.**
