import { colors } from '@/lib/theme';

/** Luminancia relativa según WCAG 2.x. */
function luminance(hex: string): number {
  const toLinear = (channelHex: string) => {
    const v = parseInt(channelHex, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(hex.slice(1, 3));
  const g = toLinear(hex.slice(3, 5));
  const b = toLinear(hex.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
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

  it('accent NO alcanza AA para texto sobre surface2 — por eso los estados activos usan primary', () => {
    expect(contrast(colors.accent, colors.surface2)).toBeLessThan(4.5);
  });
});
