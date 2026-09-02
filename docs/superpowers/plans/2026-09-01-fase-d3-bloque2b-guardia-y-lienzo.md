# Fase D.3 — Bloque 2b: guardia de rutas y lienzo del alta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arreglar el bug que impide terminar el alta (al completar el wizard, el guardián de rutas devuelve al paso 1) y darle al alta el lienzo que le falta: ancho máximo centrado y una textura monocroma sutil en los laterales.

**Architecture:** El bug nace de que `app/_layout.tsx` lee el perfil **solo cuando cambia la sesión**, así que tras guardar el alta sigue creyendo que el perfil está incompleto. Se resuelve con un contexto mínimo que expone `refreshProfile()`: `_layout` lo provee, y las pantallas que escriben el perfil lo llaman tras guardar con éxito. Determinista, sin refetch en cada navegación. El lienzo es puramente presentacional y vive en `Screen`, no en el wizard — cualquier pantalla futura lo hereda.

**Tech Stack:** React Native + Expo Router · Jest + @testing-library/react-native

**Spec:** [`docs/superpowers/specs/2026-08-25-onboarding-premium-design.md`](../specs/2026-08-25-onboarding-premium-design.md) §1

---

## Contexto: cómo se encontró el bug

El usuario recorrió el alta completa por primera vez y, al terminar el paso 7, volvió al paso 1. La instrumentación que se acababa de construir en la Tarea 7 del bloque 2 lo capturó con precisión:

```
21:23:40.000  paso 7  completado
21:23:40.257  paso 1  paso_visto     ← 257 ms después
```

Y los datos **sí se guardaron**: el perfil quedó completo en la base (nombre, alias, fecha de nacimiento, género, foto, 5 hobbies, 2 tipos de salida). No falla el guardado; falla lo que ocurre después.

**El bug es anterior al wizard** — existe desde la fase 1.3. Con el formulario viejo de una sola pantalla pasaba igual. Nunca se detectó porque **nadie había completado el alta de punta a punta**. La regla del proyecto de no tocar fases cerradas cede aquí: sin este arreglo, la fase actual no se puede terminar.

---

## Global Constraints

- **`computeRedirect` no cambia.** La función pura de `lib/route-guard.ts` es correcta; el fallo está en que recibe datos viejos. Sus tests deben seguir pasando sin tocarse — si tienes que modificarlos, algo se está desviando.
- **Sin dependencias nuevas.** El lienzo se construye con primitivas de React Native y tokens de `lib/theme.ts`.
- **Sin archivos binarios.** Nada de PNG ni SVG embebidos para la textura.
- **Guardia anti-color-literal activa:** el CI falla si aparece un hex en `app/` o `components/`. Si te falta un color para la textura, agrégalo a `lib/theme.ts` — y **repórtalo**, porque significa que al design system le faltaba un token.
- **Sensación premium.** La textura debe leerse como papel texturado en penumbra, no como fondo de videojuego. Si al mirarla dudas, es que está demasiado marcada.
- **Idioma:** UI en español de Perú, informal "tú". Código y commits en inglés técnico.
- **Cierre de cada tarea:** `npm run lint` + `npm run typecheck` + `npm test` en verde.
- **El servidor de Expo reescribe `tsconfig.json` al arrancar.** Revisa `git diff tsconfig.json` antes de cualquier `git add -A`. Ya mordió tres veces hoy.
- **No hagas push. No cierres D.3** — falta el bloque 3 (KYC).

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `lib/profile-context.tsx` | Contexto con `refreshProfile()` | 1 |
| `app/_layout.tsx` | Provee el contexto; relee el perfil cuando se lo piden | 1 |
| `app/(auth)/profile-setup.tsx` | Llama `refreshProfile()` tras guardar | 1 |
| `app/(auth)/kyc.tsx` | Igual, tras verificar | 1 |
| `components/Screen.tsx` | Ancho máximo centrado + laterales con textura | 2 |
| `components/SideTexture.tsx` | La textura monocroma | 2 |

---

## Task 1: El alta se puede terminar

