import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getMiBar, type BarItem, type EstadoBar } from '@/lib/bar';
import { colors, fontFamily } from '@/lib/theme';
import { Screen } from '@/components/Screen';

const ESTADO_LABEL: Record<EstadoBar, string> = {
  disponible: 'Disponible',
  bloqueada: 'Bloqueada',
  consumida: 'Consumida',
};

export default function BarScreen() {
  const [items, setItems] = useState<BarItem[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getMiBar().then((data) => {
      setItems(data);
      setCargando(false);
    });
  }, []);

  return (
    <Screen background={colors.background} scroll contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Mi Bar</Text>
      <Text style={styles.title}>Tu inventario</Text>
      <Text style={styles.subtitle}>
        Bebidas compradas listas para invitar. Cada trago que envíes se descuenta de este stock.
      </Text>

      {!cargando && items.length === 0 && (
        <Text style={styles.empty}>No tienes bebidas en tu bar todavía.</Text>
      )}

      <View style={styles.list}>
        {items.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.rowInfo}>
              {item.bebida ? (
                <>
                  <Text style={styles.rowTipo}>{item.bebida.tipoInvitacion}</Text>
                  <Text style={styles.rowNombre}>{item.bebida.nombre}</Text>
                </>
              ) : (
                <Text style={styles.rowNombre}>Bebida no disponible</Text>
              )}
              <Text style={styles.rowEstado}>{ESTADO_LABEL[item.estado]}</Text>
            </View>
            {item.estado === 'disponible' && (
              <Text style={styles.invitar}>Invitar</Text>
            )}
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 8,
  },
  eyebrow: {
    fontFamily: fontFamily.label,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  title: {
    fontFamily: fontFamily.display,
    fontStyle: 'italic',
    fontSize: 30,
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 8,
  },
  empty: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },
  list: {
    gap: 12,
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  rowInfo: {
    flex: 1,
  },
  rowTipo: {
    fontFamily: fontFamily.label,
    fontSize: 9,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  rowNombre: {
    fontFamily: fontFamily.display,
    fontStyle: 'italic',
    fontSize: 16,
    color: colors.foreground,
  },
  rowEstado: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  invitar: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.primary,
  },
});
