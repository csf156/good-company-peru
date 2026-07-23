import { render, screen } from '@testing-library/react-native';
import BarScreen from '@/app/bar';
import { getMiBar } from '@/lib/bar';

jest.mock('@/lib/bar', () => ({
  getMiBar: jest.fn(),
}));

const mockedGetMiBar = getMiBar as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BarScreen', () => {
  it('lists the stock with name and estado', async () => {
    mockedGetMiBar.mockResolvedValue([
      { id: 'b1', estado: 'disponible', bebida: { nombre: 'Cerveza', tipoInvitacion: 'divertida', valorV: 40 } },
      { id: 'b2', estado: 'consumida', bebida: { nombre: 'Vino', tipoInvitacion: 'romantica', valorV: 80 } },
    ]);
    await render(<BarScreen />);

    expect(await screen.findByText('Cerveza')).toBeTruthy();
    expect(screen.getByText('Vino')).toBeTruthy();
    expect(screen.getByText('Disponible')).toBeTruthy();
    expect(screen.getByText('Consumida')).toBeTruthy();
  });

  it('shows an "Invitar" action only for disponible stock', async () => {
    mockedGetMiBar.mockResolvedValue([
      { id: 'b1', estado: 'disponible', bebida: { nombre: 'Cerveza', tipoInvitacion: 'divertida', valorV: 40 } },
      { id: 'b2', estado: 'bloqueada', bebida: { nombre: 'Vino', tipoInvitacion: 'romantica', valorV: 80 } },
      { id: 'b3', estado: 'consumida', bebida: { nombre: 'Pisco', tipoInvitacion: 'amigos', valorV: 30 } },
    ]);
    await render(<BarScreen />);

    await screen.findByText('Cerveza');
    expect(screen.getAllByText('Invitar')).toHaveLength(1);
  });

  it('shows a placeholder for stock whose bebida was deactivated (bebida null)', async () => {
    mockedGetMiBar.mockResolvedValue([{ id: 'b1', estado: 'disponible', bebida: null }]);
    await render(<BarScreen />);

    expect(await screen.findByText(/bebida no disponible/i)).toBeTruthy();
  });

  it('shows an empty state when the bar has no stock', async () => {
    mockedGetMiBar.mockResolvedValue([]);
    await render(<BarScreen />);

    expect(await screen.findByText(/no tienes bebidas en tu bar/i)).toBeTruthy();
  });
});
