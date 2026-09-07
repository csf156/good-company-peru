# Fase D.1 — Design system unificado bajo Lovable

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que toda pantalla implementada se rija por un único sistema de tokens derivado del prototipo Lovable, con las fuentes cargando de verdad, y que el CI impida la deriva a futuro.

**Architecture:** Un solo módulo de tokens (`lib/theme.ts`) dark-only, cuyos valores son la conversión HSL→hex del `:root` de `../good-company-peru/src/styles.css`. Los tests rederivan esos valores desde el HSL original en vez de copiarlos, de modo que editar un hex a mano rompe la suite. Las pantallas consumen tokens y helpers tipográficos; un test de guardia falla si aparece un color literal en `app/` o `components/`.

**Tech Stack:** React Native 0.86 · Expo SDK 57 · expo-router · TypeScript estricto · Jest + @testing-library/react-native 14 · expo-font + @expo-google-fonts

**Spec:** [`docs/superpowers/specs/2026-07-24-design-system-lovable-design.md`](../specs/2026-07-24-design-system-lovable-design.md)

---

## Global Constraints

Estas reglas aplican a **todas** las tareas. Los requisitos de cada tarea las incluyen implícitamente.

- **Dark-only.** No existe paleta clara. Nada de `colors.light` / `colors.dark`.
- **Ningún color literal fuera de `lib/theme.ts`.** Ni `#rrggbb`, ni `rgb(`, ni `rgba(`, ni `hsl(`. La Tarea 12 lo vuelve obligatorio por CI.
- **Los valores de color no se escriben a mano.** Se obtienen de la conversión HSL→hex del `:root` de Lovable. Ver tabla en Tarea 1.
- **Ninguna migración cambia comportamiento.** Los tests existentes de cada pantalla deben pasar **sin modificarse**, salvo aserciones que dependan literalmente de un color o de una familia tipográfica. Si un test de comportamiento necesita cambiar, la tarea se pasó de alcance: detente y reporta.
- **Idioma:** UI en español de Perú, informal "tú". Código y commits en inglés técnico.
- **Commits:** Conventional Commits, uno por tarea como mínimo. No hacer push ni abrir PR.
- **Cierre de cada tarea:** `npm run lint` + `npm run typecheck` + `npm test` en verde, con la salida mostrada como evidencia. Sin excepciones.
- **Fuente de verdad de Lovable:** `../good-company-peru/` (repo hermano, presente localmente). `ds-bundle/` de este repo **NO** es fuente de verdad — es un bundle del design system viejo teal/coral.

### Mapeo de renombres (usado por las Tareas 5–11)

Las 6 pantallas que ya usan la paleta Martini consumen `ayni.*` y `ayniTypography.*`. Tras la Tarea 1 y la Tarea 2 esos exports dejan de existir. El renombre es mecánico:

| Antes | Después |
|---|---|
| `import { ayni } from '@/lib/theme'` | `import { colors } from '@/lib/theme'` |
| `ayni.background` | `colors.background` |
| `ayni.<cualquier-otra>` | `colors.<misma>` (los nombres de propiedad no cambian) |
| `ayniTypography.fontFamily.serifItalic` | `textStyles.display` (helper, no solo familia) |
| `ayniTypography.fontFamily.mono` | `textStyles.label` |
| `ayniTypography.fontFamily.sans` | `textStyles.body` |

Las 7 pantallas en paleta vieja consumen `colors.light.*` y `typography.*`:

| Antes | Después |
|---|---|
| `colors.light.bg` | `colors.background` |
| `colors.light.surface` | `colors.surface` |
| `colors.light.text` | `colors.foreground` |
| `colors.light.textMuted` | `colors.mutedForeground` |
| `colors.light.border` | `colors.border` (o `colors.borderStrong` si el borde es la única señal de un control — inputs) |
| `colors.light.primary` | `colors.primary` |
| `colors.light.primaryDark` | `colors.primaryForeground` sobre fondo primary, o `colors.accent` si era un tono más oscuro decorativo |
| `colors.light.primaryLight` | `colors.surface2` |
| `colors.light.danger` | `colors.destructiveText` (texto de error) o `colors.destructive` (relleno/icono/borde) |
| `typography.fontFamily.heading` | `textStyles.display` |
| `typography.fontFamily.body` | `textStyles.body` |
| `typography.fontSize.xl` | `fontSize.heading` |
| `typography.fontSize.base` | `fontSize.bodyLg` |
| `typography.fontWeight.bold` | `'700'` |
| `typography.fontWeight.semibold` | `'600'` |

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `lib/theme.ts` | Único origen de color, espaciado, radio, tamaños y helpers de texto | 1, 2 |
| `tests/theme.test.ts` | Rederiva los tokens desde HSL; falla si alguien edita un hex | 1 |
| `tests/theme-contrast.test.ts` | Congela los ratios AA de §1.3 del spec | 1 |
| `tests/design-system-guard.test.ts` | Falla si hay color literal en `app/` o `components/` | 12 |
| `app/_layout.tsx` | Gate de carga de fuentes (además del guard de rutas ya existente) | 2 |
| `components/Button.tsx` | Botón con la voz tipográfica nueva | 3 |
| `components/Screen.tsx` | Andamiaje mobile-first; `background` pasa a opcional | 4 |
| `app/(auth)/*.tsx`, `app/profile*.tsx` | 7 pantallas migradas | 5–11 |
| `docs/2026-07-03-design-system.md` | Doc reescrito como fuente de verdad | 13 |
| `eslint.config.js` | Globals de jest para `tests/**/*.js` | 0 |

