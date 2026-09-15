import { render, screen, fireEvent } from '@testing-library/react-native';
import { SelectionGrid } from '@/components/SelectionGrid';

const OPCIONES = [
  { value: 'a', label: 'Alfa', icon: 'bike' as const },
  { value: 'b', label: 'Beta', icon: 'run' as const },
  { value: 'c', label: 'Gama', icon: 'yoga' as const },
];

describe('SelectionGrid', () => {
  it('selecciona y deselecciona una opción', async () => {
    const onChange = jest.fn();
    await render(<SelectionGrid options={OPCIONES} selected={[]} onChange={onChange} max={2} />);
    fireEvent.press(screen.getByText('Alfa'));
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('deselecciona una ya elegida', async () => {
    const onChange = jest.fn();
    await render(<SelectionGrid options={OPCIONES} selected={['a']} onChange={onChange} max={2} />);
    fireEvent.press(screen.getByText('Alfa'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('no deja pasar del máximo y dice por qué', async () => {
    const onChange = jest.fn();
    await render(
      <SelectionGrid options={OPCIONES} selected={['a', 'b']} onChange={onChange} max={2} />,
    );
    await fireEvent.press(screen.getByText('Gama'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/máximo 2/i)).toBeTruthy();
  });

  it('con max=1, elegir otra opción reemplaza la anterior en vez de bloquear — para poder comparar antes de decidir', async () => {
    const onChange = jest.fn();
    await render(<SelectionGrid options={OPCIONES} selected={['a']} onChange={onChange} max={1} />);
    await fireEvent.press(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith(['b']);
    expect(screen.queryByText(/máximo 1/i)).toBeNull();
  });

  it('marca lo seleccionado con estado accesible, no solo con color', async () => {
    await render(<SelectionGrid options={OPCIONES} selected={['a']} onChange={jest.fn()} max={2} />);
    expect(screen.getByLabelText('Alfa').props.accessibilityState.selected).toBe(true);
  });
});
