import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import ChatDetailScreen from '@/app/chats/[id]';
import {
  getMensajes,
  getContraparteAlias,
  enviarMensaje,
  subscribeMensajes,
} from '@/lib/chat';
import { getCitaDetalle, confirmarCita } from '@/lib/citas';

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'c1' }) }));
jest.mock('@/lib/chat', () => ({
  getMensajes: jest.fn(),
  getContraparteAlias: jest.fn(),
  enviarMensaje: jest.fn(),
  subscribeMensajes: jest.fn(() => () => {}),
}));
jest.mock('@/lib/citas', () => ({
  getCitaDetalle: jest.fn(),
  confirmarCita: jest.fn(),
}));

const mockedGetMensajes = getMensajes as jest.Mock;
const mockedGetAlias = getContraparteAlias as jest.Mock;
const mockedEnviar = enviarMensaje as jest.Mock;
const mockedSubscribe = subscribeMensajes as jest.Mock;
const mockedGetCitaDetalle = getCitaDetalle as jest.Mock;
const mockedConfirmarCita = confirmarCita as jest.Mock;

// La primera transformación de módulos de esta suite excede los 15 s
// globales cuando corre en paralelo con las otras 36 (jest-expo, Windows,
// cache fría). Diagnosticado con systematic-debugging: falla solo con
// maxWorkers por defecto + cache limpia, nunca aislada ni con
// --maxWorkers=1 ni con --detectOpenHandles limpio → contención de CPU,
// no un await faltante ni una suscripción sin limpiar.
jest.setTimeout(30000);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetAlias.mockResolvedValue('Beto');
  mockedSubscribe.mockReturnValue(() => {});
  // Por defecto sin cita legible (null): los tests de mensajería preexistentes
  // no ven ni botón de confirmar ni resumen.
  mockedGetCitaDetalle.mockResolvedValue(null);
});

