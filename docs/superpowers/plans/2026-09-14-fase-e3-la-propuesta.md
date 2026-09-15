# Fase E.3 — La propuesta, de punta a punta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un usuario pueda por fin proponer un encuentro y que el otro pueda responderle. El motor lleva dos fases construido y **nunca ha estado conectado a nada**.

**Architecture:** una `lib/invitaciones.ts` que habla con las Edge Functions ya desplegadas, dos superficies nuevas (proponer y responder), y la muerte de las tres pantallas huérfanas del modelo viejo. Sin lógica de dinero en el cliente: los importes se leen, nunca se calculan.

**Tech Stack:** React Native + Expo Router, Jest + testing-library, tokens de `lib/theme.ts`.

**Spec:** `docs/superpowers/specs/2026-09-09-rediseno-dinero-sbs-design.md` §4, §4.1 y §7.

## El hecho que define esta fase

**El flujo de invitar no tiene interfaz y nunca la tuvo.** El botón "Invitar una bebida" de `app/index.tsx` **no tiene `onPress`** — es decorativo. El cliente **jamás** ha llamado a `crear-invitacion` ni a `responder-invitacion`. No hay ninguna pantalla para ver o responder propuestas recibidas. La bitácora de la fase 4.2 lo confirma: sus entregables fueron la Edge Function, la validación compartida y los tests, **ninguna pantalla**.

Los chats existen porque el seed crea las citas saltándose la invitación.

**Esto no es reescribir dos pantallas: es construir la interacción central del producto.**

## Global Constraints

- **El cliente nunca calcula un importe.** Ni el fee, ni el total, ni una conversión. Se leen del servidor y se muestran. Si te ves escribiendo `* 0.15`, para.
- **Vocabulario prohibido** (vetos 18–20): nada de "saldo", "billetera", "monedero" ni "wallet". Los precios siempre en soles, 1:1, nunca "2 bebidas".
- **Para el amigo, `preautorizando` y `pendiente` se ven IGUAL.** Los dos dicen "esperando respuesta". Pintar uno distinto **delata que a la otra parte le falló la tarjeta** (backlog, E.2b). Es la regla de copy más fácil de romper sin darse cuenta.
- **Reglas de UI de `CLAUDE.md`:** rojo solo para SOS/error/no-show; estados con **icono y texto**, nunca solo color; contraste AA; targets ≥44dp; cifras tabulares; modo oscuro.
- **Skills de diseño:** `awesome-design-skills/skills/refined/SKILL.md` y `.../editorial/SKILL.md`. Se usan para **retícula, jerarquía y ritmo tipográfico**. **Los tokens de `lib/theme.ts` ganan sobre cualquier paleta que propongan.** La identidad Martini está cerrada.
- Rutas explícitas en `git add`. Nunca `-A`, nunca `--amend`, sin push. `git diff tsconfig.json` antes de cada commit. Commits por `-F`.
- **Antes de reescribir cualquier función SQL, comprueba cuál es la ÚLTIMA migración que la define, no la primera que la creó.** Regla heredada de E.2a, donde su ausencia casi reintroduce una fuga de idempotencia cross-user ya cerrada. **Se me olvidó incluirla en la primera versión de este plan**; BUILDER la aplicó igual, de memoria, en la Tarea 2.

  ```bash
  grep -l "create or replace function public.<nombre>" supabase/migrations/*.sql | sort | tail -1
  ```

