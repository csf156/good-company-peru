import {
  calcularDesgloseCompra,
  decidePaymentProvider,
  buildRedPontisOrderRequest,
  buildPreautorizacionRequest,
  buildCapturaRequest,
  buildAnulacionRequest,
  mockPreautorizar,
  mockCapturar,
  mockAnular,
  verifyPagoWebhookSignature,
  parsePagoWebhookPayload,
} from '../../supabase/functions/_shared/pagos';

describe('calcularDesgloseCompra', () => {
  it('rentador gratis: total = V + buyer fee 15% (procesamiento sale del margen, no se cobra)', () => {
    // Ejemplo trabajado del diseño §A: cerveza V=40 → rentador paga 46.00.
    expect(calcularDesgloseCompra(40)).toEqual({ valorV: 40, buyerFee: 6, total: 46 });
  });

  it('escala con V (vino V=80 → 92; cóctel V=120 → 138)', () => {
    expect(calcularDesgloseCompra(80)).toEqual({ valorV: 80, buyerFee: 12, total: 92 });
    expect(calcularDesgloseCompra(120)).toEqual({ valorV: 120, buyerFee: 18, total: 138 });
  });

  it('redondea el buyer fee a 2 decimales (centavos), sin float drift', () => {
    // V=33.33 → 15% = 4.9995 → 5.00 → total 38.33
    expect(calcularDesgloseCompra(33.33)).toEqual({ valorV: 33.33, buyerFee: 5, total: 38.33 });
  });

  it("tier 'free' es el default del MVP", () => {
    expect(calcularDesgloseCompra(40, 'free')).toEqual(calcularDesgloseCompra(40));
  });
});

describe('decidePaymentProvider', () => {
  it('usa mock por defecto (sin configurar nada)', () => {
    expect(decidePaymentProvider({})).toBe('mock');
  });

  it('sigue en mock aunque exista la key, si no hay opt-in explícito', () => {
    expect(decidePaymentProvider({ REDPONTIS_API_KEY: 'k' })).toBe('mock');
  });

  it('usa redpontis solo con opt-in explícito Y key presente', () => {
    expect(
      decidePaymentProvider({ PAYMENT_PROVIDER: 'redpontis', REDPONTIS_API_KEY: 'k' }),
    ).toBe('redpontis');
  });

  it('cae a mock si se pide redpontis pero falta la key (default seguro)', () => {
    expect(decidePaymentProvider({ PAYMENT_PROVIDER: 'redpontis' })).toBe('mock');
  });
});

describe('buildRedPontisOrderRequest', () => {
  it('arma el request de creación de orden con la API key server-side y el monto total', () => {
    const req = buildRedPontisOrderRequest({
      apiKey: 'secret-key',
      externalId: 'ord-1',
      total: 46,
      moneda: 'PEN',
    });
    expect(req.method).toBe('POST');
    expect(req.headers['Authorization']).toContain('secret-key');
    const body = JSON.parse(req.body);
    expect(body.external_id).toBe('ord-1');
    expect(body.amount).toBe(46);
    expect(body.currency).toBe('PEN');
  });
});

describe('buildPreautorizacionRequest', () => {
  it('manda el external_id de nuestra orden y el total calculado server-side, API key en header, no en body', () => {
    const req = buildPreautorizacionRequest({
      apiKey: 'secret-key',
      externalId: 'ord-1',
      total: 46,
      moneda: 'PEN',
    });
    expect(req.method).toBe('POST');
    expect(req.headers['Authorization']).toContain('secret-key');
    const body = JSON.parse(req.body);
    expect(body.external_id).toBe('ord-1');
    expect(body.amount).toBe(46);
    expect(JSON.stringify(body)).not.toContain('secret-key');
  });
});

describe('buildCapturaRequest y buildAnulacionRequest', () => {
  it('buildCapturaRequest referencia el providerRef del hold, no el external_id', () => {
    const req = buildCapturaRequest('secret-key', 'hold:ord-1');
    expect(req.method).toBe('POST');
    expect(req.headers['Authorization']).toContain('secret-key');
    expect(req.url).toContain('hold:ord-1');
    expect(JSON.stringify(req)).not.toContain('external_id');
  });

  it('buildAnulacionRequest referencia el providerRef del hold, no el external_id', () => {
    const req = buildAnulacionRequest('secret-key', 'hold:ord-1');
    expect(req.method).toBe('POST');
    expect(req.headers['Authorization']).toContain('secret-key');
    expect(req.url).toContain('hold:ord-1');
    expect(JSON.stringify(req)).not.toContain('external_id');
  });
});

