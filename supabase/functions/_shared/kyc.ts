// Lógica de KYC compartida por los Edge Functions kyc-start / kyc-webhook.
//
// Deliberadamente ISOMÓRFICA: solo usa Web Crypto (`crypto.subtle`) y APIs
// estándar, sin imports de Deno ni de Node — así el mismo archivo corre en
// el runtime Deno de Supabase Edge Functions Y en Jest (Node ≥18 expone
// `crypto.subtle` global), permitiendo probar la parte que sí es lógica de
// negocio real sin necesitar Docker ni el runtime de Supabase local.
//
// Modo demo vs Truora real: `decideKycProvider` es la única bisagra. Para
// activar Truora de verdad basta con configurar `TRUORA_API_KEY` y
// `KYC_PROVIDER=truora` como secrets del proyecto Supabase — nada de código
// cambia.

export type KycProvider = 'demo' | 'truora';
export type KycEstado = 'pendiente' | 'verificado' | 'rechazado';

/**
 * Demo por defecto, incluso si hay una API key configurada: pasar a Truora
 * real requiere el opt-in explícito KYC_PROVIDER=truora (evita cobros
 * accidentales apenas alguien pegue la key en el entorno).
 */
export function decideKycProvider(env: Record<string, string | undefined>): KycProvider {
  if (env.KYC_PROVIDER === 'truora' && env.TRUORA_API_KEY) {
    return 'truora';
  }
  return 'demo';
}

export type StartAction = 'proceed' | 'skip-verified' | 'skip-pending';

/**
 * Decide qué hacer en kyc-start dado el estado de la última verificación del
 * usuario (o null si nunca intentó). Evita dos huecos de idempotencia:
 * volver a aprobar a alguien ya verificado, y — el importante en modo Truora
 * real — volver a enviar una verificación ya en curso, que duplicaría el
 * envío (y el cobro) al proveedor. Un `rechazado` sí puede reintentar.
 */
export function decideStartAction(lastEstado: KycEstado | null): StartAction {
  if (lastEstado === 'verificado') return 'skip-verified';
  if (lastEstado === 'pendiente') return 'skip-pending';
  return 'proceed';
}

/**
 * kyc-webhook solo debe procesar un evento si la verificación referenciada
 * sigue `pendiente` — así un mismo webhook entregado dos veces (reintento de
 * Truora, o un replay) no reprocesa ni pisa un estado ya resuelto.
 */
export function shouldProcessWebhook(currentEstado: KycEstado): boolean {
  return currentEstado === 'pendiente';
}

/**
 * Valida que una ruta de storage pertenezca al usuario y sea exactamente
 * `<uid>/<archivo>` — sin subcarpetas ni traversal. `startsWith(uid + '/')`
 * NO basta: acepta `<uid>/../<otro>/dni.jpg`, y como kyc-start firma URLs con
 * service_role (bypassa la RLS de storage), eso permitiría leer el DNI de
 * otro usuario en modo Truora.
 */
export function isSelfOwnedStoragePath(path: string, uid: string): boolean {
  const parts = path.split('/');
  if (parts.length !== 2) return false;
  const folder = parts[0];
  const name = parts[1];
  if (folder !== uid) return false;
  if (!name || name === '.' || name === '..') return false;
  return true;
}

/** Modo demo: cualquier DNI escaneado se aprueba de inmediato. */
export function runDemoVerification(): { estado: 'verificado'; verificadoAt: string } {
  return { estado: 'verificado', verificadoAt: new Date().toISOString() };
}

export type TruoraStartParams = {
  apiKey: string;
  dniUrl: string;
  selfieUrl: string;
  externalId: string;
};

export type HttpRequestSpec = {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
};

/**
 * Arma el request de validación de documento de Truora (doc + liveness +
 * cruce RENIEC). No lo ejecuta — el caller (kyc-start, en Deno) hace el
 * fetch real; esto queda aquí para poder probar la forma del request sin
 * red.
 */
export function buildTruoraStartRequest(params: TruoraStartParams): HttpRequestSpec {
  return {
    url: 'https://api.identity.truora.com/v1/validations',
    method: 'POST',
    headers: {
      'Truora-API-Key': params.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      external_id: params.externalId,
      front_document_url: params.dniUrl,
      selfie_url: params.selfieUrl,
      country: 'PE',
      validations: ['document', 'liveness', 'reniec-check'],
    }),
  };
}

/** Convierte un buffer de firma HMAC a hex, para comparar con el header del webhook. */
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
 * Verifica la firma HMAC-SHA256 del webhook de Truora contra el body crudo.
 * Comparación en tiempo constante (longitud fija por ser hex de largo fijo)
 * para no filtrar la firma esperada por timing.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  // Sin secreto configurado no hay firma en la que confiar: rechazar SIEMPRE.
  // Si no, un deploy con Truora activo pero TRUORA_WEBHOOK_SECRET olvidado
  // aceptaría firmas HMAC con clave vacía (forjables por cualquiera).
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

export type ParsedTruoraWebhook = { externalId: string; estado: 'verificado' | 'rechazado' };

const STATUS_MAP: Record<string, 'verificado' | 'rechazado'> = {
  approved: 'verificado',
  rejected: 'rechazado',
};

/** Traduce el payload de Truora a nuestro estado interno. Null si no aplica. */
export function parseTruoraWebhookPayload(payload: unknown): ParsedTruoraWebhook | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  const externalId = body.external_id;
  const status = body.status;
  if (typeof externalId !== 'string' || typeof status !== 'string') return null;

  const estado = STATUS_MAP[status];
  return estado ? { externalId, estado } : null;
}
