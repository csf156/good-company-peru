import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getChats, type ChatResumen } from '@/lib/chat';
import { ayni, ayniTypography } from '@/lib/theme';

export default function ChatsScreen() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatResumen[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getChats().then((data) => {
      setChats(data);
      setCargando(false);
    });
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Conversaciones</Text>
      <Text style={styles.title}>Tus chats</Text>
      <Text style={styles.subtitle}>
        Cada chat se abre cuando una invitación se acepta. El pago siempre va dentro de Ayni.
      </Text>

      {!cargando && chats.length === 0 && (
        <Text style={styles.empty}>No tienes chats todavía.</Text>
      )}

      <View style={styles.list}>
        {chats.map((chat) => (
          <Pressable
            key={chat.citaId}
            style={styles.row}
            onPress={() => router.push(`/chats/${chat.citaId}`)}
          >
            <Text style={styles.alias}>{chat.alias ?? 'Amigo'}</Text>
            <Text style={styles.ultimo} numberOfLines={1}>
              {chat.ultimoMensaje ?? 'Sin mensajes todavía'}
            </Text>
          </Pressable>
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
    borderWidth: 1,
    borderColor: ayni.border,
    backgroundColor: ayni.surface,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  alias: {
    fontFamily: ayniTypography.fontFamily.serifItalic,
    fontStyle: 'italic',
    fontSize: 16,
    color: ayni.foreground,
  },
  ultimo: {
    fontSize: 12,
    color: ayni.mutedForeground,
  },
});
