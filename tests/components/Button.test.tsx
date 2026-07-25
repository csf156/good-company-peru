import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Button } from '@/components/Button';
import { colors, fontFamily } from '@/lib/theme';

describe('Button', () => {
  it('renders the label', async () => {
    await render(<Button label="Invitar" onPress={() => {}} />);
    expect(screen.getByText('Invitar')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<Button label="Invitar" onPress={onPress} />);
    fireEvent.press(screen.getByText('Invitar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Invitar" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Invitar'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes disabled state for accessibility', async () => {
    await render(<Button label="Invitar" onPress={() => {}} disabled />);
    const button = screen.getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('usa texto oscuro sobre el primary, que cumple AA', async () => {
    await render(<Button label="Invitar" onPress={() => {}} />);
    const label = screen.getByText('Invitar');
    const flatStyle = StyleSheet.flatten(label.props.style);
    expect(flatStyle.color).toBe(colors.primaryForeground);
  });

  it('la variante secondary es contorno, no relleno', async () => {
    await render(<Button label="Invitar" variant="secondary" onPress={() => {}} />);
    const label = screen.getByText('Invitar');
    expect(StyleSheet.flatten(label.props.style).color).toBe(colors.primary);
  });

  it('rotula en mayusculas con la tipografia de label', async () => {
    await render(<Button label="Invitar" onPress={() => {}} />);
    const flatStyle = StyleSheet.flatten(screen.getByText('Invitar').props.style);
    expect(flatStyle.fontFamily).toBe(fontFamily.label);
    expect(flatStyle.textTransform).toBe('uppercase');
  });
});
