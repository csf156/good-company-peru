import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { createProfile, type RolUsuario } from '@/lib/auth';
import { colors, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

export default function SelectRoleScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSelect(rol: RolUsuario) {
    setError(null);
    setLoading(true);
    const result = await createProfile(rol);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.replace('/');
  }

  return (
    <Screen center contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Un paso más</Text>
      <Text style={styles.title}>¿Cómo quieres usar la app?</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Soy amigo" onPress={() => handleSelect('amigo')} disabled={loading} />
      <Button
        label="Soy rentador"
        variant="secondary"
        onPress={() => handleSelect('rentador')}
        disabled={loading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[6],
    gap: spacing[4],
  },
  eyebrow: {
    ...textStyles.label,
    fontSize: fontSize.caption,
    color: colors.primary,
  },
  title: {
    ...textStyles.displaySemiBold,
    fontSize: fontSize.heading,
    color: colors.foreground,
    marginBottom: spacing[2],
  },
  error: {
    ...textStyles.body,
    color: colors.destructiveText,
  },
});
