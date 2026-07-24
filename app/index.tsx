import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { getPerfilesDescubrir, type Descubrimiento } from '@/lib/descubrimiento';
import { ayni, ayniTypography, tabularNums } from '@/lib/theme';
import { Screen } from '@/components/Screen';

const CTA_LABEL: Record<'amigo' | 'rentador', string> = {
  rentador: 'Invitar una bebida',
  amigo: 'Solicitar encuentro',
};

export default function DiscoverScreen() {
  const [data, setData] = useState<Descubrimiento | null>(null);
  const [cargando, setCargando] = useState(true);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    getPerfilesDescubrir().then((result) => {
      setData(result);
      setCargando(false);
    });
  }, []);

  const perfiles = data?.perfiles ?? [];
  const total = perfiles.length;
  const perfil = total > 0 ? perfiles[idx] : null;

  function siguiente() {
    setIdx((i) => (i + 1) % total);
  }

  function anterior() {
    setIdx((i) => (i - 1 + total) % total);
  }

  return (
    <Screen background={ayni.background} scroll contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Ayni</Text>
      <Text style={styles.title}>Descubre</Text>

      {!cargando && total === 0 && (
        <Text style={styles.empty}>No hay perfiles disponibles por ahora.</Text>
      )}

      {perfil && (
        <>
          <Text style={styles.counter}>
            Perfil {idx + 1} de {total}
          </Text>

          <View style={styles.card}>
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
  empty: {
    color: ayni.mutedForeground,
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },
  counter: {
    fontFamily: ayniTypography.fontFamily.mono,
    ...tabularNums,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: ayni.mutedForeground,
    marginTop: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: ayni.border,
    backgroundColor: ayni.surface,
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    gap: 4,
  },
  alias: {
    fontFamily: ayniTypography.fontFamily.serifItalic,
    fontStyle: 'italic',
    fontSize: 24,
    color: ayni.foreground,
  },
  meta: {
    fontSize: 13,
    color: ayni.mutedForeground,
  },
  hobbies: {
    fontSize: 12,
    color: ayni.mutedForeground,
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
    borderColor: ayni.border,
    backgroundColor: ayni.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGlyph: {
    fontSize: 20,
    color: ayni.mutedForeground,
  },
  cta: {
    marginTop: 20,
    backgroundColor: ayni.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: ayni.primaryForeground,
  },
});