describe('ChatDetailScreen', () => {
  it('muestra el alias de la contraparte y las burbujas propia/ajena', async () => {
    mockedGetMensajes.mockResolvedValue([
      { id: 'm1', texto: 'Hola Beto', mine: true, oculto: false, createdAt: '2026-07-24T10:00:00Z' },
      { id: 'm2', texto: 'Hola Ana', mine: false, oculto: false, createdAt: '2026-07-24T10:01:00Z' },
    ]);
    await render(<ChatDetailScreen />);

    expect(await screen.findByText('Beto')).toBeTruthy();
    expect(screen.getByText('Hola Beto')).toBeTruthy();
    expect(screen.getByText('Hola Ana')).toBeTruthy();
  });

  it('avisa al emisor cuando su propio mensaje fue ocultado por moderación', async () => {
    mockedGetMensajes.mockResolvedValue([
      { id: 'm1', texto: 'mi cel 987654321', mine: true, oculto: true, createdAt: '2026-07-24T10:00:00Z' },
    ]);
    await render(<ChatDetailScreen />);

    expect(await screen.findByText(/fue ocultado/i)).toBeTruthy();
  });

  it('suscribe a Realtime para la cita y limpia al desmontar', async () => {
    mockedGetMensajes.mockResolvedValue([]);
    const cleanup = jest.fn();
    mockedSubscribe.mockReturnValue(cleanup);

    const { unmount } = await render(<ChatDetailScreen />);
    await screen.findByText('Beto');

    expect(mockedSubscribe).toHaveBeenCalledWith('c1', expect.any(Function));
    // El cleanup del efecto (passive) se vacía al envolver el unmount en act.
    await act(async () => {
      unmount();
    });
    expect(cleanup).toHaveBeenCalled();
  });

  it('envía un mensaje y limpia el input', async () => {
    mockedGetMensajes.mockResolvedValue([]);
    mockedEnviar.mockResolvedValue({ error: null });

    await render(<ChatDetailScreen />);
    await screen.findByText('Beto');

    const input = screen.getByPlaceholderText(/escribe un mensaje/i);
    await fireEvent.changeText(input, 'nos vemos');
    await fireEvent.press(screen.getByLabelText('Enviar'));

    await waitFor(() => expect(mockedEnviar).toHaveBeenCalledWith('c1', 'nos vemos'));
  });

  describe('confirmar cita', () => {
    it('muestra el botón "Confirmar cita" cuando la cita está pendiente y soy el amigo', async () => {
      mockedGetMensajes.mockResolvedValue([]);
      mockedGetCitaDetalle.mockResolvedValue({
        estado: 'pendiente',
        esAmigo: true,
        zona: null,
        hora: null,
        mensaje: null,
        bebidaNombre: 'Pisco Sour',
        valorV: 30,
        tiempoEstimadoMin: 60,
      });

      await render(<ChatDetailScreen />);

      expect(await screen.findByText('Confirmar cita')).toBeTruthy();
    });

    it('NO muestra el botón "Confirmar cita" si soy el rentador (no el amigo)', async () => {
      mockedGetMensajes.mockResolvedValue([]);
      mockedGetCitaDetalle.mockResolvedValue({
        estado: 'pendiente',
        esAmigo: false,
        zona: null,
        hora: null,
        mensaje: null,
        bebidaNombre: 'Pisco Sour',
        valorV: 30,
        tiempoEstimadoMin: 60,
      });

      await render(<ChatDetailScreen />);
      await screen.findByText('Beto');

      expect(screen.queryByText('Confirmar cita')).toBeNull();
    });

    it('el amigo confirma la cita y ambas partes ven el resumen con bebida, V, tiempo, zona y hora', async () => {
      mockedGetMensajes.mockResolvedValue([]);
      mockedGetCitaDetalle
        .mockResolvedValueOnce({
          estado: 'pendiente',
          esAmigo: true,
          zona: null,
          hora: null,
          mensaje: null,
          bebidaNombre: 'Pisco Sour',
          valorV: 30,
          tiempoEstimadoMin: 60,
        })
        .mockResolvedValueOnce({
          estado: 'confirmada',
          esAmigo: true,
          zona: 'Ayahuasca Bar, Barranco',
          hora: '2026-07-25T21:30:00-05:00',
          mensaje: 'Nos vemos en la barra',
          bebidaNombre: 'Pisco Sour',
          valorV: 30,
          tiempoEstimadoMin: 60,
        });
      mockedConfirmarCita.mockResolvedValue({ resultado: 'confirmada', error: null });

      await render(<ChatDetailScreen />);
      await screen.findByText('Confirmar cita');

      await fireEvent.press(screen.getByText('Confirmar cita'));

      await fireEvent.changeText(
        screen.getByPlaceholderText(/zona de encuentro/i),
        'Ayahuasca Bar, Barranco',
      );
      await fireEvent.changeText(screen.getByPlaceholderText(/hora/i), '2026-07-25T21:30:00-05:00');
      await fireEvent.changeText(
        screen.getByPlaceholderText(/mensaje adicional/i),
        'Nos vemos en la barra',
      );
      await fireEvent.press(screen.getByLabelText('Guardar cita'));

      await waitFor(() =>
        expect(mockedConfirmarCita).toHaveBeenCalledWith(
          'c1',
          'Ayahuasca Bar, Barranco',
          '2026-07-25T21:30:00-05:00',
          'Nos vemos en la barra',
        ),
      );

      expect(await screen.findByText('Cita confirmada')).toBeTruthy();
      expect(screen.getByText('Pisco Sour')).toBeTruthy();
      expect(screen.getByText('S/ 30.00')).toBeTruthy();
      expect(screen.getByText('~60 min')).toBeTruthy();
      expect(screen.getByText('Ayahuasca Bar, Barranco')).toBeTruthy();
    });

    it('muestra el resumen "Cita confirmada" al rentador también (ambas partes lo ven)', async () => {
      mockedGetMensajes.mockResolvedValue([]);
      mockedGetCitaDetalle.mockResolvedValue({
        estado: 'confirmada',
        esAmigo: false,
        zona: 'Ayahuasca Bar, Barranco',
        hora: '2026-07-25T21:30:00-05:00',
        mensaje: 'Nos vemos en la barra',
        bebidaNombre: 'Pisco Sour',
        valorV: 30,
        tiempoEstimadoMin: 60,
      });

      await render(<ChatDetailScreen />);

      expect(await screen.findByText('Cita confirmada')).toBeTruthy();
      expect(screen.queryByText('Confirmar cita')).toBeNull();
    });

    it('muestra el valor en soles con dos decimales (S/ X.XX), no en V', async () => {
      mockedGetMensajes.mockResolvedValue([]);
      mockedGetCitaDetalle.mockResolvedValue({
        estado: 'confirmada',
        esAmigo: true,
        zona: 'Ayahuasca Bar, Barranco',
        hora: '2026-07-25T21:30:00-05:00',
        mensaje: null,
        bebidaNombre: 'Pisco Sour',
        valorV: 30,
        tiempoEstimadoMin: 60,
      });

      await render(<ChatDetailScreen />);

      // El valor debe mostrarse como S/ 30.00, no como "30 V"
      expect(await screen.findByText('S/ 30.00')).toBeTruthy();
      expect(screen.queryByText(/30 V/)).toBeNull();
      expect(screen.queryByText(/\s+V(?:\s|$)/)).toBeNull();
    });
  });
});
