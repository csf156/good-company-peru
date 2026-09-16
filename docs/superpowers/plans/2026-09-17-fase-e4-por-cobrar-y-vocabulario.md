# Fase E.4 — "Por cobrar" y vocabulario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el amigo vea lo que tiene por cobrar sin que nada lo presente como un saldo, y que no quede en la app ni en sus textos públicos ningún resto del vocabulario de monedero. **Cierra la serie E** y deja la app publicable.

**Architecture:** una lectura de la vista `por_cobrar` (E.1), una pantalla solo para el rol amigo, y un barrido de textos con una regresión automática que impida que el vocabulario vuelva.

**Tech Stack:** React Native + Expo Router, Jest + testing-library, tokens de `lib/theme.ts`.

**Spec:** `docs/superpowers/specs/2026-09-09-rediseno-dinero-sbs-design.md` §3.3, §3.4 y §6. Vetos 16, 18, 19 y 20 de `docs/backlog.md`.

## Global Constraints

- **Vocabulario prohibido** (veto 18): "saldo", "billetera", "monedero", "wallet" — en UI, textos públicos y copy.
- **Nada que presente el importe como poder de compra** (veto 19): ni "usar", ni "gastar", ni botones de acción sobre el importe.
- **Nada de acumular** (veto 16): ni opción, ni umbral mínimo, ni copy que lo sugiera.
- **Precios siempre en soles, 1:1** (veto 20). Nunca "15 V", nunca "2 bebidas".
- **No prometas lo que no existe.** La liquidación es la fase 6.3 y **no está construida**: nada de fechas ("el próximo lunes"), ni pasos que la app no tiene. Lo que sí puedes afirmar es lo que ya garantiza la cláusula 13 del ToS.
- **El rentador no tiene vista de dinero agregado** (spec §3.3). Nunca ve "Por cobrar".
- **Skills de diseño** `refined` y `editorial` para jerarquía y ritmo; **los tokens de `lib/theme.ts` mandan**.
- Rutas explícitas en `git add`. Nunca `-A`, nunca `--amend`, sin push. `git diff tsconfig.json` antes de cada commit. Commits por `-F`.
- **El código de este plan es una hipótesis.** Si un test y el snippet se contradicen, gana el test — y avísame.

---

## Task 1: "Por cobrar"

**Files:**
- Create: `lib/por-cobrar.ts`, `tests/lib/por-cobrar.test.ts`
- Create: `app/por-cobrar.tsx`, `tests/app/por-cobrar.test.tsx`
- Modify: `app/index.tsx` — acceso **solo para el rol amigo**, siguiendo el patrón del botón "Ver propuestas" que añadió E.3

**Interfaces:**

```ts
/** Lo que el usuario tiene por cobrar, en soles. 0 si no tiene nada. */
export async function getPorCobrar(): Promise<number>;
```

**Hoy devuelve 0 para todo el mundo**, y es correcto: la vista solo suma `payout`, y no hay ninguno porque la liberación de escrow es la fase 5.4. **La vista no devuelve una fila con 0 cuando no hay nada: no devuelve fila.** Eso es 0, no un error.

**Copy** (borrador de BRAIN; lo verá el usuario al cerrar la fase):

| Elemento | Texto |
|---|---|
| Título | **Por cobrar** |
| Importe | `S/ 0.00` — cifras tabulares |
| Explicación | Lo que ganaste por encuentros verificados y aún no se ha depositado. |
| Destino | Se deposita automáticamente en una cuenta bancaria a tu nombre. |
| Vacío | Aún no tienes nada por cobrar. Aparecerá aquí cuando completes un encuentro verificado. |

> **Sin fecha, sin "próximo lunes", sin botón.** La liquidación periódica (y el adelanto a demanda) son la fase 6.3, que no existe. La frase del destino es lo que ya compromete la cláusula 13 del ToS, así que es cierta; la fecha no lo sería.

- [ ] **Step 1: Tests que fallan.** Cubre como mínimo:
  - `getPorCobrar` devuelve **0 cuando la vista no trae fila**, y el importe cuando sí.
  - **El rol amigo ve el acceso; el rol rentador no lo ve.** Dos tests separados.
  - La pantalla muestra el importe **en soles con dos decimales**.
  - Con 0, muestra el estado vacío.
  - **No hay ningún elemento pulsable que actúe sobre el importe** — ni "retirar", ni "usar".