---

## Task 0: Sanear el árbol de trabajo

El repo tiene trabajo sin commitear de dos frentes previos (cierre de fase 4.5 en `ESTADO.md`, e higiene mobile-first: `components/Screen.tsx`, `tests/jest.setup.js`, `app/store.tsx`, `app/wallet.tsx`, `lib/theme.ts`). **Los tests pasan (270/270) pero lint y typecheck fallan.** Sin arreglar esto, el criterio de cierre de toda tarea posterior falla por causas ajenas a esta fase.

**Files:**
- Modify: `eslint.config.js`
- Modify: `lib/theme.ts` (solo `tabularNums`)

**Interfaces:**
- Produces: árbol limpio, `lint`/`typecheck`/`test` en verde. Todas las tareas siguientes lo asumen.

- [ ] **Step 1: Reproducir los dos fallos**

```bash
npm run lint; npm run typecheck
```

Esperado, exactamente dos fallos:
```
tests\jest.setup.js
  5:1  error  'jest' is not defined  no-undef
```
```
Types of property 'fontVariant' are incompatible.
  The type 'readonly ["tabular-nums"]' is 'readonly' and cannot be assigned to the mutable type 'FontVariant[]'.
```

- [ ] **Step 2: Dar a eslint los globals de jest para los `.js` de tests**

En `eslint.config.js`, agregar este bloque **antes** del bloque `{ ignores: [...] }`:

```js
  {
    // tests/jest.setup.js es CommonJS plano (no TS), así que `no-undef` sí
    // aplica y no conoce los globals que jest inyecta.
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { jest: 'readonly' },
    },
  },
```

- [ ] **Step 3: Tipar `tabularNums` en vez de congelarlo con `as const`**

En `lib/theme.ts`, reemplazar:

```ts
// Mobile-first: montos y cronómetro con cifras de ancho fijo (no "bailan").
export const tabularNums = { fontVariant: ['tabular-nums'] } as const;
```

por:

```ts
// Mobile-first: montos y cronómetro con cifras de ancho fijo (no "bailan").
// Tipado explícito en vez de `as const`: `as const` produce
// `readonly ['tabular-nums']`, que no es asignable al `FontVariant[]` mutable
// que espera TextStyle.
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };
```

Y agregar al inicio del archivo:

```ts
import type { TextStyle } from 'react-native';
```

- [ ] **Step 4: Verificar verde**

```bash
npm run lint; npm run typecheck; npm test
```

Esperado: lint sin errores, typecheck sin salida, `Tests: 270 passed, 270 total`.

- [ ] **Step 5: Commit**

Commitear el trabajo pendiente en dos commits separados, porque son dos frentes distintos.

> ⚠️ **Antes del primer commit:** el `docs/ESTADO.md` sin commitear ya trae la entrada de cierre de la fase 4.5 y la marca ✅ en la tabla. Esa entrada la escribió una sesión previa, **no** esta. Según `CLAUDE.md`, una fase se da por concluida solo cuando el usuario lo dice explícitamente. **Confirmar con el usuario que 4.5 está concluida antes de commitear ese archivo.** Si no lo confirma, dejar `ESTADO.md` sin commitear y seguir con el segundo commit solamente.

```bash
git add docs/ESTADO.md
git commit -m "docs: cierre fase 4.5"
```

```bash
git add eslint.config.js lib/theme.ts components/Screen.tsx tests/jest.setup.js tests/components/Screen.test.tsx tests/app/store.test.tsx tests/app/wallet.test.tsx app/store.tsx app/wallet.tsx jest.config.js
git commit -m "fix: lint y typecheck verdes tras la higiene mobile-first"
```

---

## Task 1: Reescribir la paleta

**Files:**
- Modify: `lib/theme.ts`
- Test: `tests/theme.test.ts` (reescribir por completo)
- Test: `tests/theme-contrast.test.ts` (crear)

**Interfaces:**
- Produces: `colors`, `levels`, `radius`, `spacing`, `fontSize` desde `@/lib/theme`. Consumido por todas las tareas siguientes.
- Deja de existir: `colors.light`, `colors.dark`, `levelColors`, `ayni`.

- [ ] **Step 1: Escribir el test que falla**

Reemplazar **todo** el contenido de `tests/theme.test.ts` por:

