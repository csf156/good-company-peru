import { useEffect, useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getOwnProfile } from '@/lib/profile';
import { uploadProfilePhoto } from '@/lib/storage';
import { isMayorDeEdad, parseListInput } from '@/lib/validation';
import { colors, radius, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Icon } from '@/components/Icon';
import { DateOfBirthPicker } from '@/components/DateOfBirthPicker';
import { SelectionGrid } from '@/components/SelectionGrid';
import { HOBBIES, TIPOS_SALIDA, DISTRITOS } from '@/lib/onboarding-options';
import type { RolUsuario } from '@/lib/auth';

const GENERO_OPCIONES = ['Mujer', 'Hombre', 'No binario', 'Prefiero no decirlo', 'Otro'] as const;

const MAX_HOBBIES = 5;
const MAX_TIPO_SALIDA = 2;
const MAX_DISTRITOS = 5;

const DISTRITO_OPCIONES = DISTRITOS.map((distrito) => ({ value: distrito, label: distrito }));

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

/** Única fuente de verdad de si se puede avanzar. Pura y testeable aparte de la UI. */
function validarPaso(paso: number, datos: Datos): string | null {
  switch (paso) {
    case 1:
      return !datos.nombre.trim() || !datos.alias.trim() ? 'Completa tu nombre y alias.' : null;
    case 2:
      if (!datos.fechaNacimiento) return 'Ingresa tu fecha de nacimiento.';
      return isMayorDeEdad(datos.fechaNacimiento) ? null : 'Debes ser mayor de 18 años.';
    case 3:
      if (!datos.genero) return 'Elige una opción.';
      return datos.genero === 'Otro' && !datos.generoOtro.trim() ? 'Escribe tu género.' : null;
    case 4:
      return datos.fotoPath ? null : 'Sube una foto de perfil.';
    case 5: {
      const total = datos.hobbies.length + parseListInput(datos.hobbiesOtroTexto).length;
      return total >= 1 ? null : 'Elige al menos un hobby.';
    }
    case 6:
      return datos.tipoSalida.length >= 1 ? null : 'Elige al menos un tipo de salida.';
    case 7:
      return datos.distritos.length >= 1 ? null : 'Elige al menos un distrito.';
    default:
      return null;
  }
}

export default function ProfileSetupScreen() {
  const [rol, setRol] = useState<RolUsuario | null>(null);
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState<Datos>(DATOS_INICIALES);
  const [error, setError] = useState<string | null>(null);
  const [otroHobbiesAbierto, setOtroHobbiesAbierto] = useState(false);

  useEffect(() => {
    getOwnProfile().then((profile) => {
      if (profile) setRol(profile.rol);
    });
  }, []);

  // El paso de distritos (7) es solo para el amigo — es "dónde se le puede
  // encontrar", no algo que le importe a quien renta. El rentador recorre
  // un wizard de 6 pasos, no 7 con uno vacío al final.
  const totalPasos = rol === 'rentador' ? 6 : 7;

  function actualizar(cambios: Partial<Datos>) {
    setDatos((prev) => ({ ...prev, ...cambios }));
  }

  const motivo = validarPaso(paso, datos);

  const otroHobbiesCount = parseListInput(datos.hobbiesOtroTexto).length;

  function handleVolver() {
    setError(null);
    setPaso((p) => Math.max(1, p - 1));
  }

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Necesitamos acceso a tus fotos para continuar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const upload = await uploadProfilePhoto(result.assets[0].uri);
    if (upload.error || !upload.path) {
      setError(upload.error ?? 'No se pudo subir la foto.');
      return;
    }
    actualizar({ fotoPath: upload.path });
    setError(null);
  }

  function handleContinuar() {
    if (motivo) return;
    setError(null);

    if (paso < totalPasos) {
      setPaso((p) => p + 1);
      return;
    }

    // La persistencia final llega en la Tarea 6.
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <StepHeader
        paso={paso}
        total={totalPasos}
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
        <DateOfBirthPicker
          value={datos.fechaNacimiento || null}
          onChange={(fechaNacimiento) => actualizar({ fechaNacimiento })}
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

      {paso === 4 && (
        <Button
          label={datos.fotoPath ? 'Foto lista ✓' : 'Elegir foto'}
          variant="secondary"
          onPress={handlePickPhoto}
        />
      )}

      {paso === 5 && (
        <>
          <SelectionGrid
            options={HOBBIES}
            selected={datos.hobbies}
            onChange={(hobbies) => actualizar({ hobbies })}
            max={Math.max(0, MAX_HOBBIES - otroHobbiesCount)}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setOtroHobbiesAbierto(true)}
            style={styles.otroBoton}
          >
            <Text style={styles.otroBotonTexto}>Otro</Text>
          </Pressable>
          {otroHobbiesAbierto && (
            <TextInput
              style={styles.input}
              placeholder="Otros hobbies, separados por coma"
              placeholderTextColor={colors.mutedForeground}
              value={datos.hobbiesOtroTexto}
              onChangeText={(hobbiesOtroTexto) => actualizar({ hobbiesOtroTexto })}
            />
          )}
        </>
      )}

      {paso === 6 && (
        <SelectionGrid
          options={TIPOS_SALIDA}
          selected={datos.tipoSalida}
          onChange={(tipoSalida) => actualizar({ tipoSalida })}
          max={MAX_TIPO_SALIDA}
        />
      )}

      {paso === 7 && (
        <SelectionGrid
          options={DISTRITO_OPCIONES}
          selected={datos.distritos}
          onChange={(distritos) => actualizar({ distritos })}
          max={MAX_DISTRITOS}
          searchable
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {motivo && <Text style={styles.hint}>{motivo}</Text>}

      <Button
        label={paso < totalPasos ? 'Continuar' : 'Terminar'}
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
  otroBoton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
  },
  otroBotonTexto: {
    ...textStyles.bodyMedium,
    color: colors.primary,
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
