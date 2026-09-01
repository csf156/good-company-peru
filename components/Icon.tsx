import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '@/lib/theme';

/**
 * Único punto por el que la app dibuja iconos.
 *
 * Set fijo (MaterialCommunityIcons, variantes outline) y escala cerrada de
 * tamaños: lo que hace que un set se lea como propio y no como clipart es la
 * uniformidad de trazo y tamaño, no el icono individual. Feather se evaluó y
 * se descartó — sus ~280 iconos genéricos no cubren vóley, surf, senderismo
 * ni bicicleta (ver spec §3).
 *
 * Por defecto son DECORATIVOS: la regla del proyecto es icono + texto
 * siempre, así que anunciarlos duplicaría la lectura. Pasa
 * `accessibilityLabel` solo en el caso excepcional de un icono sin texto.
 */
type IconSize = 'sm' | 'md' | 'lg';
type IconTone = 'accent' | 'text' | 'muted';

const SIZES: Record<IconSize, number> = { sm: 16, md: 24, lg: 32 };
const TONES: Record<IconTone, string> = {
  accent: colors.primary,
  text: colors.foreground,
  muted: colors.mutedForeground,
};

type IconProps = {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  size?: IconSize;
  tone?: IconTone;
  accessibilityLabel?: string;
  testID?: string;
};

export function Icon({ name, size = 'md', tone = 'text', accessibilityLabel, testID }: IconProps) {
  const decorative = accessibilityLabel === undefined;

  return (
    <MaterialCommunityIcons
      name={name}
      size={SIZES[size]}
      color={TONES[tone]}
      testID={testID}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={decorative ? undefined : 'image'}
    />
  );
}
