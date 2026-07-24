import { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getOwnProfile, updateOwnProfile, upsertPreferenciasSalida } from '@/lib/profile';
import { uploadProfilePhoto } from '@/lib/storage';
import { isValidEdad, parseListInput } from '@/lib/validation';
import { colors, typography } from '@/lib/theme';
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
    <Screen background={colors.light.bg} scroll contentStyle={styles.content}>
      <Text style={styles.title}>Completa tu perfil</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre completo"
        placeholderTextColor={colors.light.textMuted}
        value={nombre}
        onChangeText={setNombre}
      />
      <TextInput
        style={styles.input}
        placeholder="Alias"
        placeholderTextColor={colors.light.textMuted}
        value={alias}
        onChangeText={setAlias}
      />
      <TextInput
        style={styles.input}
        placeholder="Edad"
        placeholderTextColor={colors.light.textMuted}
        keyboardType="number-pad"
        value={edadText}
        onChangeText={setEdadText}
      />
      <TextInput
        style={styles.input}
        placeholder="Género"
        placeholderTextColor={colors.light.textMuted}
        value={genero}
        onChangeText={setGenero}
      />
      <TextInput
        style={styles.input}
        placeholder="Profesión"
        placeholderTextColor={colors.light.textMuted}
        value={profesion}
        onChangeText={setProfesion}
      />
      <TextInput
        style={styles.input}
        placeholder="Hobbies (separados por coma)"
        placeholderTextColor={colors.light.textMuted}
        value={hobbies}
        onChangeText={setHobbies}
      />
      <TextInput
        style={styles.input}
        placeholder="Intereses (separados por coma)"
        placeholderTextColor={colors.light.textMuted}
        value={intereses}
        onChangeText={setIntereses}
      />

      {rol === 'amigo' && (
        <TextInput
          style={styles.input}
          placeholder="Distritos (separados por coma)"
          placeholderTextColor={colors.light.textMuted}
          value={distritos}
          onChangeText={setDistritos}
        />
      )}

      <Button
        label={fotoPath ? 'Foto lista ✓' : 'Elegir foto'}
        variant="accent"
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
    padding: 24,
    gap: 12,
  },
  title: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginBottom: 8,
  },
  input: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.base,
    color: colors.light.text,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  error: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.danger,
  },
});