**Files:**
- Create: `lib/profile-context.tsx`, `tests/lib/profile-context.test.tsx`
- Modify: `app/_layout.tsx`, `app/(auth)/profile-setup.tsx`, `app/(auth)/kyc.tsx`
- Test: `tests/app/profile-setup.test.tsx`, `tests/app/_layout.test.tsx` (si existe)

**Interfaces:**
- Produces: `useProfileRefresh(): () => void` — lo consumen `profile-setup` y `kyc`.

- [ ] **Step 1: Test que reproduce el bug**

Este test debe fallar **antes** del arreglo. Es la prueba de que el arreglo sirve, no una formalidad:

```typescript
it('tras guardar el alta, vuelve a leer el perfil (si no, el guardián devuelve al paso 1)', async () => {
  const refreshProfile = jest.fn();
  // renderizar el wizard dentro de un ProfileContext.Provider con ese mock
  // recorrer los 7 pasos y terminar
  expect(mockedUpdateOwnProfile).toHaveBeenCalledTimes(1);
  expect(refreshProfile).toHaveBeenCalledTimes(1);
});

it('no vuelve a leer el perfil si el guardado falló', async () => {
  mockedUpdateOwnProfile.mockResolvedValue({ error: 'Falló la red' });
  // recorrer y terminar
  expect(refreshProfile).not.toHaveBeenCalled();
});
```

El segundo importa: releer tras un fallo dejaría el estado igual y daría una sensación de "no pasó nada" sin mostrar el error.

- [ ] **Step 2: Correr y verificar que fallan**

```bash
npx jest tests/app/profile-setup.test.tsx
```

- [ ] **Step 3: Implementar el contexto**

`lib/profile-context.tsx`:

```typescript
import { createContext, useContext } from 'react';

/**
 * Permite a una pantalla pedirle al layout que vuelva a leer el perfil.
 *
 * Por qué existe: `app/_layout.tsx` lee el perfil solo cuando cambia la
 * sesión. Al terminar el alta la sesión NO cambia, así que el guardián
 * seguía viendo `profileStatus: 'incomplete'` y devolvía al usuario al
 * paso 1 — con el perfil ya guardado en la base. Bug presente desde la
 * fase 1.3, invisible hasta que alguien completó el alta entera.
 *
 * Se prefiere esto a releer en cada navegación: una lectura por escritura,
 * en el momento exacto en que el dato cambió.
 */
export const ProfileRefreshContext = createContext<() => void>(() => {});

export function useProfileRefresh(): () => void {
  return useContext(ProfileRefreshContext);
}
```

- [ ] **Step 4: Conectar `_layout`**

En `app/_layout.tsx`, extraer la lectura del perfil a una función reusable (`cargarPerfil`), llamarla desde el efecto de `[session]` **y** exponerla por el provider envolviendo el árbol. Cuidado con dos cosas:

- Conservar la guarda `mounted` que ya existe, para no setear estado tras desmontar.
- Que `refreshProfile` sea estable (`useCallback`), o el provider re-renderiza el árbol entero en cada render.

- [ ] **Step 5: Llamarla desde las pantallas que escriben**

En `profile-setup.tsx`, tras `updateOwnProfile` y `upsertPreferenciasSalida` **exitosos**, llamar `refreshProfile()` **antes** de `router.replace('/')`. En `kyc.tsx`, igual tras una verificación exitosa — mismo bug latente: al verificar, `kyc_estado` cambia en la base pero el layout sigue con el valor viejo.

- [ ] **Step 6: Verificar en el preview real, no solo en tests**

