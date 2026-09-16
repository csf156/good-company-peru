import { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { completePasswordRecovery, updatePassword } from '@/lib/auth';
import { colors, radius, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

// `detectSessionInUrl: false` (lib/supabase.ts) hace que Supabase nunca
// consuma solo el enlace de recuperación por su cuenta — esta pantalla lee
// `window.location.hash` a mano y establece la sesión ella misma
// (completePasswordRecovery, lib/auth.ts) antes de dejar fijar la contraseña.
export default function NuevaContrasenaScreen() {
  const router = useRouter();
  const [estableciendo, setEstableciendo] = useState(true);
  const [errorSesion, setErrorSesion] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let activo = true;
    async function establecer() {
      const hash = typeof window !== 'undefined' ? window.location?.hash : undefined;
      const result = await completePasswordRecovery(hash ?? '');
      if (!activo) {
        return;
      }
      setEstableciendo(false);
      if (result.error) {
        setErrorSesion(result.error);
      }
    }
    establecer();
    return () => {
      activo = false;
    };
  }, []);

  async function handleSubmit() {
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    // La sesión ya quedó establecida (completePasswordRecovery); el guardián
    // de _layout, con sesión real, manda a donde corresponda según el
    // perfil — nueva-contrasena es la única pantalla que se queda puesta
    // pase lo que pase (route-guard.ts), así que hay que salir a mano.
    router.replace('/');
  }

  if (estableciendo) {
    return (
      <Screen center contentStyle={styles.content}>
        <Text style={styles.subtitle}>Cargando…</Text>
      </Screen>
    );
  }

  if (errorSesion) {
    return (
      <Screen scroll center contentStyle={styles.content}>
        <Text style={styles.eyebrow}>Enlace vencido</Text>
        <Text style={styles.title}>No pudimos abrir el enlace</Text>
        <Text style={styles.error}>{errorSesion}</Text>
        <Text style={styles.subtitle}>Pide uno nuevo desde &ldquo;¿Olvidaste tu contraseña?&rdquo; en el login.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll center contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Nueva contraseña</Text>
      <Text style={styles.title}>Fija tu contraseña</Text>

      <TextInput
        style={styles.input}
        placeholder="Nueva contraseña"
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        label={loading ? 'Guardando…' : 'Guardar contraseña'}
        onPress={handleSubmit}
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
    fontSize: fontSize.display,
    color: colors.foreground,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...textStyles.body,
    color: colors.mutedForeground,
  },
  input: {
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
  },
  error: {
    ...textStyles.body,
    color: colors.destructiveText,
  },
});
