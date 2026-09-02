import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

const PANEL_WIDTH = 120;
const DOT_SPACING = 16;
const DOT_SIZE = 2;

type SideTextureProps = {
  /** Alto del panel en px — normalmente el alto de la ventana. */
  height: number;
};

/**
 * Trama de puntos monocroma para los laterales del alta en pantallas
 * anchas (spec §1, decisión del usuario tras evaluar cuatro grados de
 * literalidad de "pixeles y blanco y negro" — eligió el más sutil).
 *
 * Sin imágenes ni dependencias nuevas: puntos como `View`s en una retícula
 * regular. Deliberadamente de bajo contraste — debe leerse como papel
 * texturado en penumbra, no como fondo de videojuego. Si al mirarlo lo
 * primero que se ve es la trama, está demasiado marcado.
 *
 * Memoizada porque la retícula es estática: con ~16px de espaciado y un
 * panel de ~120px de ancho, el total de puntos queda en el orden de
 * cientos (no miles) incluso para una ventana alta.
 */
export function SideTexture({ height }: SideTextureProps) {
  const puntos = useMemo(() => {
    const columnas = Math.floor(PANEL_WIDTH / DOT_SPACING);
    const filas = Math.ceil(height / DOT_SPACING);
    const lista: { x: number; y: number }[] = [];
    for (let fila = 0; fila < filas; fila++) {
      for (let columna = 0; columna < columnas; columna++) {
        lista.push({ x: columna * DOT_SPACING, y: fila * DOT_SPACING });
      }
    }
    return lista;
  }, [height]);

  return (
    <View
      style={styles.panel}
      testID="side-texture"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {puntos.map((punto, i) => (
        <View key={i} style={[styles.dot, { left: punto.x, top: punto.y }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: PANEL_WIDTH,
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.border,
    opacity: 0.4,
  },
});
