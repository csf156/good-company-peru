import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getPorCobrar } from '@/lib/por-cobrar';
import { colors, spacing, fontSize, radius, textStyles, tabularNums } from '@/lib/theme';
import { Screen } from '@/components/Screen';
import { Icon } from '@/components/Icon';

// "Por cobrar" (Fase E.4, Tarea 1) — pantalla de solo lectura para el rol
// amigo: lo que ganó por encuentros verificados y todavía no se depositó.
// Sin fecha, sin botón de "retirar" ni "usar": la liquidación periódica y el
// adelanto a demanda son la fase 6.3, que no existe. Hoy `getPorCobrar`
// siempre da 0 — es correcto, no un placeholder a medio hacer (la liberación
// de escrow que produce un `payout` es la fase 5.4).
export default function PorCobrarScreen() {
  const [monto, setMonto] = useState(0);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getPorCobrar().then((valor) => {
      setMonto(valor);
      setCargando(false);
    });
  }, []);

  return (
    <Screen background={colors.background} scroll contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Martini</Text>
      <Text style={styles.title}>Por cobrar</Text>

      <View style={styles.card}>
        <Text style={styles.monto}>S/ {monto.toFixed(2)}</Text>
        <Text style={styles.texto}>
          Lo que ganaste por encuentros verificados y aún no se ha depositado.
        </Text>
        <Text style={styles.texto}>Se deposita automáticamente en una cuenta bancaria a tu nombre.</Text>
      </View>

      {!cargando && monto === 0 && (
        <View style={styles.vacio}>
          <Icon name="wallet-outline" size="lg" tone="muted" />
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
    gap: spacing[2],
  },
  monto: {
    ...textStyles.label,
    ...tabularNums,
    fontSize: fontSize.displayLg,
    color: colors.primary,
  },
  texto: {
    ...textStyles.body,
    fontSize: fontSize.body,
    color: colors.mutedForeground,
  },
  vacio: {
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[6],
    paddingHorizontal: spacing[4],
  },
  vacioTexto: {
    ...textStyles.body,
    fontSize: fontSize.body,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
