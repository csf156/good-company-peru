import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { colors } from '@/lib/theme';

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
});
