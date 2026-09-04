/**
 * CORS para las Edge Functions invocables desde un navegador.
 *
 * Las funciones se escribieron para el cliente nativo, donde CORS no existe.
 * Desde web, el navegador manda un preflight OPTIONS y, sin respuesta con
 * `Access-Control-Allow-Origin`, bloquea la petición real — supabase-js lo
 * reporta como "Failed to send a request to the Edge Function".
 *
 * Lista explícita en vez de `*`: tres de estas funciones mueven dinero.
 * El comodín funcionaría igual, pero no hay razón para dejar la puerta
 * abierta cuando enumerar cuesta lo mismo.
 *
 * CORS NO es autenticación: solo decide qué páginas web pueden leer la
 * respuesta. El `verify_jwt` de cada función sigue siendo la única auth.
 */
const ORIGENES_PERMITIDOS = [
  'http://localhost:8081',
  'http://localhost:3000',
  'https://csf156.github.io',
];

export function isAllowedOrigin(origin: string | null): boolean {
  return origin !== null && ORIGENES_PERMITIDOS.includes(origin);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin as string,
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * Responde el preflight. Devuelve `null` si la petición no es un preflight,
 * para que la función siga su camino normal.
 *
 * IMPORTANTE: se llama ANTES de cualquier comprobación de sesión. El
 * navegador manda el OPTIONS sin `Authorization`; si se exige auth aquí,
 * nunca llega a enviar la petición real.
 */
export function preflightResponse(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('Origin')) });
}