describe('mockPreautorizar / mockCapturar / mockAnular (ciclo hold)', () => {
  it('mockPreautorizar devuelve un providerRef determinista derivado del externalId (reintento = mismo ref)', () => {
    const r1 = mockPreautorizar('ord-1');
    const r2 = mockPreautorizar('ord-1');
    expect(r1.ok).toBe(true);
    expect(r1).toEqual(r2);
  });

  it('providerRefs distintos para externalIds distintos', () => {
    const r1 = mockPreautorizar('ord-1');
    const r2 = mockPreautorizar('ord-2');
    expect(r1.ok && r2.ok && r1.providerRef).not.toBe(r2.ok && r2.providerRef);
  });

  it('mockCapturar sobre el mismo ref dos veces: ok:true las dos (idempotente)', () => {
    const { providerRef } = mockPreautorizar('ord-1') as { ok: true; providerRef: string };
    expect(mockCapturar(providerRef)).toEqual({ ok: true, providerRef });
    expect(mockCapturar(providerRef)).toEqual({ ok: true, providerRef });
  });

  it('mockAnular sobre el mismo ref dos veces: ok:true las dos (idempotente)', () => {
    const { providerRef } = mockPreautorizar('ord-1') as { ok: true; providerRef: string };
    const a1 = mockAnular(providerRef);
    const a2 = mockAnular(providerRef);
    expect(a1.ok).toBe(true);
    expect(a2.ok).toBe(true);
    expect(a1).toEqual(a2);
  });

  it('mockCapturar tras mockAnular del mismo ref devuelve ok:false — un hold anulado no se captura', () => {
    const { providerRef } = mockPreautorizar('ord-1') as { ok: true; providerRef: string };
    const anulado = mockAnular(providerRef) as { ok: true; providerRef: string };
    const resultado = mockCapturar(anulado.providerRef);
    expect(resultado.ok).toBe(false);
  });
});

describe('verifyPagoWebhookSignature', () => {
  const secret = 'whsec_pagos';
  const payload = '{"external_id":"ord-1","status":"paid"}';

  async function sign(body: string, key: string): Promise<string> {
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(body));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  it('acepta un payload firmado correctamente', async () => {
    const signature = await sign(payload, secret);
    await expect(verifyPagoWebhookSignature(payload, signature, secret)).resolves.toBe(true);
  });

  it('rechaza una firma con el secreto equivocado', async () => {
    const signature = await sign(payload, 'wrong');
    await expect(verifyPagoWebhookSignature(payload, signature, secret)).resolves.toBe(false);
  });

  it('rechaza un payload alterado (el monto no se puede falsear en tránsito)', async () => {
    const signature = await sign(payload, secret);
    await expect(
      verifyPagoWebhookSignature('{"external_id":"ord-1","status":"paid","amount":1}', signature, secret),
    ).resolves.toBe(false);
  });

  it('rechaza una firma mal formada', async () => {
    await expect(verifyPagoWebhookSignature(payload, 'not-hex', secret)).resolves.toBe(false);
  });

  it('rechaza SIEMPRE si el secreto está vacío o sin configurar (firma forjable)', async () => {
    const forged = await sign(payload, 'undefined');
    await expect(
      verifyPagoWebhookSignature(payload, forged, undefined as unknown as string),
    ).resolves.toBe(false);
    await expect(verifyPagoWebhookSignature(payload, 'abcdef', '')).resolves.toBe(false);
  });
});

describe('parsePagoWebhookPayload', () => {
  it('mapea status pagado → confirmada con el id de la orden', () => {
    expect(parsePagoWebhookPayload({ external_id: 'ord-1', status: 'paid' })).toEqual({
      ordenId: 'ord-1',
      estado: 'confirmada',
    });
  });

  it('mapea status fallido → fallida', () => {
    expect(parsePagoWebhookPayload({ external_id: 'ord-1', status: 'failed' })).toEqual({
      ordenId: 'ord-1',
      estado: 'fallida',
    });
  });

  it('devuelve null para un status no reconocido', () => {
    expect(parsePagoWebhookPayload({ external_id: 'ord-1', status: 'processing' })).toBeNull();
  });

  it('devuelve null para un payload mal formado', () => {
    expect(parsePagoWebhookPayload({})).toBeNull();
    expect(parsePagoWebhookPayload(null)).toBeNull();
  });
});
