import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, fontSize, textStyles, tabularNums } from '@/lib/theme';

/**
 * Selector propio de fecha de nacimiento (día / mes / año), sin dependencia
 * nueva: `@react-native-community/datetimepicker` no funciona en web, que es
 * donde el usuario prueba la app (spec §1.1). Tres listas también evitan que
 * un calendario obligue a retroceder ~30 años mes a mes.
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

type DateOfBirthPickerProps = {
  value: string | null;
  onChange: (iso: string) => void;
};

type Campo = 'dia' | 'mes' | 'anio';

/**
 * Días del mes dado. Sin año conocido, nunca ofrece un día que no exista en
 * TODOS los años (usa un año no bisiesto de referencia) — así nunca aparece
 * un 29 de febrero fantasma antes de saber si el año elegido es bisiesto.
 */
function diasEnMes(mes: number | null, anio: number | null): number {
  if (!mes) return 31;
  return new Date(anio ?? 2001, mes, 0).getDate();
}

export function DateOfBirthPicker({ value, onChange }: DateOfBirthPickerProps) {
  const partes = value ? value.split('-').map(Number) : [];
  const [anio, setAnio] = useState<number | null>(partes[0] ?? null);
  const [mes, setMes] = useState<number | null>(partes[1] ?? null);
  const [dia, setDia] = useState<number | null>(partes[2] ?? null);
  const [abierto, setAbierto] = useState<Campo | null>(null);

  const anioActual = new Date().getFullYear();
  // Que el año más reciente ofrecido sea ya el de alguien de 18 hace el
  // límite evidente antes de validar (spec §1.1).
  const anios = Array.from({ length: 100 - 18 + 1 }, (_, i) => anioActual - 18 - i);
  const maxDia = diasEnMes(mes, anio);
  // Derivado, no estado: si el día elegido ya no existe en el mes/año
  // vigente, se recorta al último día válido (p.ej. 31 → 28 al pasar a
  // febrero) sin un setState en un efecto — evita el "cascading renders"
  // que ESLint marca y sincroniza siempre en el mismo render.
  const diaMostrado = dia !== null ? Math.min(dia, maxDia) : null;

  useEffect(() => {
    if (anio && mes && diaMostrado) {
      onChange(`${anio}-${String(mes).padStart(2, '0')}-${String(diaMostrado).padStart(2, '0')}`);
    }
    // `onChange` deliberadamente fuera de las deps: el padre suele pasar un
    // closure nuevo en cada render (ver profile-setup.tsx), y este efecto
    // solo debe reaccionar a que la fecha en sí cambie, no a la identidad
    // del callback — incluirlo produce un loop (dispara onChange → el padre
    // re-renderiza → nuevo closure → el efecto vuelve a disparar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes, diaMostrado]);

  function abrirCampo(campo: Campo) {
    setAbierto((actual) => (actual === campo ? null : campo));
  }

  return (
    <View>
      <View style={styles.row}>
        <Selector
          etiqueta="Día"
          valor={diaMostrado ? String(diaMostrado) : null}
          abierto={abierto === 'dia'}
          onPress={() => abrirCampo('dia')}
        />
        <Selector
          etiqueta="Mes"
          valor={mes ? (MESES[mes - 1] ?? null) : null}
          abierto={abierto === 'mes'}
          onPress={() => abrirCampo('mes')}
        />
        <Selector
          etiqueta="Año"
          valor={anio ? String(anio) : null}
          abierto={abierto === 'anio'}
          onPress={() => abrirCampo('anio')}
        />
      </View>

      {abierto === 'dia' && (
        <ScrollView style={styles.opciones}>
          {Array.from({ length: maxDia }, (_, i) => i + 1).map((d) => (
            <Pressable
              key={d}
              accessibilityRole="button"
              onPress={() => {
                setDia(d);
                setAbierto(null);
              }}
              style={styles.opcion}
            >
              <Text style={[styles.opcionTexto, tabularNums]}>{d}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {abierto === 'mes' && (
        <ScrollView style={styles.opciones}>
          {MESES.map((nombreMes, i) => (
            <Pressable
              key={nombreMes}
              accessibilityRole="button"
              onPress={() => {
                setMes(i + 1);
                setAbierto(null);
              }}
              style={styles.opcion}
            >
              <Text style={styles.opcionTexto}>{nombreMes}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {abierto === 'anio' && (
        <ScrollView style={styles.opciones}>
          {anios.map((a) => (
            <Pressable
              key={a}
              accessibilityRole="button"
              onPress={() => {
                setAnio(a);
                setAbierto(null);
              }}
              style={styles.opcion}
            >
              <Text style={[styles.opcionTexto, tabularNums]}>{a}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

type SelectorProps = {
  etiqueta: string;
  valor: string | null;
  abierto: boolean;
  onPress: () => void;
};

function Selector({ etiqueta, valor, abierto, onPress }: SelectorProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ expanded: abierto }}
      onPress={onPress}
      style={[styles.selector, abierto && styles.selectorAbierto]}
    >
      <Text style={[styles.selectorTexto, tabularNums, !valor && styles.selectorPlaceholder]}>
        {valor ?? etiqueta}
      </Text>
      <Icon name={abierto ? 'chevron-up' : 'chevron-down'} size="sm" tone="muted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  selector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  selectorAbierto: {
    borderColor: colors.primary,
  },
  selectorTexto: {
    ...textStyles.body,
    fontSize: fontSize.bodyLg,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  selectorPlaceholder: {
    color: colors.mutedForeground,
  },
  opciones: {
    maxHeight: 220,
    marginTop: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  opcion: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  opcionTexto: {
    ...textStyles.body,
    fontSize: fontSize.bodyLg,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
});
