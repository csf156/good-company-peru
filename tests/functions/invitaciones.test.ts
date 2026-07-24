import { validarCrearInvitacion } from '../../supabase/functions/_shared/invitaciones';

const EMISOR = '11111111-1111-1111-1111-111111111111';
const RECEPTOR = '22222222-2222-2222-2222-222222222222';
const BEBIDA = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';

function base(overrides: Record<string, unknown> = {}) {
  return {
    receptorId: RECEPTOR,
    tipo: 'invitacion',
    bebidaBarId: BEBIDA,
    tiempoEstimadoMin: 60,
    zonaAproximada: 'Miraflores',
    idempotencyKey: 'key-1',
    ...overrides,
  };
}

describe('validarCrearInvitacion — forma del body', () => {
  it('acepta una invitación válida y normaliza el body', () => {
    const r = validarCrearInvitacion(base(), EMISOR);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).toEqual({
        receptorId: RECEPTOR,
        tipo: 'invitacion',
        bebidaBarId: BEBIDA,
        tiempoEstimadoMin: 60,
        zonaAproximada: 'Miraflores',
        idempotencyKey: 'key-1',
      });
    }
  });

  it('acepta una solicitud sin bebida y normaliza bebidaBarId a null', () => {
    const r = validarCrearInvitacion(
      base({ tipo: 'solicitud', bebidaBarId: undefined, tiempoEstimadoMin: null }),
      EMISOR,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.bebidaBarId).toBeNull();
      expect(r.body.tiempoEstimadoMin).toBeNull();
    }
  });

  it('rechaza un body que no es objeto', () => {
    expect(validarCrearInvitacion(null, EMISOR).ok).toBe(false);
    expect(validarCrearInvitacion('x', EMISOR).ok).toBe(false);
  });

  it('rechaza si falta receptorId', () => {
    expect(validarCrearInvitacion(base({ receptorId: undefined }), EMISOR).ok).toBe(false);
    expect(validarCrearInvitacion(base({ receptorId: '' }), EMISOR).ok).toBe(false);
  });

  it('rechaza un tipo que no es invitacion ni solicitud', () => {
    expect(validarCrearInvitacion(base({ tipo: 'otro' }), EMISOR).ok).toBe(false);
    expect(validarCrearInvitacion(base({ tipo: undefined }), EMISOR).ok).toBe(false);
  });

  it('rechaza si falta idempotencyKey', () => {
    expect(validarCrearInvitacion(base({ idempotencyKey: undefined }), EMISOR).ok).toBe(false);
    expect(validarCrearInvitacion(base({ idempotencyKey: '' }), EMISOR).ok).toBe(false);
  });

  it('rechaza que el receptor sea el propio emisor', () => {
    expect(validarCrearInvitacion(base({ receptorId: EMISOR }), EMISOR).ok).toBe(false);
  });

  it('rechaza una invitación sin bebida', () => {
    expect(
      validarCrearInvitacion(base({ tipo: 'invitacion', bebidaBarId: undefined }), EMISOR).ok,
    ).toBe(false);
    expect(validarCrearInvitacion(base({ tipo: 'invitacion', bebidaBarId: null }), EMISOR).ok).toBe(
      false,
    );
  });

  it('rechaza una solicitud que trae bebida', () => {
    expect(
      validarCrearInvitacion(base({ tipo: 'solicitud', bebidaBarId: BEBIDA }), EMISOR).ok,
    ).toBe(false);
  });

  it('rechaza un tiempoEstimadoMin no positivo cuando viene', () => {
    expect(validarCrearInvitacion(base({ tiempoEstimadoMin: 0 }), EMISOR).ok).toBe(false);
    expect(validarCrearInvitacion(base({ tiempoEstimadoMin: -5 }), EMISOR).ok).toBe(false);
    expect(validarCrearInvitacion(base({ tiempoEstimadoMin: 1.5 }), EMISOR).ok).toBe(false);
  });
});
