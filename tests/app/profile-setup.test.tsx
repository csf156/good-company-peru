import { render, screen, fireEvent } from '@testing-library/react-native';
import ProfileSetupScreen from '@/app/(auth)/profile-setup';

describe('ProfileSetupScreen — navegación (pasos 1-3)', () => {
  it('arranca en el paso 1 de 7', async () => {
    await render(<ProfileSetupScreen />);
    expect(await screen.findByText('Paso 1 de 7')).toBeTruthy();
  });

  it('no avanza con el paso inválido y dice por qué', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await fireEvent.press(screen.getByText('Continuar'));

    expect(screen.getByText('Paso 1 de 7')).toBeTruthy();
    expect(screen.getByText(/completa tu nombre y alias/i)).toBeTruthy();
  });

  it('avanza cuando el paso es válido', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), 'Ana Torres');
    await fireEvent.changeText(screen.getByPlaceholderText('Alias'), 'ana');
    await fireEvent.press(screen.getByText('Continuar'));

    expect(await screen.findByText('Paso 2 de 7')).toBeTruthy();
  });

  it('retroceder conserva lo ingresado', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), 'Ana Torres');
    await fireEvent.changeText(screen.getByPlaceholderText('Alias'), 'ana');
    await fireEvent.press(screen.getByText('Continuar'));
    await screen.findByText('Paso 2 de 7');

    await fireEvent.press(screen.getByLabelText('Volver'));

    expect(await screen.findByDisplayValue('Ana Torres')).toBeTruthy();
  });

  it('el paso 1 no muestra botón de volver', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');
    expect(screen.queryByLabelText('Volver')).toBeNull();
  });

  it('el género "Otro" exige texto', async () => {
    await render(<ProfileSetupScreen />);
    await screen.findByText('Paso 1 de 7');

    await fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), 'Ana Torres');
    await fireEvent.changeText(screen.getByPlaceholderText('Alias'), 'ana');
    await fireEvent.press(screen.getByText('Continuar'));
    await screen.findByText('Paso 2 de 7');

    await fireEvent.press(screen.getByLabelText('Día'));
    await fireEvent.press(screen.getByText('5'));
    await fireEvent.press(screen.getByLabelText('Mes'));
    await fireEvent.press(screen.getByText('marzo'));
    await fireEvent.press(screen.getByLabelText('Año'));
    await fireEvent.press(screen.getByText('2000'));
    await fireEvent.press(screen.getByText('Continuar'));
    await screen.findByText('Paso 3 de 7');

    await fireEvent.press(screen.getByText('Otro'));
    await fireEvent.press(screen.getByText('Continuar'));

    expect(screen.getByText('Paso 3 de 7')).toBeTruthy();
    expect(screen.getByText(/escribe tu género/i)).toBeTruthy();
  });
});
