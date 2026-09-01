import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, fontSize, textStyles } from '@/lib/theme';
import type { OpcionConIcono } from '@/lib/onboarding-options';

type SelectionOption = OpcionConIcono | { value: string; label: string; icon?: undefined };

type SelectionGridProps = {
  options: SelectionOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  max: number;
  searchable?: boolean;
};

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function SelectionGrid({ options, selected, onChange, max, searchable }: SelectionGridProps) {
  const [query, setQuery] = useState('');
  const [maxError, setMaxError] = useState(false);

  const visibleOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const normalizedQuery = normalizar(query);
    return options.filter((option) => normalizar(option.label).includes(normalizedQuery));
  }, [options, query, searchable]);

  function toggle(value: string) {
    const isSelected = selected.includes(value);
    if (isSelected) {
      setMaxError(false);
      onChange(selected.filter((item) => item !== value));
      return;
    }
    if (selected.length >= max) {
      setMaxError(true);
      return;
    }
    setMaxError(false);
    onChange([...selected, value]);
  }

  return (
    <View>
      {searchable && (
        <TextInput
          style={styles.search}
          placeholder="Buscar…"
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={setQuery}
        />
      )}

      <View style={styles.grid}>
        {visibleOptions.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => toggle(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={option.label}
            >
              {option.icon && (
                <Icon name={option.icon} size="sm" tone={isSelected ? 'accent' : 'text'} />
              )}
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {option.label}
              </Text>
              {isSelected && <Icon name="check" size="sm" tone="accent" />}
            </Pressable>
          );
        })}
      </View>

      {maxError && <Text style={styles.maxError}>Puedes elegir máximo {max}.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    ...textStyles.body,
    fontSize: fontSize.bodyLg,
    color: colors.foreground,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    minHeight: 44,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[3],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
  },
  chipText: {
    ...textStyles.body,
    color: colors.foreground,
  },
  chipTextSelected: {
    color: colors.primary,
  },
  maxError: {
    ...textStyles.body,
    color: colors.destructiveText,
    marginTop: spacing[2],
  },
});
