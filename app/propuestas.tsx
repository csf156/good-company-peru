import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getPropuestasRecibidas,
  getPropuestasEnviadas,
  responderPropuesta,
  getDesglose,
  type Propuesta,
  type Desglose,
} from '@/lib/invitaciones';
import { getCatalogo, type Bebida } from '@/lib/tienda';
import { colors, spacing, fontSize, radius, textStyles, tabularNums } from '@/lib/theme';
import { Screen } from '@/components/Screen';
import { SelectionGrid } from '@/components/SelectionGrid';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';

// Responder propuestas (Fase E.3, Tarea 5) — la necesitan los dos roles: el
// amigo responde invitaciones, el rentador responde solicitudes. Una sola
// pantalla, dos listas: recibidas (con acciones) y enviadas (solo estado).
//
// Regla de copy más fácil de romper sin darse cuenta (backlog, hallazgo de
// privacidad de E.2b): `preautorizando` y `pendiente` se pintan IGUAL. Ambas
// dicen "esperando respuesta" — pintar `preautorizando` distinto delataría
// que a la otra parte le falló la tarjeta, información que no le
// corresponde ver a quien mandó la propuesta.
const ESTADO_INFO: Record<string, { texto: string; icon: 'clock-outline' | 'check-circle-outline' | 'close-circle-outline'; tone: 'muted' | 'accent' | 'text' }> = {
  pendiente: { texto: 'Esperando respuesta', icon: 'clock-outline', tone: 'muted' },
  preautorizando: { texto: 'Esperando respuesta', icon: 'clock-outline', tone: 'muted' },
  aceptada: { texto: 'Aceptada', icon: 'check-circle-outline', tone: 'accent' },
  rechazada: { texto: 'Rechazada', icon: 'close-circle-outline', tone: 'text' },
  expirada: { texto: 'Expirada', icon: 'close-circle-outline', tone: 'text' },
};

function EstadoBadge({ estado, testIdSufijo }: { estado: string; testIdSufijo: string }) {
  const info = ESTADO_INFO[estado] ?? { texto: estado, icon: 'clock-outline' as const, tone: 'muted' as const };
  return (
    <View style={styles.estadoFila}>
      <View testID={`icono-estado-${testIdSufijo}`}>
        <Icon name={info.icon} size="sm" tone={info.tone} />
      </View>
      <Text testID={`estado-texto-${testIdSufijo}`} style={styles.estadoTexto}>
        {info.texto}
      </Text>
    </View>
  );
}