```ts
import { colors, levels, radius, spacing } from '@/lib/theme';

/**
 * Convierte HSL (los valores tal como aparecen en el `:root` de
 * `../good-company-peru/src/styles.css`) a hex.
 *
 * El test deriva los valores esperados en vez de copiarlos como literales: si
 * alguien edita un hex a mano en theme.ts, este test falla. Ese fue exactamente
 * el fallo que originó esta fase — los tokens previos se habían aproximado a
 * ojo y ninguno coincidía con Lovable.
 */
function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lum = l / 100;
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1 ? [c, x, 0]
    : hp < 2 ? [x, c, 0]
    : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c]
    : hp < 5 ? [x, 0, c]
    : [c, 0, x];
  const m = lum - c / 2;
  return (
    '#' +
    [r, g, b]
      .map((v) =>
        Math.round((v + m) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}

describe('paleta Martini', () => {
  it('deriva cada token del :root de Lovable', () => {
    expect(colors.background).toBe(hslToHex(24, 20, 6));
    expect(colors.foreground).toBe(hslToHex(30, 10, 96));
    expect(colors.surface).toBe(hslToHex(24, 15, 10));
    expect(colors.surface2).toBe(hslToHex(24, 15, 14));
    expect(colors.card).toBe(hslToHex(24, 15, 10));
    expect(colors.popover).toBe(hslToHex(24, 15, 12));
    expect(colors.primary).toBe(hslToHex(38, 85, 55));
    expect(colors.primaryForeground).toBe(hslToHex(24, 20, 6));
    expect(colors.primaryGlow).toBe(hslToHex(38, 90, 65));
    expect(colors.secondary).toBe(hslToHex(24, 15, 14));
    expect(colors.muted).toBe(hslToHex(24, 10, 20));
    expect(colors.mutedForeground).toBe(hslToHex(24, 10, 60));
    expect(colors.accent).toBe(hslToHex(38, 60, 40));
    expect(colors.accentForeground).toBe(hslToHex(30, 10, 96));
    expect(colors.destructive).toBe(hslToHex(0, 70, 55));
    expect(colors.destructiveForeground).toBe(hslToHex(30, 10, 96));
    expect(colors.success).toBe(hslToHex(150, 60, 45));
    expect(colors.border).toBe(hslToHex(24, 10, 20));
    expect(colors.input).toBe(hslToHex(24, 10, 20));
    expect(colors.ring).toBe(hslToHex(38, 85, 55));
  });

  it('deriva las dos variantes accesibles que se apartan de Lovable', () => {
    // Ver docs/.../2026-07-24-design-system-lovable-design.md §1.3: los valores
    // originales de Lovable no alcanzan el contraste que el design system exige.
    expect(colors.destructiveText).toBe(hslToHex(0, 70, 60));
    expect(colors.borderStrong).toBe(hslToHex(24, 10, 38));
  });

  it('deriva los colores de nivel de la escala élite', () => {
    expect(levels.bronce).toBe(hslToHex(25, 70, 55));
    expect(levels.plata).toBe(hslToHex(210, 15, 75));
    expect(levels.oro).toBe(hslToHex(45, 90, 60));
    expect(levels.diamante).toBe(hslToHex(200, 100, 75));
    // Élite reusa el primary, igual que LEVEL_META en Lovable.
    expect(levels.elite).toBe(colors.primary);
  });

  it('no expone la paleta clara/oscura vieja', () => {
    expect(colors).not.toHaveProperty('light');
    expect(colors).not.toHaveProperty('dark');
  });

  it('deriva la escala de radio del --radius de Lovable', () => {
    const base = 0.875 * 16; // --radius: 0.875rem
    expect(radius.lg).toBe(base);
    expect(radius.sm).toBe(base - 4);
    expect(radius.md).toBe(base - 2);
    expect(radius.xl).toBe(base + 4);
    expect(radius.xxl).toBe(base + 8);
    expect(radius.xxxl).toBe(base + 12);
  });

  it('define la escala de espaciado en grid de 4px', () => {
    expect(Object.values(spacing)).toEqual([4, 8, 12, 16, 20, 24]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx jest tests/theme.test.ts
```

Esperado: FAIL. `levels`, `radius` y `spacing` no existen todavía y los valores de color no coinciden.

- [ ] **Step 3: Reescribir `lib/theme.ts`**

Reemplazar **todo** el contenido por:

```ts
import type { TextStyle } from 'react-native';

/**
 * Paleta Martini — dark-only.
 *
 * Cada valor es la conversión HSL→hex del `:root` de `src/styles.css` del
 * prototipo Lovable (`csf156/good-company-peru`), que es la fuente de verdad
 * visual del producto. Los valores NO se editan a mano: `tests/theme.test.ts`
 * los rederiva desde el HSL original y falla si alguien los toca.
 *
 * Dos tokens se apartan deliberadamente de Lovable porque sus valores no
 * alcanzan el contraste que el design system exige — ver
 * docs/2026-07-03-design-system.md §2: `destructiveText` y `borderStrong`.
 */
export const colors = {
  background: '#120F0C',
  foreground: '#F6F5F4',
  surface: '#1D1916',
  surface2: '#29231E',
  card: '#1D1916',
  popover: '#231E1A',
  primary: '#EEA62B',
  primaryForeground: '#120F0C',
  primaryGlow: '#F6BB55',
  secondary: '#29231E',
  muted: '#38322E',
  mutedForeground: '#A3978F',
  accent: '#A37629',
  accentForeground: '#F6F5F4',
  /** Relleno, borde o icono destructivo. Para TEXTO usar `destructiveText`. */
  destructive: '#DD3C3C',
  destructiveForeground: '#F6F5F4',
  /** Texto de error. `destructive` no alcanza AA sobre fondo oscuro. */
  destructiveText: '#E05252',
  success: '#2EB873',
  /** Divisor decorativo entre superficies. */
  border: '#38322E',
  /** Borde que ES la única señal de un control (inputs). Cumple 3:1. */
  borderStrong: '#6B5F57',
  input: '#38322E',
  ring: '#EEA62B',
  /** Velo de modales y overlays sobre contenido. */
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

/**
 * Escala élite de niveles (bronce/plata/oro/diamante/élite).
 * Reemplaza la escala vieja que incluía "platino".
 * Élite reusa el primary, igual que `LEVEL_META` en Lovable.
 */
export const levels = {
  bronce: '#DD7F3C',
  plata: '#B6BFC9',
  oro: '#F5C73D',
  diamante: '#80D4FF',
  elite: '#EEA62B',
} as const;

/** Derivado de `--radius: 0.875rem` (=14px) y sus `calc()` en Lovable. */
export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
  xxl: 22,
  xxxl: 26,
  full: 9999,
} as const;

/** Grid de 4px. Los pasos que Lovable realmente usa. */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
} as const;

/** Incluye los tamaños chicos que Lovable usa para labels mono. */
export const fontSize = {
  micro: 9,
  tiny: 10,
  caption: 11,
  small: 12,
  body: 14,
  bodyLg: 16,
  title: 18,
  titleLg: 20,
  heading: 24,
  display: 30,
  displayLg: 36,
} as const;

// Mobile-first: área táctil mínima recomendada (≥44dp, WCAG 2.5.5 / HIG).
export const touchTarget = {
  minHeight: 44,
  minWidth: 44,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

// Mobile-first: montos y cronómetro con cifras de ancho fijo (no "bailan").
// Tipado explícito en vez de `as const`: `as const` produce
// `readonly ['tabular-nums']`, que no es asignable al `FontVariant[]` mutable
// que espera TextStyle.
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };
```

- [ ] **Step 4: Correr el test**

```bash
npx jest tests/theme.test.ts
```

Esperado: PASS, 6 tests.

- [ ] **Step 5: Escribir el test de contraste**

Crear `tests/theme-contrast.test.ts`:

```ts
import { colors } from '@/lib/theme';

/** Luminancia relativa según WCAG 2.x. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Congela las decisiones de accesibilidad del design system. Si alguien
 * "acerca" un token a Lovable y con eso rompe el contraste, esto falla.
 */
describe('contraste de la paleta', () => {
  it.each([
    ['foreground sobre background', colors.foreground, colors.background, 4.5],
    ['mutedForeground sobre background', colors.mutedForeground, colors.background, 4.5],
    ['mutedForeground sobre surface', colors.mutedForeground, colors.surface, 4.5],
    ['primary sobre background', colors.primary, colors.background, 4.5],
    ['primaryForeground sobre primary', colors.primaryForeground, colors.primary, 4.5],
    ['success sobre background', colors.success, colors.background, 4.5],
    ['destructiveText sobre background', colors.destructiveText, colors.background, 4.5],
    ['destructiveText sobre surface', colors.destructiveText, colors.surface, 4.5],
    ['borderStrong sobre background', colors.borderStrong, colors.background, 3],
  ])('%s cumple el mínimo', (_label, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it('destructive crudo NO alcanza AA para texto — por eso existe destructiveText', () => {
    expect(contrast(colors.destructive, colors.background)).toBeLessThan(4.5);
  });
});
```

- [ ] **Step 6: Correr el test de contraste**

```bash
npx jest tests/theme-contrast.test.ts
```

Esperado: PASS, 10 tests.

- [ ] **Step 7: Verificar el alcance del daño**

En este punto todo lo que importaba `colors.light`, `typography`, `levelColors` o `ayni` está roto. Es esperado — las tareas 2–11 lo reparan.

```bash
npm run typecheck 2>&1 | grep -c "error"
```

Anotar el número en el commit. Sirve de referencia para confirmar que baja a 0 al terminar la Tarea 11.

- [ ] **Step 8: Commit**

```bash
git add lib/theme.ts tests/theme.test.ts tests/theme-contrast.test.ts
git commit -m "feat: paleta unica derivada de Lovable, dark-only"
```

---

## Task 2: Cargar las fuentes de verdad

Hoy `expo-font` está en los plugins pero **no existe `useFonts` en todo el repo**, así que ninguna fuente carga y todo cae al tipo del sistema.

**Files:**
- Modify: `package.json` (dependencias)
- Modify: `lib/theme.ts` (agregar `fontFamily` y `textStyles`)
- Modify: `app/_layout.tsx`
- Test: `tests/app/_layout.test.tsx` (ampliar el existente)

