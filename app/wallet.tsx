import { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { getBalance } from '@/lib/bar';
import { ayni, ayniTypography, tabularNums } from '@/lib/theme';
import { Screen } from '@/components/Screen';

export default function WalletScreen() {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    getBalance().then(setBalance);
  }, []);

  return (
    <Screen background={ayni.background} center contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Balance disponible</Text>
      <Text style={styles.balance}>S/ {balance.toFixed(2)}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
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
    ...tabularNums,
    fontStyle: 'italic',
    fontSize: 48,
    color: ayni.primary,
    textAlign: 'center',
    marginTop: 8,
  },
});
