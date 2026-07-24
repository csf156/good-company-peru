import { useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { verifyOtp, requestOtp, type Contact } from '@/lib/auth';
import { getOwnProfile, isProfileComplete } from '@/lib/profile';
import { useResendCooldown } from '@/hooks/useResendCooldown';
import { colors, typography, touchTarget, tabularNums } from '@/lib/theme';
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
    <Screen background={colors.light.bg} scroll center contentStyle={styles.content}>
      <Text style={styles.title}>Ingresa el código</Text>
      <Text style={styles.subtitle}>Enviado a {params.value}</Text>

      <TextInput
        style={styles.input}
        placeholder="000000"
        placeholderTextColor={colors.light.textMuted}
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
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.textMuted,
  },
  input: {
    fontFamily: typography.fontFamily.body,
    ...tabularNums,
    fontSize: typography.fontSize.xl,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.light.text,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    minHeight: 44,
    paddingVertical: 12,
  },
  resendButton: {
    ...touchTarget,
    alignSelf: 'center',
  },
  error: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.danger,
  },
  resend: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.primary,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  resendDisabled: {
    color: colors.light.textMuted,
  },
});
