import type { TextStyle } from 'react-native';

/**
 * Paleta Ayni — dark-only.
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
