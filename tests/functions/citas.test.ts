import { validarConfirmarCita } from '../../supabase/functions/_shared/citas';

const CITA_ID = 'cccc0001-0000-0000-0000-000000000000';

function base(overrides: Record<string, unknown> = {}) {
  return {
    citaId: CITA_ID,
    zona: 'Ayahuasca Bar, Barranco',
    hora: '2026-07-25T21:30:00-05:00',
    mensaje: 'Nos vemos en la barra',
    ...overrides,
  };
}

describe('validarConfirmarCita — forma del body', () => {
  it('acepta un body válido y lo normaliza', () => {
    const r = validarConfirmarCita(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).toEqual({
        citaId: CITA_ID,
        zona: 'Ayahuasca Bar, Barranco',
        hora: '2026-07-25T21:30:00-05:00',
        mensaje: 'Nos vemos en la barra',
      });
    }
  });

  it('mensaje es opcional: ausente o null se normaliza a null', () => {
    const r1 = validarConfirmarCita(base({ mensaje: undefined }));
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.body.mensaje).toBeNull();
    }

    const r2 = validarConfirmarCita(base({ mensaje: null }));
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.body.mensaje).toBeNull();
    }
  });

  it('mensaje en blanco se normaliza a null', () => {
    const r = validarConfirmarCita(base({ mensaje: '   ' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.mensaje).toBeNull();
    }
  });

  it('recorta espacios de zona', () => {
    const r = validarConfirmarCita(base({ zona: '  Miraflores  ' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.zona).toBe('Miraflores');
    }
  });

  it('rechaza un body que no es objeto', () => {
    expect(validarConfirmarCita(null).ok).toBe(false);
    expect(validarConfirmarCita('x').ok).toBe(false);
    expect(validarConfirmarCita(undefined).ok).toBe(false);
  });

  it('rechaza si falta citaId', () => {
    expect(validarConfirmarCita(base({ citaId: undefined })).ok).toBe(false);
    expect(validarConfirmarCita(base({ citaId: '' })).ok).toBe(false);
  });

  it('rechaza si falta zona o viene vacía', () => {
    expect(validarConfirmarCita(base({ zona: undefined })).ok).toBe(false);
    expect(validarConfirmarCita(base({ zona: '' })).ok).toBe(false);
    expect(validarConfirmarCita(base({ zona: '   ' })).ok).toBe(false);
  });

  it('rechaza si falta hora', () => {
    expect(validarConfirmarCita(base({ hora: undefined })).ok).toBe(false);
    expect(validarConfirmarCita(base({ hora: '' })).ok).toBe(false);
  });

  it('rechaza una hora que no es una fecha válida', () => {
    expect(validarConfirmarCita(base({ hora: 'no-es-una-fecha' })).ok).toBe(false);
  });

  it('rechaza mensaje que no es texto', () => {
    expect(validarConfirmarCita(base({ mensaje: 123 })).ok).toBe(false);
  });
});
