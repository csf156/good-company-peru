import { render, screen } from '@testing-library/react-native';
import { Icon } from '@/components/Icon';

describe('Icon', () => {
  it('expone un label accesible cuando se le da uno', async () => {
    await render(<Icon name="bike" accessibilityLabel="Bicicleta" />);
    expect(screen.getByLabelText('Bicicleta')).toBeTruthy();
  });

  it('es decorativo por defecto (oculto para lectores de pantalla)', async () => {
    await render(<Icon name="bike" testID="icono" />);
    expect(screen.getByTestId('icono', { hidden: true }).props.accessibilityElementsHidden).toBe(
      true,
    );
  });
});
