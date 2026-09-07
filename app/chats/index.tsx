import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getChats, type ChatResumen } from '@/lib/chat';
import { colors, fontFamily } from '@/lib/theme';
import { Screen } from '@/components/Screen';

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
    <Screen background={colors.background} scroll contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Conversaciones</Text>
      <Text style={styles.title}>Tus chats</Text>
      <Text style={styles.subtitle}>
        Cada chat se abre cuando una invitación se acepta. El pago siempre va dentro de Martini.
      </Text>

      {!cargando && chats.length === 0 && (
        <Text style={styles.empty}>No tienes chats todavía.</Text>
      )}

      <View style={styles.list}>
        {chats.map((chat) => (
          <Pressable
            key={chat.citaId}
            accessibilityRole="button"
            accessibilityLabel={`Abrir chat con ${chat.alias ?? 'Amigo'}`}
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
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  alias: {
    fontFamily: fontFamily.display,
    fontStyle: 'italic',
    fontSize: 16,
    color: colors.foreground,
  },
  ultimo: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
});
