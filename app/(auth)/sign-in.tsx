import { useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithPassword, signUpWithPassword, signInWithGoogle } from '@/lib/auth';
import { isValidEmail } from '@/lib/validation';
import { colors, radius, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

type Modo = 'entrar' | 'crear';

export default function SignInScreen() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // D.5: con confirmación de correo activa, crear cuenta no deja sesión
  // iniciada — esta pantalla se queda mostrando el aviso en vez de navegar a
  // ningún lado (la sesión real, cuando llegue, la maneja el guardián).
  const [revisaCorreo, setRevisaCorreo] = useState(false);

  const enVuelo = loading || googleLoading;

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setError(null);
    setRevisaCorreo(false);
  }

  async function handleSubmit() {
    setError(null);

    if (!isValidEmail(email)) {
      setError(modo === 'entrar' ? 'Correo o contraseña incorrectos.' : 'Correo inválido.');
      return;
    }
    if (modo === 'crear' && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    const result =
      modo === 'entrar' ? await signInWithPassword(email, password) : await signUpWithPassword(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (modo === 'crear' && result.needsEmailConfirmation) {
      setRevisaCorreo(true);
      return;
    }
    // Si no hay error y no hace falta confirmar, supabase.auth ya dejó la
    // sesión establecida internamente — dispara onAuthStateChange, que
    // useAuthSession() escucha; app/_layout.tsx reacciona y redirige solo,
    // igual que Google más abajo.
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    setGoogleLoading(false);

    if (result.error) {
      setError(result.error);
    }
  }

  if (revisaCorreo) {
    return (
      <Screen scroll center contentStyle={styles.content}>
        <Text style={styles.eyebrow}>Casi listo</Text>
        <Text style={styles.title}>Revisa tu correo</Text>
        <Text style={styles.subtitle}>
          Te mandamos un enlace a {email} para confirmar tu cuenta. Ábrelo para poder entrar.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => cambiarModo('entrar')}>
          <Text style={styles.toggle}>Volver a entrar</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen scroll center contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Bienvenido</Text>
      <Text style={styles.title}>{modo === 'entrar' ? 'Ingresa a tu cuenta' : 'Crea tu cuenta'}</Text>

      <TextInput
        style={styles.input}
        placeholder="tu@correo.com"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        label={loading ? (modo === 'entrar' ? 'Entrando…' : 'Creando…') : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        onPress={handleSubmit}
        disabled={enVuelo}
      />

      {modo === 'entrar' && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/recuperar')}
          disabled={enVuelo}
        >
          <Text style={styles.toggle}>¿Olvidaste tu contraseña?</Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => cambiarModo(modo === 'entrar' ? 'crear' : 'entrar')}
        disabled={enVuelo}
      >
        <Text style={styles.toggle}>
          {modo === 'entrar' ? '¿No tienes cuenta? Créala' : '¿Ya tienes cuenta? Entra'}
        </Text>
      </Pressable>

      <Text style={styles.separator}>o</Text>

      <Button
        label="Continuar con Google"
        variant="secondary"
        onPress={handleGoogle}
        disabled={enVuelo}
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
  toggle: {
    ...textStyles.label,
    fontSize: fontSize.tiny,
    color: colors.primary,
    textAlign: 'center',
  },
  separator: {
    ...textStyles.label,
    fontSize: fontSize.tiny,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