export default function PropuestasScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'recibidas' | 'enviadas'>('recibidas');
  const [recibidas, setRecibidas] = useState<Propuesta[]>([]);
  const [enviadas, setEnviadas] = useState<Propuesta[]>([]);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal de "aceptar solicitud": solo se abre para tipo='solicitud', porque
  // ahí el rentador recién asigna la bebida y compromete el cobro — un
  // toque no puede aceptar sin ver antes cuánto se está cobrando.
  const [solicitudEnCurso, setSolicitudEnCurso] = useState<Propuesta | null>(null);
  const [catalogo, setCatalogo] = useState<Bebida[]>([]);
  const [bebidaId, setBebidaId] = useState<string | null>(null);
  const [desglose, setDesglose] = useState<Desglose | null>(null);

  const cargar = useCallback(() => {
    Promise.all([getPropuestasRecibidas(), getPropuestasEnviadas()]).then(([r, e]) => {
      setRecibidas(r);
      setEnviadas(e);
    });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function responder(p: Propuesta, accion: 'aceptar' | 'rechazar', bebidaCatalogoId: string | null) {
    setAccionando(p.id);
    setError(null);
    const result = await responderPropuesta({ invitacionId: p.id, accion, bebidaCatalogoId });
    setAccionando(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    cargar();
  }

  function handleAceptar(p: Propuesta) {
    if (p.tipo === 'solicitud') {
      // El rentador tiene que elegir bebida y ver el desglose antes de
      // comprometer un cobro real — nunca un "aceptar" de un solo toque.
      setSolicitudEnCurso(p);
      setBebidaId(null);
      setDesglose(null);
      if (catalogo.length === 0) {
        getCatalogo().then(setCatalogo);
      }
      return;
    }
    // Una `invitacion`: el hold ya existe, aceptar solo lo captura — sin bebida.
    responder(p, 'aceptar', null);
  }

  function handleRechazar(p: Propuesta) {
    responder(p, 'rechazar', null);
  }

  async function elegirBebidaModal(id: string) {
    setBebidaId(id);
    const d = await getDesglose(id);
    setDesglose(d);
  }

  async function confirmarAceptarSolicitud() {
    if (!solicitudEnCurso || !bebidaId) {
      return;
    }
    const p = solicitudEnCurso;
    setSolicitudEnCurso(null);
    await responder(p, 'aceptar', bebidaId);
  }

  const lista = tab === 'recibidas' ? recibidas : enviadas;

  return (
    <Screen background={colors.background} scroll contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Martini</Text>
      <Text style={styles.title}>Propuestas</Text>

      <View style={styles.tabs}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTab('recibidas')}
          style={[styles.tab, tab === 'recibidas' && styles.tabActiva]}
        >
          <Text style={[styles.tabTexto, tab === 'recibidas' && styles.tabTextoActivo]}>Recibidas</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTab('enviadas')}
          style={[styles.tab, tab === 'enviadas' && styles.tabActiva]}
        >
          <Text style={[styles.tabTexto, tab === 'enviadas' && styles.tabTextoActivo]}>Enviadas</Text>
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorRow}>
          <Icon name="alert-circle-outline" size="md" />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      {lista.length === 0 && <Text style={styles.vacio}>Nada por acá todavía.</Text>}

      <View style={styles.lista}>
        {lista.map((p) => (
          <View key={p.id} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Propuesta de ${p.contraparte.alias ?? 'alguien'}`}
              onPress={() => router.push(`/profile/${p.contraparte.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.alias}>{p.contraparte.alias ?? 'Alguien'}</Text>
                <EstadoBadge estado={p.estado} testIdSufijo={p.id} />
              </View>
              {p.bebida && <Text style={styles.bebida}>{p.bebida.nombre}</Text>}
            </Pressable>

            {tab === 'recibidas' && p.estado === 'pendiente' && (
              <View style={styles.acciones}>
                <Button
                  label="Rechazar"
                  variant="secondary"
                  disabled={accionando === p.id}
                  onPress={() => handleRechazar(p)}
                />
                <Button label="Aceptar" disabled={accionando === p.id} onPress={() => handleAceptar(p)} />
              </View>
            )}
          </View>
        ))}
      </View>

      <Modal
        visible={solicitudEnCurso !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSolicitudEnCurso(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalEyebrow}>Aceptar solicitud</Text>
            <Text style={styles.modalTitulo}>
              Elige la bebida para {solicitudEnCurso?.contraparte.alias ?? 'esta persona'}
            </Text>

            <SelectionGrid
              options={catalogo.map((b) => ({
                value: b.id,
                label: `${b.nombre} — S/ ${b.valor_v.toFixed(2)}`,
              }))}
              selected={bebidaId ? [bebidaId] : []}
              onChange={(vals) => {
                const id = vals[vals.length - 1] ?? null;
                if (id) {
                  elegirBebidaModal(id);
                }
              }}
              max={1}
            />

            {desglose && (
              <View style={styles.desglose}>
                <View style={styles.desgloseFila}>
                  <Text style={styles.desgloseLabel}>Bebida</Text>
                  <Text style={styles.desgloseMonto}>S/ {desglose.valorV.toFixed(2)}</Text>
                </View>
                <View style={styles.desgloseFila}>
                  <Text style={styles.desgloseLabel}>Comisión</Text>
                  <Text style={styles.desgloseMonto}>S/ {desglose.buyerFee.toFixed(2)}</Text>
                </View>
                <View style={[styles.desgloseFila, styles.desgloseTotalFila]}>
                  <Text style={styles.desgloseTotalLabel}>Total</Text>
                  <Text style={styles.desgloseTotalMonto}>S/ {desglose.total.toFixed(2)}</Text>
                </View>
              </View>
            )}

            <Button label="Confirmar" disabled={!bebidaId} onPress={confirmarAceptarSolicitud} />
            <Pressable accessibilityRole="button" onPress={() => setSolicitudEnCurso(null)}>
              <Text style={styles.modalCancelar}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  tabs: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActiva: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  tabTexto: {
    ...textStyles.label,
    fontSize: fontSize.caption,
    color: colors.mutedForeground,
  },
  tabTextoActivo: {
    color: colors.primaryForeground,
  },
  vacio: {
    ...textStyles.body,
    color: colors.mutedForeground,
    fontSize: fontSize.body,
    marginTop: spacing[4],
    textAlign: 'center',
  },
  lista: {
    gap: spacing[3],
    marginTop: spacing[3],
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[2],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alias: {
    ...textStyles.display,
    fontSize: fontSize.title,
    color: colors.foreground,
  },
  estadoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  estadoTexto: {
    ...textStyles.body,
    fontSize: fontSize.caption,
    color: colors.mutedForeground,
  },
  bebida: {
    ...textStyles.body,
    fontSize: fontSize.body,
    color: colors.mutedForeground,
  },
  acciones: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  error: {
    ...textStyles.body,
    flex: 1,
    color: colors.destructiveText,
    fontSize: fontSize.body,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing[5],
    gap: spacing[3],
  },
  modalEyebrow: {
    ...textStyles.label,
    fontSize: fontSize.tiny,
    color: colors.primary,
  },
  modalTitulo: {
    ...textStyles.display,
    fontSize: fontSize.titleLg,
    color: colors.foreground,
    marginBottom: spacing[2],
  },
  modalCancelar: {
    ...textStyles.body,
    textAlign: 'center',
    color: colors.mutedForeground,
    fontSize: fontSize.small,
    marginTop: spacing[3],
  },
  desglose: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[2],
  },
  desgloseFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  desgloseLabel: {
    ...textStyles.body,
    fontSize: fontSize.body,
    color: colors.mutedForeground,
  },
  desgloseMonto: {
    ...textStyles.label,
    ...tabularNums,
    fontSize: fontSize.body,
    color: colors.foreground,
  },
  desgloseTotalFila: {
    marginTop: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  desgloseTotalLabel: {
    ...textStyles.label,
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.foreground,
  },
  desgloseTotalMonto: {
    ...textStyles.label,
    ...tabularNums,
    fontSize: fontSize.bodyLg,
    fontWeight: '700',
    color: colors.primary,
  },
});