- [ ] **Step 2: Rojo → Step 3: implementar → Step 4: verde → Step 5: commit.**

---

## Task 2: El barrido

Hallazgos de BRAIN (2026-09-17). Son tres, y **la app ya está casi limpia**: E.3 borró las pantallas que concentraban el vocabulario.

| Dónde | Qué | Veto |
|---|---|---|
| `app/chats/[id].tsx:140` | El panel de la cita muestra `{cita.valorV} V` → "15 V". **Debe ser `S/ 15.00`.** | 20 |
| `public/privacidad.html:52` | "registro append-only de movimientos de **saldo**" y "datos sensibles (DNI, **saldos**)". Es un documento **legal y público**, y además **ya es falso**: no existen saldos. | 18 |
| `lib/profile.ts:47` | Comentario interno: "saldo/nivel". No es visible, pero sí es lo que el siguiente lector copiará. | 18 |

**Texto de reemplazo para la política de privacidad:**

> …y registro append-only de movimientos de dinero. Los datos sensibles (DNI, importes y pagos) no son visibles para otros usuarios de la plataforma.

### Lo que NO se toca, y es importante

**`lib/tos.ts` usa "saldo", "monedero" y "billeteras" a propósito.** La cláusula 13 dice que los importes **no** constituyen "un saldo disponible, un monedero ni un crédito de uso general": nombrar lo que no son es justamente lo que da fuerza jurídica al texto. Y "billeteras digitales" aparece al **prohibir** compartir datos de pago externos. **Un barrido mecánico rompería el ToS.** No lo toques; si crees que hay algo mal ahí, dímelo.

**Tampoco la hora cruda del mismo panel.** Se ve en formato ISO sin formatear, en la misma línea que el "15 V". Es tentador arreglarlo de paso, pero es un problema de **zona horaria** (revisión 4.6) que la serie F resuelve junto con el momento propuesto. Déjalo.

- [ ] **Step 1: Tests que fallan:** el panel de la cita muestra `S/ 15.00` y **no** `15 V`.
- [ ] **Step 2: Rojo → Step 3: los tres cambios → Step 4: verde → Step 5: commit.**

---

## Task 3: Que no vuelva

Un test de regresión que **falle si el vocabulario reaparece**, para no depender de que alguien se acuerde del veto.

**Files:**
- Create: `tests/vocabulario-vetado.test.ts`

- [ ] **Step 1:** Recorrer los archivos de `app/`, `components/`, `lib/` y `public/` buscando **saldo, billetera, monedero, wallet** (sin distinguir mayúsculas) y fallar si aparece alguno.
- [ ] **Step 2: Excluir `lib/tos.ts` explícitamente, con un comentario que diga por qué** — si no, el siguiente que vea el test fallar "arreglará" el ToS.
- [ ] **Step 3:** Añade el patrón de precio en unidad propia (`\d+ V\b`) al mismo test.
- [ ] **Step 4: Comprueba que el test falla de verdad**: introduce la palabra en un archivo a mano, córrelo, verifica el rojo, y revierte. **Pega esa salida** — un test de regresión que nunca se vio fallar no protege nada.
- [ ] **Step 5: Verde y commit.**

---

## Task 4: La pasada de diseño

- [ ] Leer `refined` y `editorial` antes de tocar estilos. Jerarquía de "Por cobrar": **importe** como elemento dominante, **explicación** secundaria, **destino** terciario. Tokens de `lib/theme.ts`, cifras tabulares, contraste AA, estado vacío con icono y texto.
- [ ] Verde y commit.

---

## Cierre de E.4 — y de la serie E

- [ ] Las cuatro suites, salida real pegada.
- [ ] **Verificación real en el navegador:** entrar como **amigo** y ver "Por cobrar" con su estado vacío; entrar como **rentador** y comprobar que **no aparece**; abrir un chat con cita y ver el importe en soles.
- [ ] `git diff tsconfig.json` limpio. **Sin push. No cierres la fase.**

> **Esta es la última fase de la serie E.** Al cerrarla la app vuelve a ser publicable y **el push que el usuario dejó en pausa recupera sentido**. Proponlo en el reporte, pero **no lo hagas**: lo decide él.