**Interfaces:**
- Consumes: `colors` de la Tarea 1.
- Produces: `fontFamily`, `textStyles` desde `@/lib/theme`. `textStyles.display` / `.label` / `.body` son objetos `TextStyle` listos para poner en un array de estilos.

- [ ] **Step 1: Instalar las familias que faltan y quitar Sora**

Sora no aparece en Lovable; venía de la propuesta pre-Lovable.

```bash
npm install @expo-google-fonts/playfair-display @expo-google-fonts/jetbrains-mono --legacy-peer-deps
npm uninstall @expo-google-fonts/sora --legacy-peer-deps
```

- [ ] **Step 2: Escribir el test que falla**

Agregar a `tests/app/_layout.test.tsx`, dentro del `describe` existente:

```ts
  it('no renderiza el arbol hasta que las fuentes resuelven', async () => {
    mockedUseAuthSession.mockReturnValue({ session: null, loading: false });
    mockedUseFonts.mockReturnValue([false, null]);

    await render(<RootLayout />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renderiza igual si la carga de fuentes falla', async () => {
    mockedUseAuthSession.mockReturnValue({ session: null, loading: false });
    mockedUseFonts.mockReturnValue([false, new Error('font load failed')]);

    await render(<RootLayout />);

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });
```

Y en la cabecera del mismo archivo, agregar el mock y ajustar el default:

```ts
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
```

```ts
import { useFonts } from 'expo-font';
const mockedUseFonts = useFonts as jest.Mock;
```

En el `beforeEach` existente, agregar:

```ts
  mockedUseFonts.mockReturnValue([true, null]);
```

- [ ] **Step 3: Correr el test para verificar que falla**

```bash
npx jest tests/app/_layout.test.tsx
```

Esperado: FAIL — `_layout.tsx` todavía no llama a `useFonts`.

- [ ] **Step 4: Agregar los helpers tipográficos a `lib/theme.ts`**

Agregar al final del archivo:

```ts
/**
 * Familias tipográficas de Lovable. Los nombres son las claves que
 * `useFonts` registra en `app/_layout.tsx` — deben coincidir exactamente.
 */
export const fontFamily = {
  display: 'PlayfairDisplay-Italic',
  label: 'JetBrainsMono-Regular',
  body: 'Inter-Regular',
} as const;

/**
 * Los tres roles tipográficos del producto, derivados de los patrones reales
 * de Lovable (font-serif+italic para títulos; font-mono+uppercase+
 * tracking-widest para labels; Inter para el resto).
 *
 * Se exponen como estilos completos, no solo como familias, para que ninguna
 * pantalla vuelva a componer fontFamily + letterSpacing + textTransform a mano
 * y se desvíe en el camino.
 */
export const textStyles = {
  display: {
    fontFamily: fontFamily.display,
    letterSpacing: -0.5,
  },
  label: {
    fontFamily: fontFamily.label,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  body: {
    fontFamily: fontFamily.body,
  },
} satisfies Record<string, TextStyle>;
```

- [ ] **Step 5: Cablear `useFonts` en `app/_layout.tsx`**

Agregar los imports:

```ts
import { useFonts } from 'expo-font';
import { PlayfairDisplay_400Regular_Italic, PlayfairDisplay_600SemiBold_Italic } from '@expo-google-fonts/playfair-display';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
```

Dentro de `RootLayout`, como primera línea del cuerpo:

```ts
  // Solo los pesos que el design system usa — no las familias completas: buena
  // parte del publico objetivo esta en Android de gama media.
  const [fontsLoaded, fontError] = useFonts({
    'PlayfairDisplay-Italic': PlayfairDisplay_400Regular_Italic,
    'PlayfairDisplay-Italic-SemiBold': PlayfairDisplay_600SemiBold_Italic,
    'JetBrainsMono-Regular': JetBrainsMono_400Regular,
    'JetBrainsMono-Medium': JetBrainsMono_500Medium,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });
```

Modificar el `useEffect` del redirect para que también espere a las fuentes. Cambiar su primera línea de:

```ts
    if (sessionLoading || profileLoading) return;
```

a:

```ts
    // `fontError` cuenta como "resuelto": si una fuente no carga, la app sigue
    // con el tipo del sistema en vez de quedarse en blanco para siempre.
    if (sessionLoading || profileLoading || (!fontsLoaded && !fontError)) return;
```

y agregar `fontsLoaded` y `fontError` al array de dependencias del `useEffect`.

Finalmente, cambiar el `return` para no montar el árbol antes de tiempo. **Nota:** `_layout.tsx` ya envuelve `<Stack>` en `<SafeAreaProvider>` (cambio externo posterior a este plan) — mantener ese envoltorio, solo agregar el guard antes:

```ts
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
```

- [ ] **Step 6: Correr los tests**

```bash
npx jest tests/app/_layout.test.tsx
```

