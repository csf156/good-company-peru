import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { createProfile, type RolUsuario } from '@/lib/auth';
import { colors, typography } from '@/lib/theme';
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
    <Screen background={colors.light.bg} center contentStyle={styles.content}>
      <Text style={styles.title}>¿Cómo quieres usar la app?</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Soy amigo" onPress={() => handleSelect('amigo')} disabled={loading} />
      <Button
        label="Soy rentador"
        variant="accent"
        onPress={() => handleSelect('rentador')}
        disabled={loading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginBottom: 8,
  },
  error: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.danger,
  },
});
