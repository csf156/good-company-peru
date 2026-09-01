import { useEffect, useState } from 'react';
import { Text, TextInput, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getOwnProfile, updateOwnProfile, type OwnProfile } from '@/lib/profile';
import { getPhotoSignedUrl, uploadProfilePhoto } from '@/lib/storage';
import { parseListInput } from '@/lib/validation';
import { colors, radius, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

export default function OwnProfileScreen() {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [nombre, setNombre] = useState('');
  const [alias, setAlias] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [genero, setGenero] = useState('');
  const [profesion, setProfesion] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [intereses, setIntereses] = useState('');
  const [newFotoPath, setNewFotoPath] = useState<string | null>(null);

  useEffect(() => {
    getOwnProfile().then(async (data) => {
      setProfile(data);
      if (data?.foto_url) {
        const signed = await getPhotoSignedUrl(data.foto_url);
        setPhotoUrl(signed.url);
      }
    });
  }, []);

  function startEditing() {
    if (!profile) return;
    setNombre(profile.nombre ?? '');
    setAlias(profile.alias ?? '');
    setFechaNacimiento(profile.fecha_nacimiento ?? '');
    setGenero(profile.genero ?? '');
    setProfesion(profile.profesion ?? '');
    setHobbies((profile.hobbies ?? []).join(', '));
    setIntereses((profile.tipo_salida ?? []).join(', '));
    setNewFotoPath(null);
    setError(null);
    setEditing(true);
  }

  async function handleChangePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Necesitamos acceso a tus fotos para continuar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;

    const upload = await uploadProfilePhoto(result.assets[0].uri);
    if (upload.error || !upload.path) {
      setError(upload.error ?? 'No se pudo subir la foto.');
      return;
    }
    setNewFotoPath(upload.path);
  }

  async function handleSave() {
    setError(null);
    setLoading(true);
    const fields = {
      nombre: nombre.trim(),
      alias: alias.trim(),
      fecha_nacimiento: fechaNacimiento,
      genero: genero.trim(),
      profesion: profesion.trim(),
      hobbies: parseListInput(hobbies),
      tipo_salida: parseListInput(intereses),
      ...(newFotoPath ? { foto_url: newFotoPath } : {}),
    };

    const result = await updateOwnProfile(fields);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setProfile((prev) => (prev ? { ...prev, ...fields } : prev));
    if (newFotoPath) {
      const signed = await getPhotoSignedUrl(newFotoPath);
      setPhotoUrl(signed.url);
    }
    setEditing(false);
  }

  if (!profile) {
    return (
      <Screen center contentStyle={styles.content}>
        <Text style={styles.subtitle}>Cargando…</Text>
      </Screen>
    );
  }

  if (!editing) {
    return (
      <Screen scroll contentStyle={styles.content}>
        {photoUrl && <Image source={{ uri: photoUrl }} style={styles.photo} />}
        <Text style={styles.title}>{profile.nombre}</Text>
        <Text style={styles.subtitle}>{profile.alias}</Text>
        {profile.kyc_estado === 'verificado' && (
          <Text style={styles.badge}>Verificado ✓</Text>
        )}
        <Text style={styles.field}>{profile.fecha_nacimiento} · {profile.genero}</Text>
        <Text style={styles.field}>{profile.profesion}</Text>
        <Button label="Editar" onPress={startEditing} />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text style={styles.title}>Editar perfil</Text>

      <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />
      <TextInput style={styles.input} value={alias} onChangeText={setAlias} />
      <TextInput
        style={styles.input}
        value={fechaNacimiento}
        onChangeText={setFechaNacimiento}
      />
      <TextInput style={styles.input} value={genero} onChangeText={setGenero} />
      <TextInput style={styles.input} value={profesion} onChangeText={setProfesion} />
      <TextInput style={styles.input} value={hobbies} onChangeText={setHobbies} />
      <TextInput style={styles.input} value={intereses} onChangeText={setIntereses} />

      <Button
        label={newFotoPath ? 'Foto lista ✓' : 'Cambiar foto'}
        variant="secondary"
        onPress={handleChangePhoto}
        disabled={loading}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Guardar" onPress={handleSave} disabled={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[6],
    gap: spacing[3],
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  title: {
    ...textStyles.display,
    fontSize: fontSize.display,
    color: colors.foreground,
    textAlign: 'center',
  },
  subtitle: {
    ...textStyles.label,
    fontSize: fontSize.tiny,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  badge: {
    ...textStyles.bodySemiBold,
    color: colors.success,
    textAlign: 'center',
  },
  field: {
    ...textStyles.body,
    color: colors.foreground,
    textAlign: 'center',
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