- **Cuidado con los `count(*)` globales en los tests.** Esta base tiene datos demo persistentes desde E.2b que **no se pueden borrar** (ledger append-only, órdenes capturadas). Un assert que cuente una tabla entera falla aunque la función sea correcta. Escopa siempre por el fixture. Ya pasó dos veces: `13_confirmar_orden_pago.sql` en E.2b, y el primer borrador de la Tarea 2 de esta fase.
- **Dos `fireEvent.press` seguidos sin esperar nada entre medias corrompen el archivo de test entero.** Abren `act()` superpuestos, y los tests *siguientes* fallan con errores sin relación aparente — el síntoma aparece lejos de la causa. Para probar una guarda de doble toque, **espera a que la UI refleje el primer toque** (por ejemplo, que el botón muestre "Enviando…") antes del segundo: además de no romper nada, prueba lo real —que el botón deshabilitado bloquea— en vez de forzarlo. Detectado por BUILDER en la Tarea 4; aplica igual a la Tarea 5.
- **El código de este plan es una hipótesis.** En E.2a seis de nueve bloques destaparon defectos de premisa. **Si un test y el snippet se contradicen, gana el test** — y avísame.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/…_calcular_desglose.sql` | Función SQL de solo lectura que devuelve el desglose de una bebida. |
| `lib/invitaciones.ts` | Cliente de `crear-invitacion` / `responder-invitacion` + lecturas de propuestas. |
| `app/invitar/[receptorId].tsx` | Flujo de proponer: bebida → confirmar → enviar. |
| `app/propuestas.tsx` | Recibidas y enviadas, con el botón de responder. |
| `app/index.tsx` | El CTA por fin navega. |
| `app/store.tsx`, `app/bar.tsx`, `app/wallet.tsx` | **Se eliminan.** |
| `lib/bar.ts` | **Se elimina** (`getMiBar` y `getBalance` apuntan a relaciones que ya no existen). |

---

## Task 1: Matar las tres pantallas huérfanas

Van primero porque son las que ensucian cualquier lectura del árbol, y porque **ninguna está enlazada desde ningún sitio**: son rutas alcanzables solo escribiendo la URL. Borrarlas no rompe navegación.

**Files:**
- Delete: `app/store.tsx`, `app/bar.tsx`, `app/wallet.tsx`, `lib/bar.ts`, y sus tests (`tests/app/store.test.tsx`, `tests/app/bar.test.tsx`, `tests/app/wallet.test.tsx`, `tests/lib/bar.test.ts`)
- Modify: `lib/tienda.ts` (pierde `CompraResult`, que solo sostenía el stub de `store.tsx`)

- [ ] **Step 1: Confirmar que siguen huérfanas antes de borrar**

```bash
grep -rn "/store\|/bar\|/wallet\|lib/bar" app/ lib/ components/ --include=*.tsx --include=*.ts | grep -v "^app/store\|^app/bar\|^app/wallet\|^lib/bar"
```

Esperado: **nada**. Si aparece algo, para y avísame: significa que alguien las enlazó y el borrado sí rompe navegación.

- [ ] **Step 2: Borrar, y borrar sus tests de verdad**

Las tres suites están en `.skip` desde E.1 esperando esta fase. **No las conviertas en tests de otra cosa: bórralas.** Lo que probaban —stock, saldo, compra suelta— no existe y no vuelve. El de `wallet` lo reemplaza E.4 con "Por cobrar", que es una pantalla distinta, no la misma renombrada.

- [ ] **Step 3: Verde y commit** — `npm test && npm run typecheck && npm run lint`

> Tras esto, el conteo de suites baja y **ya no debería quedar ninguna en `.skip`**. Dilo en el reporte: llevamos desde E.1 arrastrando ese "verde con cobertura apagada".

---

## Task 2: El desglose, calculado en el servidor

**El hueco que hay que tapar.** El rentador tiene que ver **cuánto va a pagar antes de confirmar**. Hoy eso es imposible sin romper una regla: `valor_v` está en el catálogo y es visible, pero el `buyer_fee` se calcula server-side y **nada lo expone al cliente**. Si la pantalla lo calculara, violaría la regla de oro del proyecto; si no lo muestra, cobramos sin enseñar el total — y en Perú el precio total antes de contratar no es opcional.

**Y de paso reduce deuda.** La fórmula del fee vive hoy en **dos** sitios (TypeScript en `_shared/pagos.ts`, SQL dentro de `crear_invitacion`). Esta función pasa a ser **la única copia en SQL**, y `crear_invitacion` y `responder_invitacion` la llaman en vez de repetirla.

**Files:**
- Create: `supabase/migrations/20260915120000_calcular_desglose.sql`
- Create: `supabase/tests/35_calcular_desglose.sql` → **≥ 8 aserciones**

**Interfaces:**
- Produces: `public.calcular_desglose(p_bebida_catalogo_id uuid) returns table (valor_v numeric, buyer_fee numeric, total numeric)`, `stable`, `security definer`, **`execute` concedido a `authenticated`** — es solo lectura y no toca dinero de nadie.

- [ ] **Step 1: El contrato de test — ≥ 8 aserciones**

1. Devuelve el desglose de una bebida activa: `valor_v` del catálogo, `buyer_fee` = 15% redondeado en centavos, `total` = suma.
2. Coincide **al céntimo** con lo que `crear_invitacion` acaba escribiendo en `ordenes_pago` para esa misma bebida. **Este es el assert que importa**: si divergen, el usuario ve un precio y se le cobra otro.
3. Una bebida **inactiva** no devuelve filas.
4. Una bebida inexistente no devuelve filas.
5. `authenticated` **sí** puede ejecutarla — reprodúcelo, no leas `pg_proc`.
6. `anon` **no**.
7. No escribe nada: el ledger y `ordenes_pago` siguen igual tras llamarla.
8. `crear_invitacion` sigue produciendo los mismos montos que antes de esta tarea (regresión).

- [ ] **Step 2: Rojo granular** → `npm run test:db`

- [ ] **Step 3: La migración**

La función nueva, y `create or replace` de `crear_invitacion` y `responder_invitacion` **sustituyendo su cálculo inline por una llamada a `calcular_desglose`**. Firma idéntica en las dos, así que sin `drop`.

**Conserva todos los comentarios existentes** y actualiza el de "Desglose en centavos" para que diga dónde vive ahora la fórmula.

- [ ] **Step 4: ALTO — BRAIN revisa y autoriza**

- [ ] **Step 5: Introspección + Step 6: verde y commit**

---

## Task 3: `lib/invitaciones.ts`

**Files:**
- Create: `lib/invitaciones.ts`, `tests/lib/invitaciones.test.ts`

**Interfaces:**

```ts
export type Desglose = { valorV: number; buyerFee: number; total: number };
export async function getDesglose(bebidaCatalogoId: string): Promise<Desglose | null>;

