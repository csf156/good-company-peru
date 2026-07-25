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
