import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { TOS_RESUMEN, TOS_TEXTO, aceptarTos } from '@/lib/tos';
import { useProfileRefresh } from '@/lib/profile-context';
import { colors, spacing, fontSize, textStyles, touchTarget } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Icon } from '@/components/Icon';

export default function TosScreen() {
  const router = useRouter();
  const refreshProfile = useProfileRefresh();
  const [aceptado, setAceptado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleAceptar() {
    setError(null);
    setEnviando(true);
    const r = await aceptarTos();
    setEnviando(false);

    if (r.error) {
      setError(r.error);
      return;
    }

    // Esperar el refresco ANTES de navegar: el guardián lee `tosAceptado` del
    // layout, y navegar sin esperar lo devolvería a esta misma pantalla.
    // Si el refresco falla, navega igual — dejarlo atrapado es peor.
    try {
      await refreshProfile();
    } catch {
      // Silencio deliberado — ver arriba.
    }
    router.replace('/');
  }

  return (
    <Screen scroll textured contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Antes de empezar</Text>
      <Text style={styles.title}>Las reglas de Ayni</Text>

      <View style={styles.lista}>
        {TOS_RESUMEN.map((regla) => (
          <View key={regla.texto} style={styles.item}>
            <Icon name={regla.icono} size="md" />
            <Text style={styles.itemTexto}>{regla.texto}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.legal}>{TOS_TEXTO}</Text>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: aceptado }}
        accessibilityLabel="Acepto los términos"
        onPress={() => setAceptado((v) => !v)}
        style={styles.check}
      >
        <Icon name={aceptado ? 'checkbox-marked' : 'checkbox-blank-outline'} size="md" />
        <Text style={styles.itemTexto}>Leí y acepto los términos</Text>
      </Pressable>

      {error && (
        <View style={styles.item}>
          <Icon name="alert-circle-outline" size="md" />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
      {!aceptado && <Text style={styles.hint}>Marca la casilla para continuar.</Text>}

      <Button label="Aceptar y continuar" onPress={handleAceptar} disabled={!aceptado || enviando} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[6], gap: spacing[4] },
  eyebrow: { ...textStyles.label, fontSize: fontSize.caption, color: colors.primary },
  title: { ...textStyles.displaySemiBold, fontSize: fontSize.heading, color: colors.foreground },
  lista: { gap: spacing[3] },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  itemTexto: { ...textStyles.body, color: colors.foreground, flexShrink: 1 },
  legal: { ...textStyles.body, fontSize: fontSize.caption, color: colors.mutedForeground },
  check: { ...touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  error: { ...textStyles.body, color: colors.destructiveText, flexShrink: 1 },
  hint: { ...textStyles.body, fontSize: fontSize.caption, color: colors.mutedForeground },
});
