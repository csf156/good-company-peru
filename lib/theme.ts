export const colors = {
  light: {
    primary: '#0E6E66',
    primaryDark: '#0A4F49',
    primaryLight: '#DCF2EF',
    accent: '#FF7A5C',
    accentDark: '#E85F41',
    accentLight: '#FFE4DC',
    success: '#2FA84F',
    warning: '#E8A93B',
    danger: '#E23D3D',
    info: '#3B82C4',
    bg: '#FAF7F2',
    surface: '#FFFFFF',
    text: '#1F2523',
    textMuted: '#6B7570',
    border: '#E7E2D9',
  },
  dark: {
    // primary brightened for AA contrast on the dark background (per design doc Section 2)
    primary: '#3FA79D',
    primaryDark: '#0A4F49',
    primaryLight: '#DCF2EF',
    accent: '#FF7A5C',
    accentDark: '#E85F41',
    accentLight: '#FFE4DC',
    success: '#2FA84F',
    warning: '#E8A93B',
    danger: '#E23D3D',
    info: '#3B82C4',
    bg: '#12181A',
    surface: '#1B2224',
    text: '#F2F5F4',
    textMuted: '#9AA6A2',
    border: '#2A3336',
  },
} as const;

export const levelColors = {
  bronze: '#B08D57',
  silver: '#B5B8BD',
  gold: '#E3B341',
  platinum: '#8FD9D4',
  diamond: '#6C9FE0',
} as const;

export const typography = {
  fontFamily: {
    heading: 'Sora',
    body: 'Inter',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  fontWeight: {
    regular: '400',
    semibold: '600',
    bold: '700',
  },
} as const;

export type ColorScheme = keyof typeof colors;

// Identidad Ayni real (valores de src/styles.css del prototipo Lovable
// good-company-peru — dorado/bronce sobre superficies oscuras). La paleta
// `colors`/`typography` de arriba es la del design-system teal/coral, marcada
// como superada (ver docs/2026-07-03-design-system.md). Se agrega aparte, sin
// tocar `colors` (usado por pantallas ya cerradas), hasta que 1.0's deuda de
// portar el design-system completo se retome (ver docs/backlog.md).
export const ayni = {
  background: '#150F0A',
  surface: '#1D1610',
  surface2: '#241B13',
  foreground: '#F7F3EC',
  primary: '#F0B940',
  primaryForeground: '#150F0A',
  muted: '#332619',
  mutedForeground: '#B3A793',
  border: '#332619',
  destructive: '#D93636',
  success: '#33B37A',
  bronze: '#C77A33',
  silver: '#B8C0C7',
  gold: '#F0C64D',
  diamond: '#66BFFF',
} as const;

export const ayniTypography = {
  fontFamily: {
    serifItalic: 'PlayfairDisplay-Italic',
    mono: 'JetBrainsMono-Regular',
    sans: 'Inter',
  },
} as const;
