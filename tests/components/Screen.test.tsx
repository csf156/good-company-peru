import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { colors } from '@/lib/theme';
import { useWindowSize } from '@/hooks/useWindowSize';

// Se mockea el wrapper local (@/hooks/useWindowSize), no `useWindowDimensions`
// de 'react-native' directo: mockear el hook nativo rompe la inicialización
// de módulos internos de React Native bajo jest-expo (DevMenu y compañía).
jest.mock('@/hooks/useWindowSize', () => ({ useWindowSize: jest.fn() }));

const mockedUseWindowDimensions = useWindowSize as jest.Mock;

beforeEach(() => {
  mockedUseWindowDimensions.mockReturnValue({
    width: 1280,
    height: 900,
    scale: 1,
    fontScale: 1,
  });
});

describe('Screen', () => {
  it('renders its children', async () => {
    await render(
      <Screen background="#111111">
        <Text>Hola</Text>
      </Screen>,
    );
    expect(screen.getByText('Hola')).toBeTruthy();
  });

  it('applies the given background so each screen keeps its own palette', async () => {
    await render(
      <Screen background="#FAF7F2" testID="scr">
        <Text>x</Text>
      </Screen>,
    );
    const root = screen.getByTestId('scr');
    const flat = StyleSheet.flatten(root.props.style);
    expect(flat.backgroundColor).toBe('#FAF7F2');
    expect(flat.flex).toBe(1);
  });

  it('wraps content in a ScrollView when scroll is set (long/keyboard content)', async () => {
    await render(
      <Screen background="#111" scroll>
        <Text>contenido</Text>
      </Screen>,
    );
    expect(screen.getByTestId('screen-scroll')).toBeTruthy();
  });

  it('does not use a ScrollView by default', async () => {
    await render(
      <Screen background="#111">
        <Text>contenido</Text>
      </Screen>,
    );
    expect(screen.queryByTestId('screen-scroll')).toBeNull();
  });

  it('usa el fondo de la paleta por defecto', async () => {
    await render(
      <Screen testID="pantalla">
        <Text>hola</Text>
      </Screen>,
    );
    const root = screen.getByTestId('pantalla');
    expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe(colors.background);
  });

  describe('framed', () => {
    it('limita el ancho del contenido y lo centra por defecto', async () => {
      await render(
        <Screen>
          <Text>hola</Text>
        </Screen>,
      );
      const contenido = screen.getByTestId('screen-content');
      expect(contenido.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ maxWidth: expect.any(Number) })]),
      );
    });

    it('framed={false} quita el ancho máximo para la pantalla que genuinamente necesite todo el ancho', async () => {
      await render(
        <Screen framed={false}>
          <Text>hola</Text>
        </Screen>,
      );
      expect(screen.queryByTestId('screen-content')).toBeNull();
    });

    it('centra el contenido horizontalmente, no solo lo acota', async () => {
      // La fila que envuelve el contenido (y los paneles de textura) es
      // flexDirection:'row' — su eje principal es horizontal.
      // `alignSelf:'center'` en el contenido solo centra el eje transversal
      // (vertical); sin `justifyContent:'center'` en la fila, el contenido
      // acotado por maxWidth queda pegado a la izquierda y el sobrante cae
      // entero a la derecha. Este test falla con solo el `maxWidth` puesto,
      // que es justo lo que dejó pasar el bug en preview.
      await render(
        <Screen>
          <Text>hola</Text>
        </Screen>,
      );
      const fila = screen.getByTestId('screen-framed-row');
      expect(StyleSheet.flatten(fila.props.style).justifyContent).toBe('center');
    });

    it('sin textured no muestra textura lateral aunque la pantalla sea ancha', async () => {
      mockedUseWindowDimensions.mockReturnValue({ width: 1280, height: 900, scale: 1, fontScale: 1 });
      await render(
        <Screen>
          <Text>hola</Text>
        </Screen>,
      );
      expect(screen.queryByTestId('side-texture')).toBeNull();
    });
  });

  describe('textured', () => {
    it('no muestra textura lateral en pantallas angostas', async () => {
      mockedUseWindowDimensions.mockReturnValue({ width: 375, height: 812, scale: 1, fontScale: 1 });
      await render(
        <Screen textured>
          <Text>hola</Text>
        </Screen>,
      );
      expect(screen.queryByTestId('side-texture')).toBeNull();
    });

    it('muestra textura lateral en pantallas anchas', async () => {
      mockedUseWindowDimensions.mockReturnValue({ width: 1280, height: 900, scale: 1, fontScale: 1 });
      await render(
        <Screen textured>
          <Text>hola</Text>
        </Screen>,
      );
      expect(screen.getAllByTestId('side-texture', { hidden: true })).toHaveLength(2);
    });

    it('los dos paneles laterales tienen el mismo ancho (nada de asimetría izquierda/derecha)', async () => {
      mockedUseWindowDimensions.mockReturnValue({ width: 1280, height: 900, scale: 1, fontScale: 1 });
      await render(
        <Screen textured>
          <Text>hola</Text>
        </Screen>,
      );
      const [izquierdo, derecho] = screen.getAllByTestId('side-texture', { hidden: true });
      const anchoIzquierdo = StyleSheet.flatten(izquierdo?.props.style).width;
      const anchoDerecho = StyleSheet.flatten(derecho?.props.style).width;
      expect(anchoIzquierdo).toBe(anchoDerecho);
      expect(anchoIzquierdo).toEqual(expect.any(Number));
    });

    it('la textura es decorativa para lectores de pantalla', async () => {
      mockedUseWindowDimensions.mockReturnValue({ width: 1280, height: 900, scale: 1, fontScale: 1 });
      await render(
        <Screen textured>
          <Text>hola</Text>
        </Screen>,
      );
      const [primerPanel] = screen.getAllByTestId('side-texture', { hidden: true });
      expect(primerPanel?.props.accessibilityElementsHidden).toBe(true);
    });

    it('no tiene efecto si framed está desactivado', async () => {
      mockedUseWindowDimensions.mockReturnValue({ width: 1280, height: 900, scale: 1, fontScale: 1 });
      await render(
        <Screen framed={false} textured>
          <Text>hola</Text>
        </Screen>,
      );
      expect(screen.queryByTestId('side-texture')).toBeNull();
    });
  });
});
