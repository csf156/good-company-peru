import { useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { requestPasswordReset } from '@/lib/auth';
import { isValidEmail } from '@/lib/validation';
import { colors, radius, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

export default function RecuperarScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!isValidEmail(email)) {
      setError('Correo inválido.');
      return;
    }

    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    // D.5, regla de seguridad: SIEMPRE el mismo aviso, exista o no la cuenta
    // — es la puerta de la enumeración de correos registrados.
    setEnviado(true);
  }

  if (enviado) {
    return (
      <Screen scroll center contentStyle={styles.content}>
        <Text style={styles.eyebrow}>Revisa tu correo</Text>
        <Text style={styles.title}>Instrucciones en camino</Text>
        <Text style={styles.subtitle}>
          Si ese correo tiene una cuenta, te mandamos instrucciones para recuperar tu contraseña.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.toggle}>Volver a entrar</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen scroll center contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Recuperar</Text>
      <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
      <Text style={styles.subtitle}>Te mandamos instrucciones para fijar una nueva.</Text>

      <TextInput
        style={styles.input}
        placeholder="tu@correo.com"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label={loading ? 'Enviando…' : 'Enviar instrucciones'} onPress={handleSubmit} disabled={loading} />

      <Pressable accessibilityRole="button" onPress={() => router.back()} disabled={loading}>
        <Text style={styles.toggle}>Volver a entrar</Text>
      </Pressable>
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
  toggle: {
    ...textStyles.label,
    fontSize: fontSize.tiny,
    color: colors.primary,
    textAlign: 'center',
  },
});
