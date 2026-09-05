import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { uploadDniDocument } from '@/lib/storage';
import { startKycVerification } from '@/lib/kyc';
import { registrarPasoKyc, registrarKycCompletado } from '@/lib/onboarding-analytics';
import { useProfileRefresh } from '@/lib/profile-context';
import { colors, spacing, fontSize, textStyles } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Icon } from '@/components/Icon';

const TOTAL_PASOS = 4;

const TITULOS: Record<number, string> = {
  1: 'Verifica tu identidad',
  2: 'Foto de tu DNI',
  3: 'Tu selfie',
  4: 'Listo',
};

type Resultado = { estado: 'verificado' } | { estado: 'pendiente' } | { estado: 'error'; motivo: string };

export default function KycScreen() {
  const router = useRouter();
  const refreshProfile = useProfileRefresh();
  const [paso, setPaso] = useState(1);
  const [dniPath, setDniPath] = useState<string | null>(null);
  const [selfiePath, setSelfiePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [refrescado, setRefrescado] = useState(false);
  // Cuántas veces se pidió verificar (1 al llegar al paso 4, +1 por cada
  // "Reintentar"). Dispara el efecto de abajo SIN que el efecto mismo lo
  // toque — ver por qué eso importa en el comentario del efecto.
  const [intento, setIntento] = useState(0);
  // Qué `intento` ya se procesó. Arranca en -1 (nunca coincide con el primer
  // `intento`, que es 0) para que la primera llegada al paso 4 sí dispare.
  // Es un ref, no estado: si fuera estado y entrara en las deps del efecto,
  // escribirlo DESDE el efecto (para marcar "ya arranqué") volvería a
  // dispararlo — el mismo bug que casi se cuela más abajo, solo que con un
  // guardián distinto.
  const intentoProcesadoRef = useRef(-1);

  useEffect(() => {
    registrarPasoKyc(paso as 1 | 2 | 3 | 4);
  }, [paso]);

  // La verificación arranca sola al llegar al paso 4: el usuario ya dio su
  // consentimiento capturando las dos fotos, y un botón más solo añadiría
  // fricción. En modo demo esto resuelve al instante — por eso NO hay
  // animación de análisis: sería teatro sobre un proceso que no ocurre.
  //
  // OJO con las deps: `resultado`/`verificando` NO van acá aunque el efecto
  // los lea. El efecto los ESCRIBE (`setResultado`, `setVerificando`) — si
  // también los leyera de las deps, escribirlos dispararía una re-ejecución
  // INMEDIATA cuyo cleanup pone `cancelado = true` en la ejecución original
  // ANTES de que `refreshProfile()` resuelva, y `setRefrescado(true)` nunca
  // llegaba a correr (se detectó con los tests: la verificación quedaba
  // eternamente en "Verificando…"). `intento` reemplaza a `resultado` como
  // disparador de reintento porque el usuario lo cambia desde afuera del
  // efecto (el botón "Reintentar"), nunca el efecto mismo.
  useEffect(() => {
    if (paso !== TOTAL_PASOS || !dniPath || !selfiePath) return;
    if (intentoProcesadoRef.current === intento) return;
    intentoProcesadoRef.current = intento;

    let cancelado = false;
    setVerificando(true);
    void (async () => {
      const r = await startKycVerification(dniPath, selfiePath);
      if (cancelado) return;

      if (r.error) {
        setResultado({ estado: 'error', motivo: r.error });
      } else if (r.estado === 'verificado') {
        registrarKycCompletado();
        // Se muestra el éxito de inmediato — el usuario ya no debe esperar
        // mirando un spinner. Lo que SÍ espera es la navegación: `refrescado`
        // se queda en `false` hasta que `refreshProfile()` resuelva, y el
        // botón "Ir al inicio" solo navega cuando es `true`. Sin esto,
        // _layout relee el perfil solo al cambiar de sesión y redirige con
        // el `kyc_estado` viejo — mismo bug que el alta, mismo arreglo.
        setResultado({ estado: 'verificado' });
        try {
          await refreshProfile();
        } catch {
          // Silencio deliberado: un refresco fallido no debe dejar al
          // usuario atrapado — `refrescado` igual pasa a `true` abajo.
        }
        if (!cancelado) setRefrescado(true);
      } else {
        setResultado({ estado: 'pendiente' });
      }
      if (!cancelado) setVerificando(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [paso, dniPath, selfiePath, intento, refreshProfile]);

  async function capturar(
    kind: 'dni' | 'selfie',
    cameraType: ImagePicker.CameraType,
    onCaptured: (path: string) => void,
  ) {
    setError(null);
    setCapturando(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Necesitamos acceso a tu cámara para continuar.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ quality: 0.8, cameraType });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const upload = await uploadDniDocument(kind, result.assets[0].uri);
      if (upload.error || !upload.path) {
        setError(upload.error ?? 'No se pudo subir la imagen.');
        return;
      }
      onCaptured(upload.path);
    } finally {
      setCapturando(false);
    }
  }

  // El motivo por el que NO se puede avanzar, o null si sí se puede. Mismo
  // patrón que validarPaso() del wizard de alta: el usuario siempre ve por qué
  // el botón está apagado, nunca se queda adivinando.
  function motivoBloqueo(): string | null {
    if (paso === 2 && !dniPath) return 'Toma la foto de tu DNI para continuar.';
    if (paso === 3 && !selfiePath) return 'Toma tu selfie para continuar.';
    return null;
  }

  const motivo = motivoBloqueo();

  function handleVolver() {
    setError(null);
    setPaso((p) => Math.max(1, p - 1));
  }

  function handleContinuar() {
    setError(null);
    setPaso((p) => Math.min(TOTAL_PASOS, p + 1));
  }

  return (
    <Screen scroll textured contentStyle={styles.content}>
      <StepHeader
        paso={paso}
        total={TOTAL_PASOS}
        titulo={TITULOS[paso] ?? ''}
        onVolver={paso > 1 && paso < TOTAL_PASOS ? handleVolver : undefined}
      />

      {paso === 1 && (
        <>
          <Text style={styles.parrafo}>
            Para cuidar a toda la comunidad, necesitamos confirmar que eres tú. Son dos fotos y
            toma menos de un minuto.
          </Text>
          <View style={styles.lista}>
            <View style={styles.item}>
              <Icon name="card-account-details-outline" size="md" />
              <Text style={styles.itemTexto}>Tu DNI, por el frente</Text>
            </View>
            <View style={styles.item}>
              <Icon name="account-outline" size="md" />
              <Text style={styles.itemTexto}>Una selfie tuya</Text>
            </View>
          </View>
        </>
      )}

      {paso === 2 && (
        <>
          <Text style={styles.parrafo}>
            Coloca tu DNI sobre una superficie plana y encuádralo completo. Que se lean bien los
            datos.
          </Text>
          <Button
            label={dniPath ? 'Volver a tomar' : 'Tomar foto del DNI'}
            variant={dniPath ? 'secondary' : 'primary'}
            onPress={() => capturar('dni', ImagePicker.CameraType.back, setDniPath)}
            disabled={capturando}
          />
          {dniPath && (
            <View style={styles.item}>
              <Icon name="check-circle-outline" size="md" />
              <Text style={styles.itemTexto}>DNI listo</Text>
            </View>
          )}
        </>
      )}

      {paso === 3 && (
        <>
          <Text style={styles.parrafo}>
            Busca un lugar con buena luz y mira a la cámara. Sin lentes de sol ni gorra.
          </Text>
          <Button
            label={selfiePath ? 'Volver a tomar' : 'Tomar selfie'}
            variant={selfiePath ? 'secondary' : 'primary'}
            onPress={() => capturar('selfie', ImagePicker.CameraType.front, setSelfiePath)}
            disabled={capturando}
          />
          {selfiePath && (
            <View style={styles.item}>
              <Icon name="check-circle-outline" size="md" />
              <Text style={styles.itemTexto}>Selfie lista</Text>
            </View>
          )}
        </>
      )}

      {paso === TOTAL_PASOS && (
        <>
          {verificando && !resultado && <Text style={styles.parrafo}>Verificando tu identidad…</Text>}

          {resultado?.estado === 'verificado' && (
            <>
              <View style={styles.item}>
                <Icon name="check-decagram-outline" size="md" />
                <Text style={styles.itemTexto}>Identidad verificada</Text>
              </View>
              <Button
                label="Ir al inicio"
                onPress={() => {
                  if (refrescado) router.replace('/');
                }}
              />
            </>
          )}

          {resultado?.estado === 'pendiente' && (
            <View style={styles.item}>
              <Icon name="clock-outline" size="md" />
              <Text style={styles.itemTexto}>
                Tu identidad está en revisión. Te avisamos apenas se confirme.
              </Text>
            </View>
          )}

          {resultado?.estado === 'error' && (
            <>
              <View style={styles.item}>
                <Icon name="alert-circle-outline" size="md" />
                <Text style={styles.error}>{resultado.motivo}</Text>
              </View>
              <Button
                label="Reintentar"
                onPress={() => {
                  setResultado(null);
                  setIntento((n) => n + 1);
                }}
              />
            </>
          )}
        </>
      )}

      {error && (
        <View style={styles.item}>
          <Icon name="alert-circle-outline" size="md" />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
      {motivo && <Text style={styles.hint}>{motivo}</Text>}

      {paso < TOTAL_PASOS && (
        <Button
          label={paso === 1 ? 'Empezar' : 'Continuar'}
          onPress={handleContinuar}
          disabled={!!motivo || capturando}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[6],
    gap: spacing[4],
  },
  parrafo: {
    ...textStyles.body,
    color: colors.mutedForeground,
  },
  lista: {
    gap: spacing[3],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  itemTexto: {
    ...textStyles.body,
    color: colors.foreground,
  },
  error: {
    ...textStyles.body,
    color: colors.destructiveText,
    flexShrink: 1,
  },
  hint: {
    ...textStyles.body,
    fontSize: fontSize.caption,
    color: colors.mutedForeground,
  },
});
