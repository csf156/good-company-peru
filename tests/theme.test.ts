import { colors, fontFamily, levels, radius, spacing, textStyles } from '@/lib/theme';

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

  it('las variantes de peso de fontFamily apuntan a las caras exactas registradas en app/_layout.tsx', () => {
    // Si un nombre de clave se desalinea del nombre de cara que useFonts()
    // registra, la fuente cae silenciosamente al tipo del sistema en vez de
    // fallar — por eso este test fija los ocho nombres literales.
    expect(fontFamily.display).toBe('PlayfairDisplay-Italic');
    expect(fontFamily.displaySemiBold).toBe('PlayfairDisplay-Italic-SemiBold');
    expect(fontFamily.label).toBe('JetBrainsMono-Regular');
    expect(fontFamily.labelMedium).toBe('JetBrainsMono-Medium');
    expect(fontFamily.body).toBe('Inter-Regular');
    expect(fontFamily.bodyMedium).toBe('Inter-Medium');
    expect(fontFamily.bodySemiBold).toBe('Inter-SemiBold');
    expect(fontFamily.bodyBold).toBe('Inter-Bold');
  });

  it('las variantes de peso de textStyles reusan el tratamiento de su variante base', () => {
    expect(textStyles.displaySemiBold.letterSpacing).toBe(textStyles.display.letterSpacing);
    expect(textStyles.displaySemiBold.fontFamily).toBe(fontFamily.displaySemiBold);

    expect(textStyles.labelMedium.textTransform).toBe(textStyles.label.textTransform);
    expect(textStyles.labelMedium.letterSpacing).toBe(textStyles.label.letterSpacing);
    expect(textStyles.labelMedium.fontFamily).toBe(fontFamily.labelMedium);

    expect(textStyles.bodyMedium.fontFamily).toBe(fontFamily.bodyMedium);
    expect(textStyles.bodySemiBold.fontFamily).toBe(fontFamily.bodySemiBold);
    expect(textStyles.bodyBold.fontFamily).toBe(fontFamily.bodyBold);
  });
});
