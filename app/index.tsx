import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getPerfilesDescubrir, type Descubrimiento } from '@/lib/descubrimiento';
import { getPhotoSignedUrl } from '@/lib/storage';
import { colors, fontFamily, tabularNums, touchTarget } from '@/lib/theme';
import { Screen } from '@/components/Screen';
import { Icon } from '@/components/Icon';

const CTA_LABEL: Record<'amigo' | 'rentador', string> = {
  rentador: 'Invitar una bebida',
  amigo: 'Solicitar encuentro',
};

export default function DiscoverScreen() {
  const router = useRouter();
  const [data, setData] = useState<Descubrimiento | null>(null);
  const [cargando, setCargando] = useState(true);
  const [idx, setIdx] = useState(0);
  // Guarda a qué perfil pertenece la última URL firmada resuelta. `fotoUrl`
  // (abajo) se deriva comparando contra el perfil actual, en vez de resetear
  // el estado a mano al cambiar de perfil (eso dispararía un set síncrono en
  // el cuerpo del efecto, cascada de renders que evita react-hooks/set-state-in-effect).
  // Como beneficio: mientras la nueva firma está en vuelo, la comparación ya
  // no matchea y el placeholder aparece solo, sin un reset explícito.
  const [fotoResuelta, setFotoResuelta] = useState<{ perfilId: string; url: string | null } | null>(
    null,
  );

  useEffect(() => {
    getPerfilesDescubrir().then((result) => {
      setData(result);
      setCargando(false);
    });
  }, []);

  const perfiles = data?.perfiles ?? [];
  const total = perfiles.length;
  const perfil = total > 0 ? perfiles[idx] : null;
  const fotoUrl = perfil && fotoResuelta?.perfilId === perfil.id ? fotoResuelta.url : null;

  // Una foto por perfil, no una sola global: se vuelve a pedir la URL
  // firmada cada vez que cambia el perfil mostrado (siguiente/anterior). El
  // bucket es privado (fase 1.1) — no hay URL pública que armar a mano.
  useEffect(() => {
    if (!perfil?.foto_url) return;

    let cancelado = false;
    getPhotoSignedUrl(perfil.foto_url).then((signed) => {
      if (!cancelado) setFotoResuelta({ perfilId: perfil.id, url: signed.url });
    });

    return () => {
      cancelado = true;
    };
  }, [perfil?.id, perfil?.foto_url]);

  function siguiente() {
    setIdx((i) => (i + 1) % total);
  }

  function anterior() {
    setIdx((i) => (i - 1 + total) % total);
  }

  return (
    <Screen background={colors.background} scroll contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Martini</Text>
          <Text style={styles.title}>Descubre</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver propuestas"
          onPress={() => router.push('/propuestas')}
          style={styles.propuestasButton}
        >
          <Icon name="email-outline" size="md" />
        </Pressable>
      </View>

      {!cargando && total === 0 && (
        <Text style={styles.empty}>No hay perfiles disponibles por ahora.</Text>
      )}

      {perfil && (
        <>
          <Text style={styles.counter}>
            Perfil {idx + 1} de {total}
          </Text>

          <View style={styles.card}>
            {fotoUrl ? (
              <Image testID="perfil-foto" source={{ uri: fotoUrl }} style={styles.foto} />
            ) : (
              <View testID="perfil-foto-placeholder" style={styles.fotoPlaceholder}>
                <Icon name="account-outline" size="lg" tone="muted" />
                <Text style={styles.fotoPlaceholderTexto}>Sin foto</Text>
              </View>
            )}
            <Text style={styles.alias}>{perfil.alias}</Text>
            {perfil.edad != null && <Text style={styles.meta}>{perfil.edad} años</Text>}
            {perfil.profesion && <Text style={styles.meta}>{perfil.profesion}</Text>}
            {perfil.hobbies.length > 0 && (
              <Text style={styles.hobbies}>{perfil.hobbies.join(' · ')}</Text>
            )}
          </View>

          <View style={styles.nav}>
            <Pressable
              onPress={anterior}
              accessibilityLabel="Anterior"
              style={styles.navButton}
            >
              <Text style={styles.navGlyph}>‹</Text>
            </Pressable>
            <Pressable
              onPress={siguiente}
              accessibilityLabel="Siguiente"
              style={styles.navButton}
            >
              <Text style={styles.navGlyph}>›</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CTA_LABEL[data!.rolPropio]}
            onPress={() => router.push(`/invitar/${perfil.id}`)}
            style={styles.cta}
          >
            <Text style={styles.ctaLabel}>{CTA_LABEL[data!.rolPropio]}</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  propuestasButton: {
    ...touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
  empty: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },
  counter: {
    fontFamily: fontFamily.label,
    ...tabularNums,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    marginTop: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    gap: 4,
  },
  foto: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    marginBottom: 8,
  },
  fotoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    marginBottom: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  fotoPlaceholderTexto: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  alias: {
    fontFamily: fontFamily.display,
    fontStyle: 'italic',
    fontSize: 24,
    color: colors.foreground,
  },
  meta: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  hobbies: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGlyph: {
    fontSize: 20,
    color: colors.mutedForeground,
  },
  cta: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.primaryForeground,
  },
});
