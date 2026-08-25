import { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { requestOtp, signInWithGoogle } from '@/lib/auth';
import { isValidEmail } from '@/lib/validation';
import { colors, radius, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

export default function SignInScreen() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!isValidEmail(value)) {
      setError('Correo inválido.');
      return;
    }

    setLoading(true);
    const result = await requestOtp({ type: 'email', value });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push({
      pathname: '/(auth)/verify-otp',
      params: { type: 'email', value },
    });
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    setGoogleLoading(false);

    if (result.error) {
      setError(result.error);
    }
    // Si no hay error, supabase.auth.setSession() dispara onAuthStateChange,
    // que useAuthSession() escucha; app/_layout.tsx reacciona a ese cambio de
    // sesión y redirige solo — no hace falta router.replace aquí.
  }

  return (
    <Screen scroll center contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Bienvenido</Text>
      <Text style={styles.title}>Ingresa a tu cuenta</Text>

      <TextInput
        style={styles.input}
        placeholder="tu@correo.com"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="email-address"
        autoCapitalize="none"
        value={value}
        onChangeText={setValue}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Enviar código" onPress={handleSubmit} disabled={loading || googleLoading} />

      <Text style={styles.separator}>o</Text>

      <Button
        label="Continuar con Google"
        variant="secondary"
        onPress={handleGoogle}
        disabled={loading || googleLoading}
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
  separator: {
    ...textStyles.label,
    fontSize: fontSize.tiny,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
