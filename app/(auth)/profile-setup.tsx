import { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getOwnProfile, updateOwnProfile, upsertPreferenciasSalida } from '@/lib/profile';
import { uploadProfilePhoto } from '@/lib/storage';
import { isValidEdad, parseListInput } from '@/lib/validation';
import { colors, radius, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import type { RolUsuario } from '@/lib/auth';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const [rol, setRol] = useState<RolUsuario | null>(null);

  const [nombre, setNombre] = useState('');
  const [alias, setAlias] = useState('');
  const [edadText, setEdadText] = useState('');
  const [genero, setGenero] = useState('');
  const [profesion, setProfesion] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [intereses, setIntereses] = useState('');
  const [distritos, setDistritos] = useState('');
  const [fotoPath, setFotoPath] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getOwnProfile().then((profile) => {
      if (profile) setRol(profile.rol);
    });
  }, []);

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
    setFotoPath(upload.path);
    setError(null);
  }

  async function handleSubmit() {
    setError(null);
    const edad = Number(edadText);

    if (!nombre.trim() || !alias.trim() || !genero.trim() || !profesion.trim() || !fotoPath) {
      setError('Completa todos los campos obligatorios.');
      return;
    }
    if (!isValidEdad(edad)) {
      setError('Debes ser mayor de 18 años.');
      return;
    }

    setLoading(true);
    const result = await updateOwnProfile({
      nombre: nombre.trim(),
      alias: alias.trim(),
      edad,
      genero: genero.trim(),
      profesion: profesion.trim(),
      hobbies: parseListInput(hobbies),
      intereses: parseListInput(intereses),
      foto_url: fotoPath,
    });

    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }

    if (rol === 'amigo') {
      const prefsResult = await upsertPreferenciasSalida({ distritos: parseListInput(distritos) });
      setLoading(false);
      if (prefsResult.error) {
        setError(prefsResult.error);
        return;
      }
    } else {
      setLoading(false);
    }

    router.replace('/');
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Tu perfil</Text>
      <Text style={styles.title}>Completa tu perfil</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre completo"
        placeholderTextColor={colors.mutedForeground}
        value={nombre}
        onChangeText={setNombre}
      />
      <TextInput
        style={styles.input}
        placeholder="Alias"
        placeholderTextColor={colors.mutedForeground}
        value={alias}
        onChangeText={setAlias}
      />
      <TextInput
        style={styles.input}
        placeholder="Edad"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="number-pad"
        value={edadText}
        onChangeText={setEdadText}
      />
      <TextInput
        style={styles.input}
        placeholder="Género"
        placeholderTextColor={colors.mutedForeground}
        value={genero}
        onChangeText={setGenero}
      />
      <TextInput
        style={styles.input}
        placeholder="Profesión"
        placeholderTextColor={colors.mutedForeground}
        value={profesion}
        onChangeText={setProfesion}
      />
      <TextInput
        style={styles.input}
        placeholder="Hobbies (separados por coma)"
        placeholderTextColor={colors.mutedForeground}
        value={hobbies}
        onChangeText={setHobbies}
      />
      <TextInput
        style={styles.input}
        placeholder="Intereses (separados por coma)"
        placeholderTextColor={colors.mutedForeground}
        value={intereses}
        onChangeText={setIntereses}
      />

      {rol === 'amigo' && (
        <TextInput
          style={styles.input}
          placeholder="Distritos (separados por coma)"
          placeholderTextColor={colors.mutedForeground}
          value={distritos}
          onChangeText={setDistritos}
        />
      )}

      <Button
        label={fotoPath ? 'Foto lista ✓' : 'Elegir foto'}
        variant="secondary"
        onPress={handlePickPhoto}
        disabled={loading}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Continuar" onPress={handleSubmit} disabled={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[6],
    gap: spacing[3],
  },
  eyebrow: {
    ...textStyles.label,
    fontSize: fontSize.caption,
    color: colors.primary,
  },
  title: {
    ...textStyles.displaySemiBold,
    fontSize: fontSize.heading,
    color: colors.foreground,
    marginBottom: spacing[2],
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
  error: {
    ...textStyles.body,
    color: colors.destructiveText,
  },
});
