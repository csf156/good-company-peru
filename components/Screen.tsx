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

type ScreenProps = {
  children: ReactNode;
  /**
   * Color de fondo de la pantalla. Explícito (sin default) para que cada
   * pantalla conserve su paleta: las 1.x claras pasan `colors.light.bg`, las
   * 3.x/4.x oscuras pasan `ayni.background`. El primitivo es palette-agnóstico.
   */
  background: string;
  /** Envuelve el contenido en un ScrollView (contenido largo / con teclado). */
  scroll?: boolean;
  /** Centra el contenido verticalmente (formularios cortos). */
  center?: boolean;
  /** Estilos del contenedor de contenido (padding, gap propios de la pantalla). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Bordes seguros a respetar. Default: superior e inferior. */
  edges?: readonly Edge[];
  testID?: string;
};

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom'];

/**
 * Andamiaje mobile-first compartido: área segura (notch / home-indicator),
 * manejo de teclado, y scroll opcional. Una sola responsabilidad — layout
 * seguro — para que ninguna pantalla repita este boilerplate ni lo olvide.
 */
export function Screen({
  children,
  background,
  scroll = false,
  center = false,
  contentStyle,
  edges = DEFAULT_EDGES,
  testID,
}: ScreenProps) {
  const contentJustify = center ? styles.center : undefined;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: background }]} edges={edges} testID={testID}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
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
  center: {
    justifyContent: 'center',
  },
});
