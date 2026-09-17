import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getPorCobrar } from '@/lib/por-cobrar';
import { getOwnProfile } from '@/lib/profile';
import { colors, spacing, fontSize, radius, textStyles, tabularNums } from '@/lib/theme';
import { Screen } from '@/components/Screen';
import { Icon } from '@/components/Icon';

// "Por cobrar" (Fase E.4, Tarea 1) — pantalla de solo lectura para el rol
// amigo: lo que ganó por encuentros verificados y todavía no se depositó.
// Sin fecha, sin botón de "retirar" ni "usar": la liquidación periódica y el
// adelanto a demanda son la fase 6.3, que no existe. Hoy `getPorCobrar`
// siempre da 0 — es correcto, no un placeholder a medio hacer (la liberación
// de escrow que produce un `payout` es la fase 5.4).
//
// "El rentador no tiene vista de dinero agregado. Nunca ve 'Por cobrar'"
// (constraint global del plan, repetida en la migración de la vista E.1).
// app/index.tsx ya esconde el botón de entrada para quien no es amigo, pero
// eso solo cubre la navegación normal — esta guarda de acá es la que
// realmente lo cumple, porque también corta un deep link directo a la ruta.
export default function PorCobrarScreen() {
  const router = useRouter();
  const [monto, setMonto] = useState(0);
  const [permitido, setPermitido] = useState(false);
  const [cargandoMonto, setCargandoMonto] = useState(true);

  useEffect(() => {
    let cancelado = false;
    getOwnProfile().then((perfil) => {
      if (cancelado) return;
      if (perfil?.rol !== 'amigo') {
        router.replace('/');
        return;
      }
      setPermitido(true);
      getPorCobrar().then((valor) => {
        if (cancelado) return;
        setMonto(valor);
        setCargandoMonto(false);
      });
    });
    return () => {
      cancelado = true;
    };
  }, [router]);

  // Ni contenido ni placeholder mientras se confirma el rol o si no es
  // amigo: nada que ver hasta que la guarda de arriba lo deje pasar (o lo
  // mande de vuelta a '/').
  if (!permitido) {
    return null;
  }

  return (
    <Screen background={colors.background} scroll contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Martini</Text>
      <Text style={styles.title}>Por cobrar</Text>

      {/* Tres niveles, no tres párrafos iguales (Fase E.4, Tarea 4): el
          importe manda, la explicación lo define, el destino es la letra
          chica. Cada nivel cambia de familia, tamaño, color y peso — no solo
          de tamaño — y el filete separa el tercero para que se lea como pie
          de tarjeta y no como una segunda explicación. */}
      <View style={styles.card}>
        <Text style={styles.monto}>S/ {monto.toFixed(2)}</Text>
        <Text style={styles.explicacion}>
          Lo que ganaste por encuentros verificados y aún no se ha depositado.
        </Text>
        <View style={styles.destinoFila}>
          <Icon name="bank-outline" size="sm" tone="muted" />
          <Text style={styles.destino}>
            Se deposita automáticamente en una cuenta bancaria a tu nombre.
          </Text>
        </View>
      </View>

      {!cargandoMonto && monto === 0 && (
        <View style={styles.vacio}>
          <Icon name="receipt-text-outline" size="lg" tone="muted" />
          <Text style={styles.vacioTexto}>
            Aún no tienes nada por cobrar. Aparecerá aquí cuando completes un encuentro verificado.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[5],
    gap: spacing[2],
  },
  eyebrow: {
    ...textStyles.label,
    fontSize: fontSize.tiny,
    color: colors.primary,
  },
  title: {
    ...textStyles.display,
    fontSize: fontSize.display,
    color: colors.foreground,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[5],
    marginTop: spacing[3],
    // Un solo paso de 12 entre niveles; el filete del destino aporta su
    // propio paddingTop de 12, así que queda simétrico (12 · filete · 12)
    // sin sumar márgenes a mano.
    gap: spacing[3],
  },
  // Nivel 1 — importe. Mono medium para que el trazo aguante a 36px sobre
  // fondo oscuro, y el único elemento cromático de la tarjeta.
  monto: {
    ...textStyles.labelMedium,
    ...tabularNums,
    fontSize: fontSize.displayLg,
    // El 1.6 de `textStyles.label` está calibrado para versalitas de 10–12px,
    // donde el tracking ayuda a leer. A 36px la misma cifra se desparrama: el
    // tracking no escala con el cuerpo. Lo único que se pisa del token.
    letterSpacing: 0,
    color: colors.primary,
  },
  // Nivel 2 — explicación. Es la frase que dice QUÉ es ese número, así que va
  // en texto de lectura (16/24) y a color pleno, no en el gris de la letra
  // chica con el que se confundía con el destino.
  explicacion: {
    ...textStyles.body,
    fontSize: fontSize.bodyLg,
    lineHeight: 24,
    color: colors.foreground,
  },
  // Nivel 3 — destino. Pie de tarjeta: filete arriba, cuerpo chico, gris
  // apagado e icono que lo marca como dato de otra naturaleza. Mismo patrón
  // que la fila de retención de `app/invitar/[receptorId].tsx`.
  // `mutedForeground` sobre `surface` da 6.1:1 — AA de sobra aun a 12px.
  destinoFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  destino: {
    ...textStyles.body,
    flex: 1,
    fontSize: fontSize.small,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  vacio: {
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[6],
    paddingHorizontal: spacing[4],
  },
  vacioTexto: {
    ...textStyles.body,
    fontSize: fontSize.body,
    lineHeight: 21,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
