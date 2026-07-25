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
