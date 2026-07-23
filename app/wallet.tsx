import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getBalance } from '@/lib/bar';
import { ayni, ayniTypography } from '@/lib/theme';

export default function WalletScreen() {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    getBalance().then(setBalance);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Balance disponible</Text>
      <Text style={styles.balance}>S/ {balance.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ayni.background,
    padding: 24,
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: ayniTypography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: ayni.primary,
    textAlign: 'center',
  },
  balance: {
    fontFamily: ayniTypography.fontFamily.serifItalic,
    fontStyle: 'italic',
    fontSize: 48,
    color: ayni.primary,
    textAlign: 'center',
    marginTop: 8,
  },
});
