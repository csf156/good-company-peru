import type { ReactNode } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';
import { SideTexture } from '@/components/SideTexture';
import { useWindowSize } from '@/hooks/useWindowSize';

type ScreenProps = {
  children: ReactNode;
  /**
   * Color de fondo de la pantalla. Por defecto el de la paleta; se pasa
   * explícito solo cuando una pantalla necesita otra superficie.
   */
  background?: string;
  /** Envuelve el contenido en un ScrollView (contenido largo / con teclado). */
  scroll?: boolean;
  /** Centra el contenido verticalmente (formularios cortos). */
  center?: boolean;
  /** Estilos del contenedor de contenido (padding, gap propios de la pantalla). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Bordes seguros a respetar. Default: superior e inferior. */
  edges?: readonly Edge[];
  testID?: string;
  /**
   * Ancho máximo centrado en pantallas anchas — pedido del usuario para
   * TODA la app tras verlo estirarse de borde a borde en escritorio
   * (bloque 2b, extensión). Default `true`: cualquier pantalla nueva lo
   * hereda sin que nadie tenga que acordarse de pedirlo. Usar
   * `framed={false}` solo si una pantalla concreta necesita el ancho
   * completo genuinamente — repórtalo si lo usas, es la señal de que
   * `MAX_CONTENT_WIDTH` puede estar corto para ese contenido.
   */
  framed?: boolean;
  /**
   * Textura lateral de puntos en los paneles que deja `framed`. Solo tiene
   * efecto si `framed` es `true`. Default `false` — a diferencia del ancho
   * máximo, el usuario no pidió esto para toda la app, solo para el alta;
   * extenderla es decisión de diseño, no un pedido suyo.
   */
  textured?: boolean;
};

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom'];
/** ~520px de contenido legible; por encima de ~900px de viewport hay lateral que decorar. */
const MAX_CONTENT_WIDTH = 520;
const WIDE_BREAKPOINT = 900;

/**
 * Andamiaje mobile-first compartido: área segura (notch / home-indicator),
 * manejo de teclado, y scroll opcional. Una sola responsabilidad — layout
 * seguro — para que ninguna pantalla repita este boilerplate ni lo olvide.
 */
export function Screen({
  children,
  background = colors.background,
  scroll = false,
  center = false,
  contentStyle,
  edges = DEFAULT_EDGES,
  testID,
  framed = true,
  textured = false,
}: ScreenProps) {
  const { width, height } = useWindowSize();
  const contentJustify = center ? styles.center : undefined;
  const showTexture = framed && textured && width >= WIDE_BREAKPOINT;

  const inner = scroll ? (
    <ScrollView
      testID="screen-scroll"
      style={styles.fill}
      contentContainerStyle={[styles.scrollContent, contentJustify, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, contentJustify, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: background }]} edges={edges} testID={testID}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {framed ? (
          <View style={styles.framedRow} testID="screen-framed-row">
            {showTexture && <SideTexture height={height} />}
            <View style={[styles.framedContent]} testID="screen-content">
              {inner}
            </View>
            {showTexture && <SideTexture height={height} />}
          </View>
        ) : (
          inner
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  framedRow: {
    flex: 1,
    flexDirection: 'row',
    // `framedRow` es fila, así que su eje principal es el horizontal —
    // `alignSelf: 'center'` en `framedContent` solo centra el eje
    // transversal (vertical). Sin esto, el contenido (limitado a
    // `maxWidth` vía flex:1) queda pegado al inicio y el sobrante horizontal
    // cae entero a la derecha.
    justifyContent: 'center',
  },
  framedContent: {
    flex: 1,
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  center: {
    justifyContent: 'center',
  },
});
