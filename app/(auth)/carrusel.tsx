import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { marcarCarruselVisto } from '@/lib/carrusel';
import { useCarruselVisto } from '@/lib/carrusel-context';
import { colors, spacing, fontSize, textStyles, touchTarget } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Icon } from '@/components/Icon';

const SLIDES = [
  {
    icono: 'account-group-outline',
    titulo: 'Compañía, no citas',
    texto: 'Martini conecta gente que quiere compañía para un café, una conversación o un evento.',
  },
  {
    icono: 'glass-cocktail',
    titulo: 'Compras una bebida',
    texto: 'No le pagas a una persona: compras una bebida virtual que representa el encuentro.',
  },
  {
    icono: 'lock-outline',
    titulo: 'El dinero queda retenido',
    texto: 'Nadie cobra nada hasta que ustedes dos se encuentren de verdad.',
  },
  {
    icono: 'qrcode-scan',
    titulo: 'Se libera al encontrarse',
    texto: 'Al confirmar el encuentro con un código QR, el pago se libera. Así de simple.',
  },
] as const;

export default function CarruselScreen() {
  const router = useRouter();
  const marcarVisto = useCarruselVisto();
  const [i, setI] = useState(0);
  const esUltima = i === SLIDES.length - 1;
  // `SLIDES[i]` con `i` dinámico da `T | undefined` bajo noUncheckedIndexedAccess
  // aunque el índice esté siempre acotado por construcción (setI nunca pasa de
  // esUltima). `SLIDES[0]` con índice LITERAL sí tipa preciso en una tupla
  // `as const`, así que sirve de fallback sin `undefined` en el tipo.
  const slide = SLIDES[i] ?? SLIDES[0];

  async function salir() {
    await marcarCarruselVisto();
    // Avisar al layout ANTES de navegar. Escribir el almacenamiento no basta:
    // `_layout` lo lee una sola vez al montar, así que sin este aviso su
    // `carruselPendiente` seguiría en `true` y el efecto de redirección
    // devolvería al usuario aquí en cuanto cambie el segmento. Bucle infinito.
    marcarVisto();
    router.replace('/(auth)/sign-in');
  }

  return (
    <Screen scroll center textured contentStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Saltar"
        onPress={salir}
        style={styles.saltar}
      >
        <Text style={styles.saltarTexto}>Saltar</Text>
      </Pressable>

      <View style={styles.slide}>
        <Icon name={slide.icono} size="lg" />
        <Text style={styles.titulo}>{slide.titulo}</Text>
        <Text style={styles.texto}>{slide.texto}</Text>
      </View>

      <Text style={styles.indicador}>
        {i + 1} de {SLIDES.length}
      </Text>

      <Button
        label={esUltima ? 'Entrar' : 'Siguiente'}
        onPress={esUltima ? salir : () => setI((v) => v + 1)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[6], gap: spacing[4] },
  saltar: { ...touchTarget, alignSelf: 'flex-end' },
  saltarTexto: { ...textStyles.label, fontSize: fontSize.caption, color: colors.mutedForeground },
  slide: { alignItems: 'center', gap: spacing[3] },
  titulo: {
    ...textStyles.displaySemiBold,
    fontSize: fontSize.heading,
    color: colors.foreground,
    textAlign: 'center',
  },
  texto: { ...textStyles.body, color: colors.mutedForeground, textAlign: 'center' },
  indicador: {
    ...textStyles.label,
    fontSize: fontSize.caption,
    color: colors.primary,
    textAlign: 'center',
  },
});
