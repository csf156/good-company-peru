import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { requestOtp } from '@/lib/auth';
import { isValidEmail, toE164Peru } from '@/lib/validation';
import { colors, typography } from '@/lib/theme';
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
    <Screen background={colors.light.bg} scroll center contentStyle={styles.content}>
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
        placeholderTextColor={colors.light.textMuted}
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
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  tabActive: {
    backgroundColor: colors.light.primaryLight,
    borderColor: colors.light.primary,
  },
  tabLabel: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.textMuted,
    fontWeight: typography.fontWeight.semibold,
  },
  tabLabelActive: {
    color: colors.light.primaryDark,
  },
  input: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.base,
    color: colors.light.text,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  error: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.danger,
  },
});