export type CrearResult = { ok: true; invitacionId: string } | { ok: false; error: string };
export async function crearPropuesta(p: {
  receptorId: string; tipo: 'invitacion' | 'solicitud';
  bebidaCatalogoId: string | null; tiempoEstimadoMin: number | null;
  zonaAproximada: string | null; idempotencyKey: string;
}): Promise<CrearResult>;

export async function responderPropuesta(p: {
  invitacionId: string; accion: 'aceptar' | 'rechazar'; bebidaCatalogoId: string | null;
}): Promise<{ ok: true; resultado: string } | { ok: false; error: string }>;

export type Propuesta = { /* id, tipo, estado, contraparte, bebida, creadaEn */ };
export async function getPropuestasRecibidas(): Promise<Propuesta[]>;
export async function getPropuestasEnviadas(): Promise<Propuesta[]>;
```

- [ ] **Step 1: Tests que fallan.** Mockea `supabase` como ya hacen `tests/lib/*.test.ts`. Cubre: que `crearPropuesta` **reusa la misma `idempotencyKey` en un reintento** y no genera una nueva; que un error del endpoint se devuelve como `{ok:false}` con el mensaje, no lanza; y que `getPropuestasRecibidas` **no** trae las que están en `preautorizando` (la RLS ya las oculta al receptor, pero el test lo fija como contrato de la UI).

- [ ] **Step 2: Rojo → Step 3: implementar → Step 4: verde → Step 5: commit**

> La `idempotencyKey` se genera **una vez por intento del usuario** y se reusa mientras ese intento siga vivo. Si la regeneras en cada reintento, cada toque del botón crea una propuesta nueva **y un hold nuevo sobre la tarjeta**. `newIdempotencyKey()` ya existe en `lib/tienda.ts`; muévela a `lib/invitaciones.ts`, que es donde pertenece ahora.

---

## Task 3b: El panel de la cita en el chat lleva roto desde E.1

> **Añadida el 2026-09-14.** Encontrado por BUILDER durante la Tarea 3 y confirmado por BRAIN. **Lo rompió la serie E**, así que lo arregla la serie E.

`lib/citas.ts` → `getCitaDetalle` consulta `citas → invitaciones → bar → bebidas_catalogo`. **`bar` se eliminó en E.1.** La consulta falla, y la función hace `if (error || !data) return null` — así que **falla en silencio**: el panel de la cita desaparece entero del chat, **incluido el botón de confirmar cita del amigo**. No es cosmético: es la fase 4.5 muerta desde E.1.

**Por qué va en esta fase y no "en una sesión aparte":** el criterio de cierre de E.3 es una prueba real de punta a punta —proponer, aceptar, abrir el chat— y esa prueba aterriza justo en este panel. Dejarlo para después significa cerrar E.3 sin poder completar su propia verificación.

**Barrido hecho por BRAIN:** es el **único** caso. Ninguna otra consulta del cliente apunta a una relación inexistente (`.from('fotos')` es un bucket de storage, no una tabla).

**Files:**
- Modify: `lib/citas.ts`, `tests/lib/citas.test.ts`

- [ ] **Step 1: El test que falla**

El test actual **mockea supabase**, así que valida el mapeo y **nunca la consulta**. Por eso pasa con la consulta rota. Escribe el assert sobre **la cadena `select` que se le pasa al cliente**: que contenga `bebidas_catalogo` colgando de `invitaciones`, y que **no** contenga `bar`. Es feo, pero es lo único que un test con supabase mockeado puede afirmar de verdad aquí.

- [ ] **Step 2: Rojo** → `npm test -- citas`

- [ ] **Step 3: Arreglar la consulta**

`bebida_catalogo_id` vive ahora **en `invitaciones`** (E.1), así que el salto intermedio sobra:

```
'estado, zona, hora, mensaje, invitaciones(tiempo_estimado_min, bebidas_catalogo(nombre, valor_v))'
```

Ajusta `CitaRow` en consecuencia y actualiza el comentario que todavía dice "vía invitaciones → bar → bebidas_catalogo".

- [ ] **Step 4: Verde, y compruébalo DE VERDAD contra la base**

El test con mock no prueba que la consulta funcione. Ejecútala contra Supabase con una cita real del seed y confirma que devuelve la bebida y su valor. **Pega esa salida** — es la única verificación que vale aquí.

- [ ] **Step 5: Commit**

---

## Task 4: El flujo de proponer

**Files:**
- Create: `app/invitar/[receptorId].tsx`, `tests/app/invitar.test.tsx`
- Modify: `app/index.tsx` (el CTA navega)

**Dos pasos, no seis.** El wizard de alta de D.3 tiene sentido porque recoge muchos datos; aquí son dos decisiones. Reusa `StepHeader` y `SelectionGrid`, que ya existen y ya están en la identidad.

```
Paso 1  Elegir bebida    → SelectionGrid con el catálogo, cada una con su importe en soles
Paso 2  Confirmar        → a quién, qué bebida, y el DESGLOSE COMPLETO (valor + comisión + total)
                           botón "Invitar"  → crearPropuesta → volver con confirmación
```

- [ ] **Step 1: Tests que fallan.** Cubre: el paso 2 **muestra el total antes del botón**; el botón queda **deshabilitado mientras la llamada está en vuelo** (un doble toque no dispara dos `crearPropuesta`); un error del servidor se muestra **en pantalla con icono y texto**, sin dejar la pantalla en blanco; y una `solicitud` (rol amigo) **no pide bebida** y salta directo a confirmar.

- [ ] **Step 2: Rojo → Step 3: implementar → Step 4: verde → Step 5: commit**

> **El total sale de `getDesglose`, nunca de una multiplicación en el componente.** Es el punto donde más fácil sería "ahorrarse una llamada".
>
> **Mientras la propuesta está en vuelo el usuario no puede tocar dos veces.** La idempotencia del backend lo protege de duplicar la fila, pero la UI no debe apoyarse en eso para no parecer rota.

---

## Task 5: Responder propuestas

**Files:**
- Create: `app/propuestas.tsx`, `tests/app/propuestas.test.tsx`
- Modify: la navegación, para que se llegue a esta pantalla

**La necesitan los dos roles**: el amigo responde invitaciones, el rentador responde solicitudes. Una sola pantalla, dos listas: **recibidas** (con acciones) y **enviadas** (solo estado).

- [ ] **Step 1: Tests que fallan.** Cubre:

- Aceptar una **invitación** recibida → llama a `responderPropuesta` con `aceptar` y **sin bebida**.
- Aceptar una **solicitud** recibida (rol rentador) → **exige elegir bebida** y muestra su desglose antes de confirmar. Es un cobro real: no puede haber un "aceptar" de un toque sin ver el importe.
- Rechazar → no pide bebida.
- **`preautorizando` y `pendiente` se renderizan con el MISMO texto** en la lista de enviadas. Este test es el que protege el hallazgo de privacidad de E.2b; escríbelo explícito y con ese comentario.
- Cada estado se muestra con **icono y texto**, nunca solo color.

- [ ] **Step 2: Rojo → Step 3: implementar → Step 4: verde → Step 5: commit**

---

## Task 6: La pasada de diseño

Hasta aquí las pantallas funcionan. Ahora se ven como Martini.

- [ ] **Step 1: Leer las dos skills** — `refined` y `editorial`, enteras, antes de tocar estilos.
- [ ] **Step 2: Aplicar retícula, jerarquía y ritmo.** Títulos serif italic, labels mono, superficies oscuras cálidas, importes con cifras tabulares. **Ningún color fuera de `lib/theme.ts`.** Si una skill propone una paleta, se ignora la paleta y se toma la estructura.
- [ ] **Step 3: Revisar accesibilidad** — contraste AA, targets ≥44dp, estados con icono y texto, `accessibilityLabel` en todo lo pulsable.
- [ ] **Step 4: Verde y commit**

---

## Cierre de E.3

- [ ] Las cuatro suites, salida real pegada. **Cero suites en `.skip`** — si queda alguna, dilo y explica cuál.
- [ ] **Verificación real en el navegador, no solo tests.** Con el seed cargado: proponer una invitación de verdad, verla llegar a la otra parte, aceptarla, y comprobar en base que la orden quedó `capturada` con sus 3 filas de ledger. Pega las capturas o la salida.
- [ ] `detectar_discrepancias_sp3()` en **cero** después de esa prueba.
- [ ] `git diff tsconfig.json` limpio. **Sin push. No cierres la fase.**