Esperado: PASS, 3 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/theme.ts app/_layout.tsx tests/app/_layout.test.tsx
git commit -m "feat: cargar Playfair Display, JetBrains Mono e Inter"
```

---

## Task 3: Reescribir `Button`

**Files:**
- Modify: `components/Button.tsx`
- Test: `tests/components/Button.test.tsx`

**Interfaces:**
- Consumes: `colors`, `radius`, `spacing`, `fontSize`, `textStyles`, `touchTarget`.
- Produces: `Button({ label, variant?: 'primary' | 'secondary', disabled?, onPress? })`. **Ojo: la variante `accent` se renombra a `secondary`** — en la paleta nueva `accent` es un dorado oscuro que no funciona como CTA. Las pantallas que usaban `variant="accent"` pasan a `variant="secondary"`.

- [ ] **Step 1: Actualizar el test**

En `tests/components/Button.test.tsx`, reemplazar el último test (`'uses AA-compliant dark text on the accent variant'`) por:

```ts
  it('usa texto oscuro sobre el primary, que cumple AA', async () => {
    await render(<Button label="Invitar" onPress={() => {}} />);
    const label = screen.getByText('Invitar');
    const flatStyle = StyleSheet.flatten(label.props.style);
    expect(flatStyle.color).toBe(colors.primaryForeground);
  });

  it('la variante secondary es contorno, no relleno', async () => {
    await render(<Button label="Invitar" variant="secondary" onPress={() => {}} />);
    const label = screen.getByText('Invitar');
    expect(StyleSheet.flatten(label.props.style).color).toBe(colors.primary);
  });

  it('rotula en mayusculas con la tipografia de label', async () => {
    await render(<Button label="Invitar" onPress={() => {}} />);
    const flatStyle = StyleSheet.flatten(screen.getByText('Invitar').props.style);
    expect(flatStyle.fontFamily).toBe(fontFamily.label);
    expect(flatStyle.textTransform).toBe('uppercase');
  });
```

Y ajustar el import de la cabecera:

```ts
import { colors, fontFamily } from '@/lib/theme';
```

- [ ] **Step 2: Correr para verificar que falla**

```bash
npx jest tests/components/Button.test.tsx
```

Esperado: FAIL — `colors.primaryForeground` no existe en el Button viejo y no hay variante `secondary`.

- [ ] **Step 3: Reescribir `components/Button.tsx`**

Reemplazar **todo** el contenido por:

```tsx
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, fontSize, textStyles, touchTarget } from '@/lib/theme';

type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  onPress?: () => void;
};

export function Button({ label, variant = 'primary', disabled = false, onPress }: ButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && (isPrimary ? styles.primaryPressed : styles.secondaryPressed),
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, isPrimary ? styles.labelOnPrimary : styles.labelOnSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    ...touchTarget,
    paddingHorizontal: spacing[5],
    borderRadius: radius.lg,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryGlow,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryPressed: {
    backgroundColor: colors.surface2,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...textStyles.label,
    fontSize: fontSize.caption,
  },
  labelOnPrimary: {
    color: colors.primaryForeground,
  },
  labelOnSecondary: {
    color: colors.primary,
  },
});
```

- [ ] **Step 4: Correr los tests**

```bash
npx jest tests/components/Button.test.tsx
```

Esperado: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add components/Button.tsx tests/components/Button.test.tsx
git commit -m "feat: Button con la voz tipografica de Lovable"
```

---

## Task 4: `Screen` con fondo por defecto

Su prop `background` es obligatoria y sin default precisamente porque convivían dos paletas. Con dark-only eso ya no aplica.

**Files:**
- Modify: `components/Screen.tsx`
- Test: `tests/components/Screen.test.tsx`

**Interfaces:**
- Produces: `Screen({ background?, ... })` — `background` pasa a opcional, con default `colors.background`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `tests/components/Screen.test.tsx`:

```tsx
  it('usa el fondo de la paleta por defecto', async () => {
    await render(
      <Screen testID="pantalla">
        <Text>hola</Text>
      </Screen>,
    );
    const root = screen.getByTestId('pantalla');
    expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe(colors.background);
  });
```

Agregar los imports que falten en la cabecera (`StyleSheet` de `react-native`, `colors` de `@/lib/theme`).

- [ ] **Step 2: Correr para verificar que falla**

```bash
npx jest tests/components/Screen.test.tsx
```

Esperado: FAIL de TypeScript — falta la prop obligatoria `background`.

- [ ] **Step 3: Hacer `background` opcional**

En `components/Screen.tsx`, reemplazar el comentario y la declaración de la prop:

```ts
  /**
   * Color de fondo de la pantalla. Por defecto el de la paleta; se pasa
   * explícito solo cuando una pantalla necesita otra superficie.
   */
  background?: string;
```

En la firma de la función, dar el default:

```ts
  background = colors.background,
```

Y agregar el import:

```ts
import { colors } from '@/lib/theme';
```

- [ ] **Step 4: Correr los tests**

```bash
npx jest tests/components/Screen.test.tsx
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/Screen.tsx tests/components/Screen.test.tsx
git commit -m "feat: Screen con fondo de paleta por defecto"
```

---

## Tasks 5–11: Migrar las pantallas

