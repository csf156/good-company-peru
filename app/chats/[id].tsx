import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getMensajes,
  getContraparteAlias,
  enviarMensaje,
  subscribeMensajes,
  type Mensaje,
} from '@/lib/chat';
import { getCitaDetalle, confirmarCita, type CitaDetalle } from '@/lib/citas';
import { colors, fontFamily } from '@/lib/theme';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [alias, setAlias] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [cita, setCita] = useState<CitaDetalle | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [zona, setZona] = useState('');
  const [hora, setHora] = useState('');
  const [mensajeCita, setMensajeCita] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [errorConfirmar, setErrorConfirmar] = useState<string | null>(null);

  const recargar = useCallback(() => {
    getMensajes(id).then(setMensajes);
  }, [id]);

  const recargarCita = useCallback(() => {
    getCitaDetalle(id).then(setCita);
  }, [id]);

  useEffect(() => {
    let activo = true;
    // Carga inicial en un solo settle (alias + mensajes) para no encadenar
    // actualizaciones de estado sueltas.
    (async () => {
      const [a, ms, c] = await Promise.all([
        getContraparteAlias(id),
        getMensajes(id),
        getCitaDetalle(id),
      ]);
      if (!activo) {
        return;
      }
      setAlias(a);
      setMensajes(ms);
      setCita(c);
    })();
    // La RLS gobierna el stream: un mensaje oculto de la contraparte ni llega.
    const unsubscribe = subscribeMensajes(id, recargar);
    return () => {
      activo = false;
      unsubscribe();
    };
  }, [id, recargar]);

  async function handleConfirmar() {
    if (confirmando) {
      return;
    }
    // Chequeo mínimo antes de llamar al servidor (evita el viaje de red en el
    // caso obvio); la fuente de verdad de la validación sigue siendo el Edge
    // Function / la función SQL confirmar_cita.
    if (!zona.trim() || !hora.trim()) {
      setErrorConfirmar('Zona y hora son requeridas.');
      return;
    }
    setConfirmando(true);
    setErrorConfirmar(null);
    const { resultado, error } = await confirmarCita(
      id,
      zona.trim(),
      hora.trim(),
      mensajeCita.trim() || null,
    );
    setConfirmando(false);
    if (error) {
      setErrorConfirmar(error);
      return;
    }
    if (resultado === 'confirmada' || resultado === 'ya_confirmada') {
      setModalVisible(false);
      recargarCita();
    }
  }

  // Un mensaje propio oculto = fue marcado por moderación anti-fuga. Aviso al
  // emisor (el "warning" del plan), sin canal de notificación aparte.
  const hayOcultoPropio = mensajes.some((m) => m.mine && m.oculto);

  async function handleEnviar() {
    const limpio = texto.trim();
    if (!limpio || enviando) {
      return;
    }
    setEnviando(true);
    const { error } = await enviarMensaje(id, limpio);
    setEnviando(false);
    if (!error) {
      setTexto('');
      recargar();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerAlias}>{alias ?? 'Amigo'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {cita?.estado === 'confirmada' && (
          <View style={styles.resumen}>
            <Text style={styles.resumenLabel}>Cita confirmada</Text>
            {cita.bebidaNombre && (
              <Text style={styles.resumenTitulo}>{cita.bebidaNombre}</Text>
            )}
            <View style={styles.resumenFila}>
              {cita.valorV !== null && (
                <Text style={styles.resumenDato}>{cita.valorV} V</Text>
              )}
              {cita.tiempoEstimadoMin !== null && (
                <Text style={styles.resumenDato}>~{cita.tiempoEstimadoMin} min</Text>
              )}
            </View>
            {cita.zona && <Text style={styles.resumenTexto}>{cita.zona}</Text>}
            {cita.hora && <Text style={styles.resumenTexto}>{cita.hora}</Text>}
            {cita.mensaje && <Text style={styles.resumenMensaje}>&ldquo;{cita.mensaje}&rdquo;</Text>}
          </View>
        )}

        {hayOcultoPropio && (
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              ⚠ Un mensaje tuyo fue ocultado por compartir contacto o intentar un pago externo.
              Todo pago va dentro de Ayni; insistir puede suspender tu cuenta.
            </Text>
          </View>
        )}

        {mensajes.map((m) => (
          <View
            key={m.id}
            style={[styles.bubbleRow, m.mine ? styles.bubbleRowMine : styles.bubbleRowOther]}
          >
            <View style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text style={m.mine ? styles.textMine : styles.textOther}>{m.texto}</Text>
              {m.mine && m.oculto && (
                <Text style={styles.ocultoTag}>Oculto — posible pago externo</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {cita?.estado === 'pendiente' && cita.esAmigo && (
        <View style={styles.confirmarWrap}>
          <Pressable
            accessibilityLabel="Confirmar cita"
            style={styles.confirmarButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.confirmarButtonLabel}>Confirmar cita</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe un mensaje…"
          placeholderTextColor={colors.mutedForeground}
          multiline
        />
        <Pressable
          accessibilityLabel="Enviar"
          style={styles.sendButton}
          onPress={handleEnviar}
          disabled={enviando}
        >
          <Text style={styles.sendLabel}>{enviando ? '…' : 'Enviar'}</Text>
        </Pressable>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalEyebrow}>Confirmar cita</Text>
            <Text style={styles.modalTitulo}>Detalles del encuentro</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Zona de encuentro</Text>
              <TextInput
                style={styles.fieldInput}
                value={zona}
                onChangeText={setZona}
                placeholder="Zona de encuentro"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Día y hora</Text>
              <TextInput
                style={styles.fieldInput}
                value={hora}
                onChangeText={setHora}
                placeholder="Hora (ej. 2026-07-25 21:30)"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Mensaje adicional</Text>
              <TextInput
                style={styles.fieldInput}
                value={mensajeCita}
                onChangeText={setMensajeCita}
                placeholder="Mensaje adicional (opcional)"
                placeholderTextColor={colors.mutedForeground}
                multiline
              />
            </View>

            {errorConfirmar && <Text style={styles.modalError}>{errorConfirmar}</Text>}

            <Pressable
              accessibilityLabel="Guardar cita"
              style={styles.modalSubmit}
              onPress={handleConfirmar}
              disabled={confirmando}
            >
              <Text style={styles.modalSubmitLabel}>
                {confirmando ? 'Confirmando…' : 'Guardar cita'}
              </Text>
            </Pressable>

            <Pressable onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancelar}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerAlias: {
    fontFamily: fontFamily.display,
    fontStyle: 'italic',
    fontSize: 20,
    color: colors.foreground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 8,
  },
  warning: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  warningText: {
    color: colors.foreground,
    fontSize: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  textMine: {
    color: colors.primaryForeground,
    fontSize: 13,
  },
  textOther: {
    color: colors.foreground,
    fontSize: 13,
  },
  ocultoTag: {
    marginTop: 4,
    fontFamily: fontFamily.label,
    fontSize: 9,
    textTransform: 'uppercase',
    color: colors.primaryForeground,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.foreground,
    fontSize: 14,
  },
  sendButton: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
  },
  sendLabel: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  resumen: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  resumenLabel: {
    fontFamily: fontFamily.label,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.primary,
    marginBottom: 6,
  },
  resumenTitulo: {
    fontFamily: fontFamily.display,
    fontStyle: 'italic',
    fontSize: 18,
    color: colors.foreground,
  },
  resumenFila: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  resumenDato: {
    fontFamily: fontFamily.label,
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    color: colors.foreground,
  },
  resumenTexto: {
    marginTop: 4,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  resumenMensaje: {
    marginTop: 8,
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.foreground,
  },
  confirmarWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  confirmarButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface2,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmarButtonLabel: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    padding: 20,
    gap: 4,
  },
  modalEyebrow: {
    fontFamily: fontFamily.label,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.primary,
  },
  modalTitulo: {
    fontFamily: fontFamily.display,
    fontStyle: 'italic',
    fontSize: 22,
    color: colors.foreground,
    marginBottom: 12,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  fieldLabel: {
    fontFamily: fontFamily.label,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  fieldInput: {
    color: colors.foreground,
    fontSize: 14,
    padding: 0,
  },
  modalError: {
    color: colors.destructive,
    fontSize: 12,
    marginBottom: 8,
  },
  modalSubmit: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalSubmitLabel: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalCancelar: {
    textAlign: 'center',
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 14,
  },
});
