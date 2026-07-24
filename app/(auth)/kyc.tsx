import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { uploadDniDocument } from '@/lib/storage';
import { startKycVerification } from '@/lib/kyc';
import { colors, typography } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

export default function KycScreen() {
  const router = useRouter();
  const [dniPath, setDniPath] = useState<string | null>(null);
  const [selfiePath, setSelfiePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);

  async function capture(kind: 'dni' | 'selfie', onCaptured: (path: string) => void) {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Necesitamos acceso a tu cámara para continuar.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const upload = await uploadDniDocument(kind, result.assets[0].uri);
    if (upload.error || !upload.path) {
      setError(upload.error ?? 'No se pudo subir la imagen.');
      return;
    }
    onCaptured(upload.path);
  }

  async function handleVerify() {
    if (!dniPath || !selfiePath) return;
    setError(null);
    setLoading(true);
    const result = await startKycVerification(dniPath, selfiePath);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.estado === 'verificado') {
      router.replace('/');
    } else {
      setPending(true);
    }
  }

  const canVerify = Boolean(dniPath && selfiePath) && !loading;

  return (
    <Screen background={colors.light.bg} scroll center contentStyle={styles.content}>
      <Text style={styles.title}>Verifica tu identidad</Text>
      <Text style={styles.subtitle}>
        Escanea tu DNI y toma una selfie para confirmar que eres tú.
      </Text>

      <Button
        label={dniPath ? 'DNI listo ✓' : 'Escanear DNI'}
        onPress={() => capture('dni', setDniPath)}
        disabled={loading}
      />
      <Button
        label={selfiePath ? 'Selfie lista ✓' : 'Tomar selfie'}
        variant="accent"
        onPress={() => capture('selfie', setSelfiePath)}
        disabled={loading}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {pending && (
        <Text style={styles.pending}>
          Tu identidad está en revisión. Te avisaremos apenas se confirme.
        </Text>
      )}

      <Button label="Verificar identidad" onPress={handleVerify} disabled={!canVerify} />
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
  error: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.danger,
  },
  pending: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.warning,
  },
});
