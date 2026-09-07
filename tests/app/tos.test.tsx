import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import TosScreen from '@/app/(auth)/tos';
import { aceptarTos } from '@/lib/tos';
import { ProfileRefreshContext } from '@/lib/profile-context';

// `jest.requireActual('@/lib/tos')` ejecuta el módulo real, que importa
// `@/lib/supabase` — y ese, sin mock, toca AsyncStorage nativo y revienta
// fuera de un runtime RN real. Se mockea vacío: esta pantalla no lo usa
// directo (solo a través de aceptarTos, ya mockeado abajo).
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));
jest.mock('@/lib/tos', () => ({
  ...jest.requireActual('@/lib/tos'),
  aceptarTos: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const mockedAceptar = aceptarTos as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('el botón no avanza sin aceptación explícita, y dice por qué', async () => {
  await render(<TosScreen />);

  expect(
    screen.getByRole('button', { name: 'Aceptar y continuar' }).props.accessibilityState?.disabled,
  ).toBe(true);
  expect(screen.getByText(/marca la casilla/i)).toBeTruthy();
});

it('muestra el aviso de que el texto es un borrador sin revisión legal', async () => {
  await render(<TosScreen />);
  expect(screen.getByText(/borrador/i)).toBeTruthy();
});

it('al marcar la casilla habilita el botón', async () => {
  await render(<TosScreen />);
  await fireEvent.press(screen.getByRole('checkbox'));

  expect(
    screen.getByRole('button', { name: 'Aceptar y continuar' }).props.accessibilityState?.disabled,
  ).toBe(false);
});

it('acepta, relee el perfil y recién entonces navega', async () => {
  mockedAceptar.mockResolvedValue({ error: null });
  const refreshProfile = jest.fn().mockResolvedValue(undefined);
  await render(
    <ProfileRefreshContext.Provider value={refreshProfile}>
      <TosScreen />
    </ProfileRefreshContext.Provider>,
  );

  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByText('Aceptar y continuar'));

  await waitFor(() => expect(mockedAceptar).toHaveBeenCalledTimes(1));
  expect(refreshProfile).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});

it('si aceptar falla, muestra el motivo y no navega', async () => {
  mockedAceptar.mockResolvedValue({ error: 'sin red' });
  await render(<TosScreen />);

  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByText('Aceptar y continuar'));

  expect(await screen.findByText('sin red')).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});