Esto es lo que ningún test cubre. Con el preview corriendo, completar el alta con una cuenta cuyo perfil esté incompleto y confirmar que **aterriza en KYC**, no de vuelta en el paso 1. Después consultar la tabla de eventos: no debe haber un `paso_visto` de paso 1 justo después del `completado`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: releer el perfil tras el alta para no volver al paso 1"
```

---

## Task 2: Lienzo del alta

**Files:**
- Create: `components/SideTexture.tsx`, `tests/components/SideTexture.test.tsx`
- Modify: `components/Screen.tsx`, `tests/components/Screen.test.tsx` (si existe)

**Interfaces:**
- Produces: `<Screen framed>` — ancho máximo centrado con laterales texturados.

**El problema:** `components/Screen.tsx` no fija ancho máximo, así que en un navegador de escritorio el contenido se estira de borde a borde. En teléfono se ve bien; en web, no. El usuario lo describió como "muy horizontal".

- [ ] **Step 1: Tests que fallan**

```typescript
it('limita el ancho del contenido y lo centra', async () => {
  await render(<Screen framed><Text>hola</Text></Screen>);
  const contenido = screen.getByTestId('screen-content');
  expect(contenido.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ maxWidth: expect.any(Number) })]),
  );
});

it('no muestra textura lateral en pantallas angostas', async () => {
  // simular ancho de teléfono
  expect(screen.queryByTestId('side-texture')).toBeNull();
});

it('muestra textura lateral en pantallas anchas', async () => {
  // simular ancho de escritorio
  expect(screen.getAllByTestId('side-texture')).toHaveLength(2);
});

it('la textura es decorativa para lectores de pantalla', async () => {
  expect(screen.getAllByTestId('side-texture')[0].props.accessibilityElementsHidden).toBe(true);
});
```

- [ ] **Step 2: Correr y verificar que fallan**

- [ ] **Step 3: Implementar `SideTexture`**

Requisitos, el diseño visual es tuyo dentro de estas reglas:

- **Trama de puntos monocroma**, generada con `View`s (sin imágenes, sin dependencias). Un punto pequeño repetido en retícula regular.
- **Muy bajo contraste**: el punto apenas se separa del fondo. Debe leerse como textura de papel en penumbra, no como patrón. Si al mirarlo lo primero que ves es la trama, está demasiado marcado — bájalo.
- **Color del token**, nunca literal. `colors.muted` o `colors.border` son los candidatos naturales; si necesitas uno intermedio, agrégalo a `lib/theme.ts` y repórtalo.
- **Memoizada** (`useMemo` o `React.memo`): la retícula es estática, no debe recalcularse en cada render. Y **acotada** — con espaciado de ~16 px y un panel de ~120 px de ancho, mantén el total de puntos en el orden de unos cientos, no miles.
- **Decorativa**: `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`. No aporta información.
- **Solo en pantallas anchas.** En teléfono no hay laterales que decorar; ahí el beneficio es solo el respiro de márgenes.

- [ ] **Step 4: Ancho máximo en `Screen`**

Añadir una prop `framed?: boolean` (por defecto `false`, para no alterar las pantallas existentes sin querer). Cuando es `true`: contenido con `maxWidth` de ~520 px, centrado horizontalmente, y `<SideTexture>` a cada lado cuando el viewport supera el punto de quiebre (~900 px). Usa `useWindowDimensions` para reaccionar al redimensionado.

Activarla en `profile-setup.tsx`. **No la actives en las demás pantallas todavía** — es cambio visual de pantallas ya aprobadas y no corresponde a esta fase; anótalo en `docs/backlog.md` como candidato para cuando se retomen.

- [ ] **Step 5: Verificar visualmente**

Con el preview corriendo, mirar el alta en ventana ancha y en ventana angosta. La ventana angosta no debe mostrar textura ni perder espacio.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: ancho maximo y textura lateral en el alta"
```

---

## Cierre del bloque 2b

- [ ] **Verificación final, con la salida mostrada**

```bash
npm run lint && npm run typecheck && npm test
set -a; . ./.env; set +a; npm run test:db
git status --short
git diff tsconfig.json
```

- [ ] **Dejar el preview levantado y reportar**

El usuario tiene que recorrer el alta otra vez: es la única forma de confirmar que el bug murió y que el lienzo se ve como debe.

**No cierres D.3.** Falta el bloque 3 (KYC en dos pantallas). No toques `docs/ESTADO.md` ni `FASE ACTUAL`.

En el reporte: si tuviste que agregar un token a `lib/theme.ts` para la textura, y cuántos `View`s termina renderizando cada panel — si son miles, es señal de que el enfoque necesita otra idea y prefiero saberlo.
