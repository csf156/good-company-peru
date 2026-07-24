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
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  getMensajes,
  getContraparteAlias,
  enviarMensaje,
  subscribeMensajes,
  type Mensaje,
} from '@/lib/chat';
import { ayni, ayniTypography } from '@/lib/theme';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [alias, setAlias] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const recargar = useCallback(() => {
    getMensajes(id).then(setMensajes);
  }, [id]);

  useEffect(() => {
    let activo = true;
    // Carga inicial en un solo settle (alias + mensajes) para no encadenar
    // actualizaciones de estado sueltas.
    (async () => {
      const [a, ms] = await Promise.all([getContraparteAlias(id), getMensajes(id)]);
      if (!activo) {
        return;
      }
      setAlias(a);
      setMensajes(ms);
    })();
    // La RLS gobierna el stream: un mensaje oculto de la contraparte ni llega.
    const unsubscribe = subscribeMensajes(id, recargar);
    return () => {
      activo = false;
      unsubscribe();
    };
  }, [id, recargar]);

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerAlias}>{alias ?? 'Amigo'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
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

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe un mensaje…"
          placeholderTextColor={ayni.mutedForeground}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ayni.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: ayni.border,
  },
  headerAlias: {
    fontFamily: ayniTypography.fontFamily.serifItalic,
    fontStyle: 'italic',
    fontSize: 20,
    color: ayni.foreground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 8,
  },
  warning: {
    backgroundColor: ayni.muted,
    borderWidth: 1,
    borderColor: ayni.destructive,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  warningText: {
    color: ayni.foreground,
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
    backgroundColor: ayni.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: ayni.surface,
    borderWidth: 1,
    borderColor: ayni.border,
    borderBottomLeftRadius: 4,
  },
  textMine: {
    color: ayni.primaryForeground,
    fontSize: 13,
  },
  textOther: {
    color: ayni.foreground,
    fontSize: 13,
  },
  ocultoTag: {
    marginTop: 4,
    fontFamily: ayniTypography.fontFamily.mono,
    fontSize: 9,
    textTransform: 'uppercase',
    color: ayni.primaryForeground,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: ayni.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: ayni.border,
    backgroundColor: ayni.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: ayni.foreground,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: ayni.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sendLabel: {
    color: ayni.primaryForeground,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
});
