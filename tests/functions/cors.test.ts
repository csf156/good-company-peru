import { corsHeaders, isAllowedOrigin, preflightResponse } from '../../supabase/functions/_shared/cors';

describe('corsHeaders', () => {
  it('devuelve el origen cuando está permitido', () => {
    expect(corsHeaders('http://localhost:8081')['Access-Control-Allow-Origin']).toBe(
      'http://localhost:8081',
    );
  });

  it('no devuelve cabecera de origen si no está permitido', () => {
    expect(corsHeaders('https://sitio-ajeno.com')['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('no devuelve cabecera de origen cuando no hay Origin (petición no-navegador)', () => {
    expect(corsHeaders(null)['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('nunca usa comodín', () => {
    for (const o of ['http://localhost:8081', 'https://sitio-ajeno.com', null]) {
      expect(corsHeaders(o)['Access-Control-Allow-Origin']).not.toBe('*');
    }
  });

  it('permite las cabeceras que supabase-js envía', () => {
    const h = corsHeaders('http://localhost:8081')['Access-Control-Allow-Headers'] ?? '';
    for (const nombre of ['authorization', 'content-type', 'apikey', 'x-client-info']) {
      expect(h.toLowerCase()).toContain(nombre);
    }
  });
});

describe('isAllowedOrigin', () => {
  it('acepta los orígenes de la lista', () => {
    expect(isAllowedOrigin('http://localhost:8081')).toBe(true);
    expect(isAllowedOrigin('https://csf156.github.io')).toBe(true);
  });

  it('rechaza un origen ajeno', () => {
    expect(isAllowedOrigin('https://sitio-ajeno.com')).toBe(false);
  });

  it('rechaza null', () => {
    expect(isAllowedOrigin(null)).toBe(false);
  });
});

describe('preflightResponse', () => {
  // `preflightResponse` usa `Request`/`Response` globales (Deno en producción).
  // Node 18+ los trae globales, así que el test corre igual sin polyfill.
  it('responde 204 con cabeceras CORS cuando el método es OPTIONS y el origen está permitido', async () => {
    const req = new Request('https://example.com/fn', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8081' },
    });
    const res = preflightResponse(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(204);
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8081');
  });

  it('devuelve null si el método no es OPTIONS, para que la función siga su camino normal', async () => {
    const req = new Request('https://example.com/fn', {
      method: 'POST',
      headers: { Origin: 'http://localhost:8081' },
    });
    expect(preflightResponse(req)).toBeNull();
  });

  it('no exige sesión: responde el preflight sin cabecera Authorization', async () => {
    const req = new Request('https://example.com/fn', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8081' },
    });
    expect(req.headers.get('Authorization')).toBeNull();
    const res = preflightResponse(req);
    expect(res?.status).toBe(204);
  });
});