Cada tarea migra **una** pantalla. Todas siguen el mismo procedimiento; lo que cambia es el archivo y su test.

> **Para quien despacha subagentes:** cada una de estas 7 tareas requiere **tres** piezas de contexto, no solo su fila de la tabla. Pasarle al subagente: (1) la sección **Global Constraints** completa, incluido el mapeo de renombres; (2) el **procedimiento común** de abajo; (3) su fila de la tabla. Sin las tres, el subagente inventará nombres de token y la migración quedará inconsistente entre pantallas.

**Procedimiento común (aplicar en cada una de las 7 tareas):**

- [ ] **Step 1: Leer la pantalla y su test completos** antes de tocar nada.
- [ ] **Step 2: Correr su test y confirmar el estado de partida**

```bash
npx jest <ruta-del-test>
```

- [ ] **Step 3: Aplicar el mapeo de renombres** de la sección Global Constraints. Es determinista: cada `colors.light.X` / `ayni.X` / `typography.X` tiene un destino exacto.
- [ ] **Step 4: Aplicar la voz tipográfica.** En las pantallas de auth (Tareas 5–9), que se derivan de las reglas porque Lovable no las tiene:
  - El título de pantalla pasa a `textStyles.display` con `fontSize.display`.
  - Se agrega un **eyebrow** encima del título: `textStyles.label` + `fontSize.caption` + `color: colors.primary`.
  - Los labels de campo y el texto de botones/tabs usan `textStyles.label` + `fontSize.tiny`.
  - El cuerpo y los inputs usan `textStyles.body`.
  - Los inputs usan `borderColor: colors.borderStrong` (el borde es su única señal) y `borderRadius: radius.lg`.
  - Los contenedores usan `spacing[*]`, nunca números sueltos.
- [ ] **Step 5: Sustituir el `View` raíz por `Screen`** donde la pantalla todavía use un `View` con `flex: 1` y `backgroundColor` propios. `Screen` ya aporta área segura, manejo de teclado y scroll.
- [ ] **Step 6: Correr su test.** Debe pasar **sin haberlo modificado**, salvo aserciones de color o de familia tipográfica. Si un test de comportamiento exige cambios, **detente y reporta** — es señal de que la migración se pasó de alcance.
- [ ] **Step 7: `npm run lint && npm run typecheck`** para la pantalla tocada.
- [ ] **Step 8: Commit** con mensaje `feat: migrar <pantalla> al design system`.

| Tarea | Pantalla | Test | Estrategia |
|---|---|---|---|
| **5** | `app/(auth)/sign-in.tsx` | `tests/app/sign-in.test.tsx` | Derivar. Eyebrow "Bienvenido". **No** tocar la pestaña Celular: eso es D.2. |
| **6** | `app/(auth)/verify-otp.tsx` | `tests/app/verify-otp.test.tsx` | Derivar. El campo de código usa `tabularNums` — son cifras. |
| **7** | `app/(auth)/select-role.tsx` | `tests/app/select-role.test.tsx` | Derivar. El segundo botón pasa de `variant="accent"` a `variant="secondary"`. |
| **8** | `app/(auth)/profile-setup.tsx` | `tests/app/profile-setup.test.tsx` | Derivar. Es la pantalla con más campos: revisar que **todos** los inputs queden con `borderStrong`. |
| **9** | `app/(auth)/kyc.tsx` | `tests/app/kyc.test.tsx` | Derivar. Los estados de KYC van con **icono + texto**, nunca solo color. |
| **10** | `app/profile.tsx` | `tests/app/profile-own.test.tsx` | **Portar** de `../good-company-peru/src/routes/profile.tsx`. Solo lo que la pantalla ya hace: no agregar secciones que Lovable tenga y esta no. |
| **11** | `app/profile/[id].tsx` | `tests/app/profile-public.test.tsx` | **Portar** de `../good-company-peru/src/routes/profile.$id.tsx`. Mismo recorte. |

**Al terminar la Tarea 11:**

```bash
npm run lint; npm run typecheck; npm test
```

Esperado: los tres en verde, y el conteo de errores de typecheck de vuelta en 0 (comparar con lo anotado en la Tarea 1 Step 7).

---

## Task 12: Guardia anti-color-literal

**Files:**
- Test: `tests/design-system-guard.test.ts` (crear)
- Modify: `app/chats/[id].tsx:442`

**Interfaces:**
- Consumes: `colors.overlay` de la Tarea 1.

- [ ] **Step 1: Escribir el test**

