import { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { getBalance } from '@/lib/bar';
import { colors, fontFamily, tabularNums } from '@/lib/theme';
import { Screen } from '@/components/Screen';

export default function WalletScreen() {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    getBalance().then(setBalance);
  }, []);

  return (
    <Screen background={colors.background} center contentStyle={styles.content}>
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
    fontFamily: fontFamily.label,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.primary,
    textAlign: 'center',
  },
  balance: {
    fontFamily: fontFamily.display,
    ...tabularNums,
    fontStyle: 'italic',
    fontSize: 48,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 8,
  },
});
