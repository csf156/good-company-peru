import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import {
  getCatalogo,
  comprarBebida,
  newIdempotencyKey,
  type Bebida,
  type TipoInvitacion,
} from '@/lib/tienda';
import { ayni, ayniTypography } from '@/lib/theme';

const FILTROS: { key: TipoInvitacion | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'divertida', label: 'Divertidas' },
  { key: 'romantica', label: 'Románticas' },
  { key: 'amigos', label: 'De amigos' },
  { key: 'misteriosa', label: 'Misteriosas' },
  { key: 'autor', label: 'De autor' },
];

const TIPO_LABEL: Record<TipoInvitacion, string> = {
  divertida: 'Invitación divertida',
  romantica: 'Invitación romántica',
  misteriosa: 'Invitación misteriosa',
  amigos: 'Invitación de amigos',
  autor: 'Coctel de autor',
};

type EstadoCompra =
  | { tipo: 'idle' }
  | { tipo: 'comprando' }
  | { tipo: 'exito'; total: number }
  | { tipo: 'error'; mensaje: string };

export default function StoreScreen() {
  const [catalogo, setCatalogo] = useState<Bebida[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<TipoInvitacion | 'todos'>('todos');
  const [comprandoId, setComprandoId] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoCompra>({ tipo: 'idle' });
  // idempotency key por bebida: se genera al primer intento y se reusa en
  // reintentos del mismo intento (para no crear una 2ª orden); se descarta al
  // confirmarse, así una compra posterior de la misma bebida usa una key nueva.
  const idempotencyKeys = useRef<Record<string, string>>({});

  useEffect(() => {
    getCatalogo().then((data) => {
      setCatalogo(data);
      setCargando(false);
    });
  }, []);

  const bebidas = filtro === 'todos' ? catalogo : catalogo.filter((b) => b.tipo_invitacion === filtro);

  async function handleComprar(bebida: Bebida) {
    const key = idempotencyKeys.current[bebida.id] ?? newIdempotencyKey();
    idempotencyKeys.current[bebida.id] = key;

    setComprandoId(bebida.id);
    setEstado({ tipo: 'comprando' });

    const result = await comprarBebida(bebida.id, key);

    setComprandoId(null);

    if (result.error || !result.desglose) {
      // Se conserva la key: un reintento del mismo intento no crea otra orden.
      setEstado({ tipo: 'error', mensaje: result.error ?? 'No se pudo completar la compra.' });
      return;
    }

    // Éxito: la próxima compra de esta bebida es un intento nuevo → key nueva.
    delete idempotencyKeys.current[bebida.id];
    setEstado({ tipo: 'exito', total: result.desglose.total });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>La Cava</Text>
      <Text style={styles.title}>Tienda de bebidas</Text>
      <Text style={styles.subtitle}>Cada bebida es un tipo de invitación. Elige el gesto correcto.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        {FILTROS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFiltro(f.key)}
            style={[styles.chip, filtro === f.key && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, filtro === f.key && styles.chipLabelActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {estado.tipo === 'exito' && (
        <Text style={styles.banner}>
          Bebida agregada a tu Bar — pago S/ {estado.total.toFixed(2)}
        </Text>
      )}
      {estado.tipo === 'error' && <Text style={styles.errorBanner}>{estado.mensaje}</Text>}

      {!cargando && bebidas.length === 0 && (
        <Text style={styles.empty}>No hay bebidas disponibles en esta categoría.</Text>
      )}

      <View style={styles.list}>
        {bebidas.map((bebida) => (
          <View key={bebida.id} style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTipo}>{TIPO_LABEL[bebida.tipo_invitacion]}</Text>
              <Text style={styles.rowNombre}>{bebida.nombre}</Text>
            </View>
            <View style={styles.rowAction}>
              <Text style={styles.rowValor}>S/ {bebida.valor_v.toFixed(2)}</Text>
              <Pressable onPress={() => handleComprar(bebida)} disabled={comprandoId === bebida.id}>
                <Text style={styles.buyLabel}>
                  {comprandoId === bebida.id ? 'Comprando…' : 'Comprar'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ayni.background,
  },
  content: {
    padding: 20,
    gap: 8,
  },
  eyebrow: {
    fontFamily: ayniTypography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: ayni.primary,
  },
  title: {
    fontFamily: ayniTypography.fontFamily.serifItalic,
    fontStyle: 'italic',
    fontSize: 30,
    color: ayni.foreground,
  },
  subtitle: {
    fontSize: 13,
    color: ayni.mutedForeground,
    marginBottom: 8,
  },
  filters: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: ayni.border,
    backgroundColor: ayni.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipActive: {
    borderColor: ayni.primary,
    backgroundColor: ayni.primary,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ayni.mutedForeground,
  },
  chipLabelActive: {
    color: ayni.primaryForeground,
  },
  banner: {
    backgroundColor: ayni.success,
    color: ayni.foreground,
    padding: 10,
    borderRadius: 12,
    fontSize: 13,
    marginTop: 8,
  },
  errorBanner: {
    backgroundColor: ayni.destructive,
    color: ayni.foreground,
    padding: 10,
    borderRadius: 12,
    fontSize: 13,
    marginTop: 8,
  },
  empty: {
    color: ayni.mutedForeground,
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
    borderColor: ayni.border,
    backgroundColor: ayni.surface,
    borderRadius: 16,
    padding: 14,
  },
  rowInfo: {
    flex: 1,
  },
  rowTipo: {
    fontFamily: ayniTypography.fontFamily.mono,
    fontSize: 9,
    textTransform: 'uppercase',
    color: ayni.primary,
  },
  rowNombre: {
    fontFamily: ayniTypography.fontFamily.serifItalic,
    fontStyle: 'italic',
    fontSize: 16,
    color: ayni.foreground,
  },
  rowAction: {
    alignItems: 'flex-end',
  },
  rowValor: {
    fontFamily: ayniTypography.fontFamily.mono,
    fontSize: 14,
    color: ayni.foreground,
  },
  buyLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: ayni.primary,
  },
});
