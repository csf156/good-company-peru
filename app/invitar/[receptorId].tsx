import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getOwnProfile, getPublicProfile, type PublicProfile } from '@/lib/profile';
import { getCatalogo, type Bebida } from '@/lib/tienda';
import { getDesglose, crearPropuesta, newIdempotencyKey, type Desglose } from '@/lib/invitaciones';
import { colors, fontFamily, tabularNums } from '@/lib/theme';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { SelectionGrid } from '@/components/SelectionGrid';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';

// Flujo de proponer (Fase E.3, Tarea 4) — dos pasos, no seis: elegir bebida
// (solo si soy rentador, tipo 'invitacion') y confirmar. Una `solicitud`
// (soy amigo) no lleva bebida — el rentador la asigna al aceptar (spec §4) —
// así que salta directo a confirmar. El total SIEMPRE sale de getDesglose
// (calcular_desglose en el servidor, E.3 Tarea 2): el cliente nunca calcula
// un importe, ni siquiera para mostrar un estimado.

export default function InvitarScreen() {
  const { receptorId } = useLocalSearchParams<{ receptorId: string }>();
  const router = useRouter();

  const [cargando, setCargando] = useState(true);
  const [tipo, setTipo] = useState<'invitacion' | 'solicitud'>('invitacion');
  const [contraparte, setContraparte] = useState<PublicProfile | null>(null);
  const [catalogo, setCatalogo] = useState<Bebida[]>([]);
  const [bebidaId, setBebidaId] = useState<string | null>(null);
  const [desglose, setDesglose] = useState<Desglose | null>(null);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guarda de doble-toque — ver handleEnviar.
  const enviandoRef = useRef(false);
  // Una sola key por intento (no por bebida, a diferencia de la vieja
  // Tienda): esta pantalla propone UNA cosa a la vez. Se reusa en cualquier
  // reintento — regenerarla en cada toque crearía una propuesta y un hold
  // nuevo sobre la tarjeta cada vez.
  const idempotencyKey = useRef(newIdempotencyKey());

  useEffect(() => {
    let activo = true;
    Promise.all([getOwnProfile(), getPublicProfile(receptorId), getCatalogo()]).then(
      ([own, otro, cat]) => {
        if (!activo) {
          return;
        }
        const esRentador = own?.rol === 'rentador';
        setTipo(esRentador ? 'invitacion' : 'solicitud');
        setContraparte(otro);
        setCatalogo(cat);
        setPaso(esRentador ? 1 : 2);
        setCargando(false);
      },
    );
    return () => {
      activo = false;
    };
  }, [receptorId]);

  async function elegirBebida(id: string) {
    setBebidaId(id);
    const d = await getDesglose(id);
    setDesglose(d);
    setPaso(2);
  }

  async function handleEnviar() {
    // Guarda por REF, no por estado: dos toques síncronos seguidos (antes de
    // que React re-renderice con `enviando=true` y el Button quede
    // `disabled`) llaman a este handler con la MISMA closure, así que un
    // `if (enviando)` leído del estado todavía vería `false` en el segundo.
    // `enviandoRef.current` se muta al toque, sin esperar un render.
    if (enviandoRef.current) {
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    setError(null);
    const result = await crearPropuesta({
      receptorId,
      tipo,
      bebidaCatalogoId: tipo === 'invitacion' ? bebidaId : null,
      tiempoEstimadoMin: null,
      zonaAproximada: null,
      idempotencyKey: idempotencyKey.current,
    });
    enviandoRef.current = false;
    setEnviando(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.back();
  }

  if (cargando) {
    return (
      <Screen background={colors.background} contentStyle={styles.content} center>
        <Text style={styles.hint}>Cargando…</Text>
      </Screen>
    );
  }

  if (paso === 1) {
    return (
      <Screen background={colors.background} scroll contentStyle={styles.content}>
        <StepHeader paso={1} total={2} titulo="Elige una bebida" onVolver={() => router.back()} />
        <SelectionGrid
          options={catalogo.map((b) => ({
            value: b.id,
            label: `${b.nombre} — S/ ${b.valor_v.toFixed(2)}`,
          }))}
          selected={bebidaId ? [bebidaId] : []}
          onChange={(vals) => {
            const id = vals[vals.length - 1] ?? null;
            if (id) {
              elegirBebida(id);
            }
          }}
          max={1}
        />
      </Screen>
    );
  }

  const bebidaElegida = catalogo.find((b) => b.id === bebidaId) ?? null;
  const etiquetaBoton = tipo === 'invitacion' ? 'Invitar' : 'Solicitar';

  return (
    <Screen background={colors.background} scroll contentStyle={styles.content}>
      <StepHeader
        paso={2}
        total={2}
        titulo="Confirmar"
        onVolver={() => (tipo === 'invitacion' ? setPaso(1) : router.back())}
      />

      <Text style={styles.label}>A quién</Text>
      <Text style={styles.valor}>{contraparte?.alias ?? '—'}</Text>

      {tipo === 'invitacion' && bebidaElegida && (
        <>
          <Text style={styles.label}>Bebida</Text>
          <Text style={styles.valor}>{bebidaElegida.nombre}</Text>
        </>
      )}

      {tipo === 'invitacion' && desglose && (
        <View style={styles.desglose}>
          <View style={styles.desgloseFila}>
            <Text style={styles.desgloseLabel}>Bebida</Text>
            <Text style={styles.desgloseMonto}>S/ {desglose.valorV.toFixed(2)}</Text>
          </View>
          <View style={styles.desgloseFila}>
            <Text style={styles.desgloseLabel}>Comisión</Text>
            <Text style={styles.desgloseMonto}>S/ {desglose.buyerFee.toFixed(2)}</Text>
          </View>
          <View style={[styles.desgloseFila, styles.desgloseTotalFila]}>
            <Text style={styles.desgloseTotalLabel}>Total</Text>
            <Text style={styles.desgloseTotalMonto}>S/ {desglose.total.toFixed(2)}</Text>
          </View>
        </View>
      )}

      {tipo === 'solicitud' && (
        <Text style={styles.hint}>
          Tu solicitud se envía sin bebida — {contraparte?.alias ?? 'la otra persona'} elige una y
          confirma el pago al aceptar.
        </Text>
      )}

      {error && (
        <View style={styles.errorRow}>
          <Icon name="alert-circle-outline" size="md" />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      <Button
        label={enviando ? 'Enviando…' : etiquetaBoton}
        onPress={handleEnviar}
        disabled={enviando}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 10,
  },
  label: {
    fontFamily: fontFamily.label,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    marginTop: 8,
  },
  valor: {
    fontFamily: fontFamily.display,
    fontStyle: 'italic',
    fontSize: 20,
    color: colors.foreground,
  },
  hint: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 8,
  },
  desglose: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  desgloseFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  desgloseLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  desgloseMonto: {
    fontFamily: fontFamily.label,
    ...tabularNums,
    fontSize: 13,
    color: colors.foreground,
  },
  desgloseTotalFila: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  desgloseTotalLabel: {
    fontFamily: fontFamily.label,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.foreground,
  },
  desgloseTotalMonto: {
    fontFamily: fontFamily.label,
    ...tabularNums,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  error: {
    flex: 1,
    color: colors.destructive,
    fontSize: 13,
  },
});
