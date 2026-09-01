import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from '@/components/Icon';
import { colors, spacing, fontSize, textStyles, touchTarget } from '@/lib/theme';

type StepHeaderProps = {
  paso: number;
  total: number;
  titulo: string;
  onVolver?: () => void;
};

/** Cabecera de cada paso del wizard: indicador "Paso N de T", título y volver. */
export function StepHeader({ paso, total, titulo, onVolver }: StepHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {onVolver && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={onVolver}
            style={styles.backButton}
          >
            <Icon name="arrow-left" size="md" />
          </Pressable>
        )}
        <Text style={styles.indicador}>
          Paso {paso} de {total}
        </Text>
      </View>
      <Text style={styles.titulo}>{titulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  backButton: {
    ...touchTarget,
    marginLeft: -spacing[2],
  },
  indicador: {
    ...textStyles.label,
    fontSize: fontSize.caption,
    color: colors.primary,
  },
  titulo: {
    ...textStyles.displaySemiBold,
    fontSize: fontSize.heading,
    color: colors.foreground,
  },
});
