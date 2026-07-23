// Lógica de pagos/escrow compartida por los Edge Functions comprar-bebida /
// pago-webhook (Fase 3.1).
//
// Deliberadamente ISOMÓRFICA: solo Web Crypto (`crypto.subtle`) y APIs
// estándar, sin imports de Deno ni de Node — así corre en el runtime Deno de
// Supabase Edge Functions Y en Jest (Node ≥18 expone `crypto.subtle` global),
// permitiendo probar la lógica de negocio real (fees, ledger, idempotencia,
// firma de webhook) sin Docker ni el runtime de Supabase.
//
// El movimiento de dinero real vive detrás de una interfaz PaymentProvider
// (mock | redpontis), igual que KYC usa demo | truora: activar Red Pontis es
// solo configurar los secrets PAYMENT_PROVIDER=redpontis + REDPONTIS_API_KEY,
// sin cambios de código. La orquestación de DB (insertar ledger/bar, CAS de la
// orden) vive en los index.ts (Deno), no aquí.

// ============================================================================
// Fees (modelo del diseño §A — el "100%" del amigo es neto de procesamiento)
// ============================================================================

// Costura de niveles/premium (sub-proyectos 6/8): hoy solo 'free'. El buyer fee
// baja por nivel del rentador y es 0 para premium; se agrega de forma aditiva.
export type RentadorTier = 'free';

const BUYER_FEE_RATE: Record<RentadorTier, number> = { free: 0.15 };

export type DesgloseCompra = {
  valorV: number;
  buyerFee: number;
  total: number;
};

/**
 * Desglose que paga el rentador por una bebida de valor V. Modelo A (diseño
 * §A, ejemplo trabajado): el rentador gratis paga V + buyer fee 15%; el ~4% de
 * procesamiento de pasarela NO se le cobra encima — sale del margen de la
 * plataforma. Se calcula en centavos para evitar float drift.
 *
 * CRÍTICO: este cálculo es server-side y parte del `valor_v` del catálogo. El
 * cliente NUNCA envía montos — comprar-bebida solo recibe `bebida_id`.
 */
export function calcularDesgloseCompra(valorV: number, tier: RentadorTier = 'free'): DesgloseCompra {
  const vCent = Math.round(valorV * 100);
  const feeCent = Math.round(vCent * BUYER_FEE_RATE[tier]);
  const totalCent = vCent + feeCent;
  return {
    valorV: vCent / 100,
    buyerFee: feeCent / 100,
    total: totalCent / 100,
  };
}

// La confirmación de pago (escribir el ledger `compra`/`fee`/`escrow_lock` y la
// bebida al bar) NO vive aquí: es una función SQL atómica e idempotente
// (`confirmar_orden_pago`, migración 20260723140000). Se ejecuta en una sola
// transacción con row lock, así un fallo parcial no deja la orden confirmada
// sin su ledger/bar, y un webhook duplicado no duplica la bebida. Los index.ts
// (mock inline / webhook real) solo la invocan vía `admin.rpc(...)`.

export type EstadoOrden = 'pendiente' | 'confirmada' | 'fallida';
export type ResultadoPago = 'confirmada' | 'fallida';

// ============================================================================
// PaymentProvider (mock | redpontis)
// ============================================================================

export type PaymentProvider = 'mock' | 'redpontis';

/**
 * Mock por defecto, incluso con la key presente: pasar a Red Pontis real
 * requiere el opt-in explícito PAYMENT_PROVIDER=redpontis (evita mover dinero
 * real apenas alguien pegue la key en el entorno).
 */
export function decidePaymentProvider(env: Record<string, string | undefined>): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'redpontis' && env.REDPONTIS_API_KEY) {
    return 'redpontis';
  }
  return 'mock';
}

export type RedPontisOrderParams = {
  apiKey: string;
  externalId: string;
  total: number;
  moneda: string;
};

export type HttpRequestSpec = {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
};

/**
 * Arma el request de creación de orden de pago en Red Pontis. STUB: la forma
 * exacta se ajusta cuando existan credenciales reales; lo que importa hoy es
 * que el monto y la API key van server-side y que `external_id` es nuestra
 * orden (para correlacionar el webhook). No ejecuta el fetch (lo hace el
 * index.ts en Deno).
 */
export function buildRedPontisOrderRequest(params: RedPontisOrderParams): HttpRequestSpec {
  return {
    url: 'https://api.redpontis.com/v1/orders',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      external_id: params.externalId,
      amount: params.total,
      currency: params.moneda,
      // El destino de los fondos es una subcuenta de escrow del partner.
      capture: 'escrow',
    }),
  };
}

// ============================================================================
// Webhook de confirmación de pago (firma + parseo)
// ============================================================================

async function hmacHex(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifica la firma HMAC-SHA256 del webhook de pago contra el body crudo.
 * Comparación en tiempo constante. Sin secreto configurado se rechaza SIEMPRE:
 * un deploy con Red Pontis activo pero REDPONTIS_WEBHOOK_SECRET olvidado no debe
 * aceptar firmas con clave vacía (forjables por cualquiera → confirmaría pagos
 * falsos y crearía stock sin cobro).
 */
export async function verifyPagoWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  if (!secret) {
    return false;
  }
  if (!/^[0-9a-f]+$/i.test(signatureHeader)) {
    return false;
  }
  const expected = await hmacHex(rawBody, secret);
  if (expected.length !== signatureHeader.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

export type ParsedPagoWebhook = { ordenId: string; estado: ResultadoPago };

const STATUS_MAP: Record<string, ResultadoPago> = {
  paid: 'confirmada',
  failed: 'fallida',
};

/**
 * Traduce el payload del webhook de pago a nuestro estado interno. `external_id`
 * es el id de nuestra orden. Null si el status no aplica o el payload está mal
 * formado. Nota: NUNCA se confía en montos del payload — los montos vienen de la
 * orden ya persistida server-side; el webhook solo dispara la confirmación.
 */
export function parsePagoWebhookPayload(payload: unknown): ParsedPagoWebhook | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  const externalId = body.external_id;
  const status = body.status;
  if (typeof externalId !== 'string' || typeof status !== 'string') return null;

  const estado = STATUS_MAP[status];
  return estado ? { ordenId: externalId, estado } : null;
}
