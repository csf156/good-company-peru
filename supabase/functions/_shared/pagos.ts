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

// La orquestación de la orden (captura/anulación/preautorización) NO vive
// aquí: son funciones SQL atómicas e idempotentes (capturar_orden,
// confirmar_preautorizacion — E.2a). Los index.ts (Deno) solo las invocan vía
// `admin.rpc(...)`, según lo que decida `rpcParaEvento` más abajo.

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
// Ciclo hold: preautorizar (al invitar) → capturar (al aceptar) | anular (al
// rechazar) — Fase E.2a. Reemplaza el "comprar ahora" de la Fase 3.1: la
// invitación es la compra (spec §3.1, §4), y el dinero se retiene, no se
// mueve, hasta que hay un encuentro que confirmar.
// ============================================================================

/**
 * Arma el request de creación de HOLD (preautorización) en Red Pontis. Mismo
 * patrón que `buildRedPontisOrderRequest`: STUB, no ejecuta el fetch (lo hace
 * el index.ts en Deno, E.2b). El monto es el que ya calculó `crear_invitacion`
 * server-side; el cliente nunca lo envía.
 */
export function buildPreautorizacionRequest(params: RedPontisOrderParams): HttpRequestSpec {
  return {
    url: 'https://api.redpontis.com/v1/holds',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      external_id: params.externalId,
      amount: params.total,
      currency: params.moneda,
      capture: 'manual',
    }),
  };
}

/**
 * Captura un hold ya preautorizado. Referencia el `providerRef` que devolvió
 * la preautorización, NO el `external_id` de nuestra orden — capturar exige
 * el identificador que asignó el proveedor al hold, no el nuestro.
 */
export function buildCapturaRequest(apiKey: string, providerRef: string): HttpRequestSpec {
  return {
    url: `https://api.redpontis.com/v1/holds/${providerRef}/capture`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  };
}

/** Anula (libera) un hold. Mismo criterio que `buildCapturaRequest`: por `providerRef`. */
export function buildAnulacionRequest(apiKey: string, providerRef: string): HttpRequestSpec {
  return {
    url: `https://api.redpontis.com/v1/holds/${providerRef}/void`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  };
}

export type ResultadoHold = { ok: true; providerRef: string } | { ok: false; motivo: string };

const MOCK_HOLD_PREFIX = 'hold:';
const MOCK_ANULADO_PREFIX = 'anulado:';

/**
 * Mock del ciclo hold — modo por defecto (`decidePaymentProvider`) mientras
 * Red Pontis está ASUMIDO, no confirmado (spec §3.1, decisión del usuario
 * 2026-09-10). Deliberadamente SIN memoria de módulo: el mock corre en
 * procesos Deno distintos entre invocaciones (una Edge Function no persiste
 * estado entre requests), así que una variable global mentiría y pasaría los
 * tests igual. El estado (anulado o no) se deriva del propio `providerRef`,
 * prefijándolo al anular — es el propio caller (la función SQL) quien
 * persiste y reenvía el ref correcto en la siguiente llamada.
 */
export function mockPreautorizar(externalId: string): ResultadoHold {
  // Determinista: el mismo externalId (reintento del mismo intento) produce
  // siempre el mismo providerRef — idempotencia sin estado.
  return { ok: true, providerRef: `${MOCK_HOLD_PREFIX}${externalId}` };
}

export function mockCapturar(providerRef: string): ResultadoHold {
  if (providerRef.startsWith(MOCK_ANULADO_PREFIX)) {
    return { ok: false, motivo: 'el hold ya fue anulado, no se puede capturar' };
  }
  return { ok: true, providerRef };
}

export function mockAnular(providerRef: string): ResultadoHold {
  if (providerRef.startsWith(MOCK_ANULADO_PREFIX)) {
    return { ok: true, providerRef }; // ya estaba anulado — idempotente, no lo duplica
  }
  return { ok: true, providerRef: `${MOCK_ANULADO_PREFIX}${providerRef}` };
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

// ============================================================================
// Vocabulario del ciclo hold, y qué RPC toca para cada evento — Fase E.2b.
// Reemplaza a parsePagoWebhookPayload/ParsedPagoWebhook (vocabulario paid/
// failed de la Fase 3.1: describía una compra directa que ya no existe).
// ============================================================================

export type EventoHold = 'autorizado' | 'capturado' | 'anulado' | 'fallido';
export type ParsedHoldWebhook = { ordenId: string; evento: EventoHold; providerRef: string | null };

const HOLD_EVENTO_MAP: Record<string, EventoHold> = {
  authorized: 'autorizado',
  captured: 'capturado',
  voided: 'anulado',
  failed: 'fallido',
};

/**
 * Traduce el payload del webhook del partner al vocabulario del hold.
 * `external_id` es el id de nuestra orden. Null si el status no aplica o el
 * payload está mal formado. Nota: NUNCA se confía en montos del payload — los
 * montos vienen de la orden ya persistida server-side; el webhook solo
 * dispara la transición.
 */
export function parseHoldWebhookPayload(payload: unknown): ParsedHoldWebhook | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  const externalId = body.external_id;
  const status = body.status;
  if (typeof externalId !== 'string' || typeof status !== 'string') return null;

  const evento = HOLD_EVENTO_MAP[status];
  if (!evento) return null;

  const providerRef = typeof body.provider_ref === 'string' ? body.provider_ref : null;
  return { ordenId: externalId, evento, providerRef };
}

/**
 * Qué RPC toca para un evento dado. `autorizado`/`fallido` son el resultado
 * de la preautorización (confirmar_preautorizacion, Tarea 3b de E.2a);
 * `capturado`/`anulado` son el resultado de mover un hold ya vivo
 * (capturar_orden, Tarea 2 de E.2a) — dos funciones SQL distintas porque
 * cada una gobierna una transición distinta de la máquina de estados.
 */
export function rpcParaEvento(
  evento: EventoHold,
):
  | { rpc: 'confirmar_preautorizacion'; ok: boolean }
  | { rpc: 'capturar_orden'; resultado: 'capturada' | 'anulada' }
  | null {
  switch (evento) {
    case 'autorizado':
      return { rpc: 'confirmar_preautorizacion', ok: true };
    case 'fallido':
      return { rpc: 'confirmar_preautorizacion', ok: false };
    case 'capturado':
      return { rpc: 'capturar_orden', resultado: 'capturada' };
    case 'anulado':
      return { rpc: 'capturar_orden', resultado: 'anulada' };
    default:
      // Inalcanzable con el EventoHold de hoy (union cerrada de 4 valores) —
      // defensivo por si el vocabulario crece sin actualizar este switch.
      return null;
  }
}

// Lista BLANCA, no lista negra (misma regla que la RLS de invitaciones,
// E.2a Tarea 2b): solo 'pendiente' permite preautorizar. Es el guardián
// contra el doble hold — un reintento del cliente con la misma
// idempotency_key recibe de crear_invitacion la invitación YA creada, con su
// orden YA preautorizada/capturada/anulada/fallida; sin esta guarda
// escribiéndose como "qué SÍ permite" en vez de "qué NO es 'preautorizada'",
// un estado nuevo que se agregue mañana nacería permitiendo un segundo hold
// por defecto, en vez de bloquearlo por defecto.
const ESTADOS_QUE_PERMITEN_PREAUTORIZAR: ReadonlySet<string> = new Set(['pendiente']);

export function debePreautorizar(estadoOrden: string): boolean {
  return ESTADOS_QUE_PERMITEN_PREAUTORIZAR.has(estadoOrden);
}