Crear `tests/design-system-guard.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOTS = ['app', 'components'];
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}

/**
 * El design system solo se sostiene si el CI lo verifica. Esta fase existió
 * porque la deriva se acumuló en silencio durante cuatro sub-proyectos: el doc
 * decía una cosa y las pantallas hacían otra, y nada lo detectaba.
 *
 * Si necesitas un color que no está en `lib/theme.ts`, el arreglo es agregar el
 * token, no la excepción.
 */
describe('guardia del design system', () => {
  it('ninguna pantalla ni componente hardcodea un color', () => {
    const offenders = ROOTS.flatMap(sourceFiles).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ file, line: i + 1, text: line.trim() }))
        .filter(({ text }) => COLOR_LITERAL.test(text)),
    );

    expect(offenders.map((o) => `${o.file}:${o.line}  ${o.text}`)).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

```bash
npx jest tests/design-system-guard.test.ts
```

Esperado: FAIL, con exactamente un infractor:
```
app/chats/[id].tsx:442  backgroundColor: 'rgba(0,0,0,0.6)',
```

- [ ] **Step 3: Reemplazar el único color literal**

En `app/chats/[id].tsx` línea 442, cambiar:

```ts
    backgroundColor: 'rgba(0,0,0,0.6)',
```

por:

```ts
    backgroundColor: colors.overlay,
```

Confirmar que `colors` ya esté importado en ese archivo; si no, agregarlo.

- [ ] **Step 4: Correr el guard y la suite completa**

```bash
npx jest tests/design-system-guard.test.ts && npm test
```

Esperado: guard PASS, suite completa verde.

- [ ] **Step 5: Commit**

```bash
git add tests/design-system-guard.test.ts "app/chats/[id].tsx"
git commit -m "test: CI falla si una pantalla hardcodea un color"
```

---

## Task 13: Reescribir el doc de design system

**Files:**
- Modify: `docs/2026-07-03-design-system.md`
- Modify: `docs/backlog.md`

- [ ] **Step 1: Reemplazar §2 (Paleta)**

Borrar por completo la paleta teal/coral, los bloques "Primario — Teal profundo", "Acento cálido — Coral/terracota", "Neutros" y "Modo oscuro" (esta última deja de tener sentido en una app dark-only). Poner en su lugar la tabla de tokens de la Tarea 1, con tres subsecciones:

- **Tokens de color** — la tabla token / HSL de Lovable / hex.
- **Niveles** — la escala élite con sus umbrales.
- **Dos correcciones de accesibilidad** — `destructiveText` y `borderStrong`, con sus ratios medidos y el porqué. Dejar constancia de que Martini se aparta de Lovable a propósito en esos dos puntos.

Conservar la "Regla de oro" del rojo (solo SOS/error/no-show), que sigue vigente.

- [ ] **Step 2: Reemplazar §3 (Tipografía)**

Borrar la tabla Sora/Nunito/Inter/Manrope. Poner los tres roles (`display` / `label` / `body`) con su familia, su tratamiento y su uso, más la nota de que solo se cargan los pesos enumerados por el peso de bundle en Android de gama media.

- [ ] **Step 3: Agregar la sección de escalas**

Nueva subsección con las tablas de radio, espaciado y tamaños de texto de la Tarea 1. Hoy el doc no documenta ninguna, y por eso cada pantalla inventaba sus números.

- [ ] **Step 4: Documentar la conversión**

Agregar una nota corta explicando que los hex se obtienen convirtiendo el HSL del `:root` de Lovable, que `tests/theme.test.ts` lo rederiva, y que por lo tanto **los valores no se editan a mano**. Incluir el origen exacto: `../good-company-peru/src/styles.css`.

- [ ] **Step 5: Actualizar §6 (checklist)**

Reemplazar el punto 4 ("¿Soporta modo oscuro?") por "¿Todos los colores salen de `lib/theme.ts`, sin literales? (lo verifica `tests/design-system-guard.test.ts`)".

- [ ] **Step 6: Quitar la advertencia del encabezado**

Borrar el bloque `> ⚠️ **Fuente de verdad visual = ...**` del inicio: existía porque el cuerpo del doc era incorrecto. Ya no lo es. Dejar una línea simple indicando que la fuente de verdad es Lovable y dónde vive.

- [ ] **Step 7: Cerrar la deuda del backlog**

En `docs/backlog.md`, mover a la sección "Resuelto" la línea del portado del design system, dejando constancia de qué quedó pendiente (`friend-card`, `drink-icon`, `app-shell` siguen fuera).

- [ ] **Step 8: Verificar todo verde y commitear**

```bash
npm run lint; npm run typecheck; npm test
```

```bash
git add docs/2026-07-03-design-system.md docs/backlog.md
git commit -m "docs: design system reescrito como fuente de verdad"
```

---

## Cierre de la fase D.1

- [ ] **Verificación final**

```bash
npm run lint; npm run typecheck; npm test
```

Esperado: los tres en verde. Mostrar la salida como evidencia (`superpowers:verification-before-completion`).

- [ ] **Revisión visual en el preview**

D.1 cambia el aspecto de las 6 pantallas que ya estaban en tokens Martini (corrección de valores) además de las 7 migradas. Desplegar y revisar antes de dar la fase por cerrada:

```bash
git push origin master
```

El workflow `deploy-pages.yml` publica solo en `https://csf156.github.io/good-company-peru/`. Revisar ahí las 13 pantallas.

- [ ] **No cerrar la fase por cuenta propia.** Según `CLAUDE.md`, la entrada en `docs/ESTADO.md` y el cambio de `FASE ACTUAL` se hacen **solo** cuando el usuario diga "fase concluida".
