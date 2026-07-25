import { useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { verifyOtp, requestOtp, type Contact } from '@/lib/auth';
import { getOwnProfile, isProfileComplete } from '@/lib/profile';
import { useResendCooldown } from '@/hooks/useResendCooldown';
import { colors, radius, spacing, fontSize, textStyles, touchTarget, tabularNums } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type: 'phone' | 'email'; value: string }>();
  const contact: Contact = { type: params.type, value: params.value };

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { remaining, canResend, start } = useResendCooldown(RESEND_COOLDOWN_SECONDS);

  async function handleVerify() {
    setError(null);
    setLoading(true);
    const result = await verifyOtp(contact, code);

    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }

    const profile = await getOwnProfile();
    setLoading(false);

    if (!profile) {
      router.replace('/(auth)/select-role');
    } else if (!isProfileComplete(profile)) {
      router.replace('/(auth)/profile-setup');
    } else if (profile.kyc_estado !== 'verificado') {
      router.replace('/(auth)/kyc');
    } else {
      router.replace('/');
    }
  }

  async function handleResend() {
    setError(null);
    start();
    await requestOtp(contact);
  }

  return (
    <Screen scroll center contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Verificación</Text>
      <Text style={styles.title}>Ingresa el código</Text>
      <Text style={styles.subtitle}>Enviado a {params.value}</Text>

      <TextInput
        style={styles.input}
        placeholder="000000"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Verificar" onPress={handleVerify} disabled={loading} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reenviar código"
        accessibilityState={{ disabled: !canResend }}
        disabled={!canResend}
        onPress={handleResend}
        style={styles.resendButton}
      >
        <Text style={[styles.resend, !canResend && styles.resendDisabled]}>
          {canResend ? 'Reenviar código' : `Reenviar en ${remaining}s`}
        </Text>
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
    ...textStyles.display,
    fontSize: fontSize.heading,
    fontWeight: '700',
    color: colors.foreground,
  },
  subtitle: {
    ...textStyles.body,
    color: colors.mutedForeground,
  },
  input: {
    ...textStyles.body,
    ...tabularNums,
    fontSize: fontSize.display,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.foreground,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    minHeight: 44,
    paddingVertical: spacing[3],
  },
  resendButton: {
    ...touchTarget,
    alignSelf: 'center',
  },
  error: {
    ...textStyles.body,
    color: colors.destructiveText,
  },
  resend: {
    ...textStyles.label,
    fontSize: fontSize.tiny,
    color: colors.primary,
    textAlign: 'center',
  },
  resendDisabled: {
    color: colors.mutedForeground,
  },
});
