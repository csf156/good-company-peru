import { useEffect, useState } from 'react';
import { Text, TextInput, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getOwnProfile, updateOwnProfile, type OwnProfile } from '@/lib/profile';
import { getPhotoSignedUrl, uploadProfilePhoto } from '@/lib/storage';
import { parseListInput } from '@/lib/validation';
import { colors, typography } from '@/lib/theme';
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
  const [edadText, setEdadText] = useState('');
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
    setEdadText(profile.edad ? String(profile.edad) : '');
    setGenero(profile.genero ?? '');
    setProfesion(profile.profesion ?? '');
    setHobbies((profile.hobbies ?? []).join(', '));
    setIntereses((profile.intereses ?? []).join(', '));
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
      edad: Number(edadText),
      genero: genero.trim(),
      profesion: profesion.trim(),
      hobbies: parseListInput(hobbies),
      intereses: parseListInput(intereses),
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
      <Screen background={colors.light.bg} center contentStyle={styles.content}>
        <Text style={styles.subtitle}>Cargando…</Text>
      </Screen>
    );
  }

  if (!editing) {
    return (
      <Screen background={colors.light.bg} scroll contentStyle={styles.content}>
        {photoUrl && <Image source={{ uri: photoUrl }} style={styles.photo} />}
        <Text style={styles.title}>{profile.nombre}</Text>
        <Text style={styles.subtitle}>{profile.alias}</Text>
        {profile.kyc_estado === 'verificado' && (
          <Text style={styles.badge}>Verificado ✓</Text>
        )}
        <Text style={styles.field}>{profile.edad} años · {profile.genero}</Text>
        <Text style={styles.field}>{profile.profesion}</Text>
        <Button label="Editar" onPress={startEditing} />
      </Screen>
    );
  }

  return (
    <Screen background={colors.light.bg} scroll contentStyle={styles.content}>
      <Text style={styles.title}>Editar perfil</Text>

      <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />
      <TextInput style={styles.input} value={alias} onChangeText={setAlias} />
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={edadText}
        onChangeText={setEdadText}
      />
      <TextInput style={styles.input} value={genero} onChangeText={setGenero} />
      <TextInput style={styles.input} value={profesion} onChangeText={setProfesion} />
      <TextInput style={styles.input} value={hobbies} onChangeText={setHobbies} />
      <TextInput style={styles.input} value={intereses} onChangeText={setIntereses} />

      <Button
        label={newFotoPath ? 'Foto lista ✓' : 'Cambiar foto'}
        variant="accent"
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
    padding: 24,
    gap: 10,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
  },
  title: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  badge: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.success,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  field: {
    fontFamily: typography.fontFamily.body,
    color: colors.light.text,
    textAlign: 'center',
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
