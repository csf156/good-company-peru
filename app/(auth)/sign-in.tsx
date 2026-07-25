import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { requestOtp } from '@/lib/auth';
import { isValidEmail, toE164Peru } from '@/lib/validation';
import { colors, radius, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

type ContactType = 'phone' | 'email';

const INVALID_MESSAGE: Record<ContactType, string> = {
  email: 'Correo inválido.',
  phone: 'Número de celular inválido.',
};

export default function SignInScreen() {
  const router = useRouter();
  const [contactType, setContactType] = useState<ContactType>('phone');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);

    const isValid = contactType === 'email' ? isValidEmail(value) : Boolean(toE164Peru(value));
    if (!isValid) {
      setError(INVALID_MESSAGE[contactType]);
      return;
    }

    setLoading(true);
    const result = await requestOtp({ type: contactType, value });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push({
      pathname: '/(auth)/verify-otp',
      params: { type: contactType, value },
    });
  }

  return (
    <Screen scroll center contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Bienvenido</Text>
      <Text style={styles.title}>Ingresa a tu cuenta</Text>

      <View style={styles.tabs}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ingresar con celular"
          onPress={() => {
            setContactType('phone');
            setError(null);
          }}
          style={[styles.tab, contactType === 'phone' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, contactType === 'phone' && styles.tabLabelActive]}>
            Celular
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ingresar con correo"
          onPress={() => {
            setContactType('email');
            setError(null);
          }}
          style={[styles.tab, contactType === 'email' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, contactType === 'email' && styles.tabLabelActive]}>
            Correo
          </Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        placeholder={contactType === 'phone' ? '987 654 321' : 'tu@correo.com'}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={contactType === 'phone' ? 'phone-pad' : 'email-address'}
        autoCapitalize="none"
        value={value}
        onChangeText={setValue}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Enviar código" onPress={handleSubmit} disabled={loading} />
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
    fontSize: fontSize.display,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: spacing[2],
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.surface2,
    borderColor: colors.primary,
  },
  tabLabel: {
    ...textStyles.label,
    fontSize: fontSize.tiny,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.accent,
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
