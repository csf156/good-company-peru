import { useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Icon } from '@/components/Icon';

const TOTAL_PASOS = 7;

const GENERO_OPCIONES = ['Mujer', 'Hombre', 'No binario', 'Prefiero no decirlo', 'Otro'] as const;

const TITULOS: Record<number, string> = {
  1: 'Nombre y alias',
  2: 'Fecha de nacimiento',
  3: 'Género',
  4: 'Tu foto',
  5: 'Tus hobbies',
  6: '¿Qué tipo de salida buscas?',
  7: 'Distritos donde te mueves',
};

type Datos = {
  nombre: string;
  alias: string;
  // Paso 2: valor temporal en texto libre (AAAA-MM-DD). La Tarea 4 lo
  // reemplaza por DateOfBirthPicker sin cambiar la forma del dato.
  fechaNacimiento: string;
  genero: string;
  generoOtro: string;
  fotoPath: string | null;
  hobbies: string[];
  hobbiesOtroTexto: string;
  tipoSalida: string[];
  distritos: string[];
};

const DATOS_INICIALES: Datos = {
  nombre: '',
  alias: '',
  fechaNacimiento: '',
  genero: '',
  generoOtro: '',
  fotoPath: null,
  hobbies: [],
  hobbiesOtroTexto: '',
  tipoSalida: [],
  distritos: [],
};

/**
 * Única fuente de verdad de si se puede avanzar. Pura y testeable aparte de
 * la UI. El paso 2 hoy solo exige que el campo no esté vacío — la Tarea 4
 * la conecta a `isMayorDeEdad` cuando el selector real de fecha reemplace el
 * texto libre temporal.
 */
function validarPaso(paso: number, datos: Datos): string | null {
  switch (paso) {
    case 1:
      return !datos.nombre.trim() || !datos.alias.trim() ? 'Completa tu nombre y alias.' : null;
    case 2:
      return datos.fechaNacimiento.trim() ? null : 'Ingresa tu fecha de nacimiento.';
    case 3:
      if (!datos.genero) return 'Elige una opción.';
      return datos.genero === 'Otro' && !datos.generoOtro.trim() ? 'Escribe tu género.' : null;
    default:
      return null;
  }
}

export default function ProfileSetupScreen() {
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState<Datos>(DATOS_INICIALES);
  const [error, setError] = useState<string | null>(null);

  function actualizar(cambios: Partial<Datos>) {
    setDatos((prev) => ({ ...prev, ...cambios }));
  }

  const motivo = validarPaso(paso, datos);

  function handleVolver() {
    setError(null);
    setPaso((p) => Math.max(1, p - 1));
  }

  function handleContinuar() {
    if (motivo) return;
    setError(null);

    if (paso < TOTAL_PASOS) {
      setPaso((p) => p + 1);
      return;
    }

    // La persistencia final llega en la Tarea 6.
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <StepHeader
        paso={paso}
        total={TOTAL_PASOS}
        titulo={TITULOS[paso] ?? ''}
        onVolver={paso > 1 ? handleVolver : undefined}
      />

      {paso === 1 && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Nombre completo"
            placeholderTextColor={colors.mutedForeground}
            value={datos.nombre}
            onChangeText={(nombre) => actualizar({ nombre })}
          />
          <TextInput
            style={styles.input}
            placeholder="Alias"
            placeholderTextColor={colors.mutedForeground}
            value={datos.alias}
            onChangeText={(alias) => actualizar({ alias })}
          />
        </>
      )}

      {paso === 2 && (
        <TextInput
          style={styles.input}
          placeholder="Fecha de nacimiento (AAAA-MM-DD)"
          placeholderTextColor={colors.mutedForeground}
          value={datos.fechaNacimiento}
          onChangeText={(fechaNacimiento) => actualizar({ fechaNacimiento })}
        />
      )}

      {paso === 3 && (
        <>
          {GENERO_OPCIONES.map((opcion) => {
            const seleccionado = datos.genero === opcion;
            return (
              <Pressable
                key={opcion}
                accessibilityRole="radio"
                accessibilityState={{ selected: seleccionado }}
                accessibilityLabel={opcion}
                onPress={() =>
                  actualizar({
                    genero: opcion,
                    generoOtro: opcion === 'Otro' ? datos.generoOtro : '',
                  })
                }
                style={[styles.opcion, seleccionado && styles.opcionSeleccionada]}
              >
                <Text style={[styles.opcionText, seleccionado && styles.opcionTextSeleccionado]}>
                  {opcion}
                </Text>
                {seleccionado && <Icon name="check" size="sm" tone="accent" />}
              </Pressable>
            );
          })}
          {datos.genero === 'Otro' && (
            <TextInput
              style={styles.input}
              placeholder="Escribe tu género"
              placeholderTextColor={colors.mutedForeground}
              value={datos.generoOtro}
              onChangeText={(generoOtro) => actualizar({ generoOtro })}
            />
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {motivo && <Text style={styles.hint}>{motivo}</Text>}

      <Button
        label={paso < TOTAL_PASOS ? 'Continuar' : 'Terminar'}
        onPress={handleContinuar}
        disabled={!!motivo}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[6],
    gap: spacing[3],
  },
  input: {
    ...textStyles.body,
    fontSize: fontSize.bodyLg,
    color: colors.foreground,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    minHeight: 44,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  opcion: {
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
  opcionSeleccionada: {
    borderColor: colors.primary,
  },
  opcionText: {
    ...textStyles.body,
    fontSize: fontSize.bodyLg,
    color: colors.foreground,
  },
  opcionTextSeleccionado: {
    color: colors.primary,
  },
  error: {
    ...textStyles.body,
    color: colors.destructiveText,
  },
  hint: {
    ...textStyles.body,
    color: colors.mutedForeground,
  },
});
