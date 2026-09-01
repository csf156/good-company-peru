import { render, screen, fireEvent } from '@testing-library/react-native';
import { DateOfBirthPicker } from '@/components/DateOfBirthPicker';

describe('DateOfBirthPicker', () => {
  it('emite YYYY-MM-DD al completar los tres campos', async () => {
    const onChange = jest.fn();
    await render(<DateOfBirthPicker value={null} onChange={onChange} />);

    await fireEvent.press(screen.getByLabelText('Día'));
    await fireEvent.press(screen.getByText('5'));

    await fireEvent.press(screen.getByLabelText('Mes'));
    await fireEvent.press(screen.getByText('marzo'));

    await fireEvent.press(screen.getByLabelText('Año'));
    await fireEvent.press(screen.getByText('1995'));

    expect(onChange).toHaveBeenLastCalledWith('1995-03-05');
  });

  it('rellena con cero a la izquierda', async () => {
    const onChange = jest.fn();
    await render(<DateOfBirthPicker value={null} onChange={onChange} />);

    await fireEvent.press(screen.getByLabelText('Día'));
    await fireEvent.press(screen.getByText('5'));

    await fireEvent.press(screen.getByLabelText('Mes'));
    await fireEvent.press(screen.getByText('marzo'));

    await fireEvent.press(screen.getByLabelText('Año'));
    await fireEvent.press(screen.getByText('2001'));

    expect(onChange).toHaveBeenLastCalledWith('2001-03-05');
    expect(onChange).not.toHaveBeenLastCalledWith('2001-3-5');
  });

  it('no ofrece 29 de febrero cuando el año todavía no se eligió', async () => {
    const onChange = jest.fn();
    await render(<DateOfBirthPicker value={null} onChange={onChange} />);

    await fireEvent.press(screen.getByLabelText('Mes'));
    await fireEvent.press(screen.getByText('febrero'));

    await fireEvent.press(screen.getByLabelText('Día'));
    expect(screen.getByText('28')).toBeTruthy();
    expect(screen.queryByText('29')).toBeNull();
  });

  it('recorta el día ya elegido si deja de existir al cambiar a un mes más corto', async () => {
    const onChange = jest.fn();
    await render(<DateOfBirthPicker value={null} onChange={onChange} />);

    await fireEvent.press(screen.getByLabelText('Mes'));
    await fireEvent.press(screen.getByText('enero'));
    await fireEvent.press(screen.getByLabelText('Día'));
    await fireEvent.press(screen.getByText('31'));

    await fireEvent.press(screen.getByLabelText('Mes'));
    await fireEvent.press(screen.getByText('febrero'));

    // El propio selector de Día ya refleja el recorte automático.
    expect(await screen.findByLabelText('Día')).toHaveTextContent('28', { exact: false });
    expect(screen.queryByText('31')).toBeNull();
  });

  it('no emite nada mientras falte un campo', async () => {
    const onChange = jest.fn();
    await render(<DateOfBirthPicker value={null} onChange={onChange} />);

    await fireEvent.press(screen.getByLabelText('Año'));
    await fireEvent.press(screen.getByText('2001'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
