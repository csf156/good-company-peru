import {
  validarCrearInvitacion,
  validarResponderInvitacion,
} from '../../supabase/functions/_shared/invitaciones';

const EMISOR = '11111111-1111-1111-1111-111111111111';
const RECEPTOR = '22222222-2222-2222-2222-222222222222';
const BEBIDA = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';

function base(overrides: Record<string, unknown> = {}) {
  return {
    receptorId: RECEPTOR,
    tipo: 'invitacion',
    bebidaCatalogoId: BEBIDA,
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
        bebidaCatalogoId: BEBIDA,
        tiempoEstimadoMin: 60,
        zonaAproximada: 'Miraflores',
        idempotencyKey: 'key-1',
      });
    }
  });

  it('acepta una solicitud sin bebida y normaliza bebidaCatalogoId a null', () => {
    const r = validarCrearInvitacion(
      base({ tipo: 'solicitud', bebidaCatalogoId: undefined, tiempoEstimadoMin: null }),
      EMISOR,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.bebidaCatalogoId).toBeNull();
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
      validarCrearInvitacion(base({ tipo: 'invitacion', bebidaCatalogoId: undefined }), EMISOR).ok,
    ).toBe(false);
    expect(
      validarCrearInvitacion(base({ tipo: 'invitacion', bebidaCatalogoId: null }), EMISOR).ok,
    ).toBe(false);
  });

  it('rechaza una solicitud que trae bebida', () => {
    expect(
      validarCrearInvitacion(base({ tipo: 'solicitud', bebidaCatalogoId: BEBIDA }), EMISOR).ok,
    ).toBe(false);
  });

  it('rechaza un tiempoEstimadoMin no positivo cuando viene', () => {
    expect(validarCrearInvitacion(base({ tiempoEstimadoMin: 0 }), EMISOR).ok).toBe(false);
    expect(validarCrearInvitacion(base({ tiempoEstimadoMin: -5 }), EMISOR).ok).toBe(false);
    expect(validarCrearInvitacion(base({ tiempoEstimadoMin: 1.5 }), EMISOR).ok).toBe(false);
  });
});

const INVITACION = '11110002-0000-0000-0000-000000000000';

function baseResponder(overrides: Record<string, unknown> = {}) {
  return {
    invitacionId: INVITACION,
    accion: 'rechazar',
    ...overrides,
  };
}

describe('validarResponderInvitacion — forma del body', () => {
  it('acepta un rechazo válido y normaliza bebidaCatalogoId a null', () => {
    const r = validarResponderInvitacion(baseResponder());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).toEqual({
        invitacionId: INVITACION,
        accion: 'rechazar',
        bebidaCatalogoId: null,
      });
    }
  });

  it('acepta aceptar sin bebida (invitación de rentador) → bebidaCatalogoId null', () => {
    const r = validarResponderInvitacion(baseResponder({ accion: 'aceptar' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.bebidaCatalogoId).toBeNull();
  });

  it('acepta aceptar con bebida (solicitud) y conserva bebidaCatalogoId', () => {
    const r = validarResponderInvitacion(
      baseResponder({ accion: 'aceptar', bebidaCatalogoId: BEBIDA }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.bebidaCatalogoId).toBe(BEBIDA);
  });

  it('rechaza un body que no es objeto', () => {
    expect(validarResponderInvitacion(null).ok).toBe(false);
    expect(validarResponderInvitacion('x').ok).toBe(false);
  });

  it('rechaza si falta invitacionId', () => {
    expect(validarResponderInvitacion(baseResponder({ invitacionId: undefined })).ok).toBe(false);
    expect(validarResponderInvitacion(baseResponder({ invitacionId: '' })).ok).toBe(false);
  });

  it('rechaza una acción que no es aceptar ni rechazar', () => {
    expect(validarResponderInvitacion(baseResponder({ accion: 'saltar' })).ok).toBe(false);
    expect(validarResponderInvitacion(baseResponder({ accion: undefined })).ok).toBe(false);
  });

  it('rechaza un rechazo que trae bebida (rechazar no lleva bebida)', () => {
    expect(
      validarResponderInvitacion(baseResponder({ accion: 'rechazar', bebidaCatalogoId: BEBIDA })).ok,
    ).toBe(false);
  });

  it('rechaza aceptar con una bebidaCatalogoId presente pero inválida', () => {
    expect(
      validarResponderInvitacion(baseResponder({ accion: 'aceptar', bebidaCatalogoId: '' })).ok,
    ).toBe(false);
    expect(
      validarResponderInvitacion(baseResponder({ accion: 'aceptar', bebidaCatalogoId: 123 })).ok,
    ).toBe(false);
  });
});
