# CORS en las Edge Functions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las Edge Functions invocables desde el cliente respondan el preflight CORS, para que la app funcione desde un navegador — hoy ninguna lo hace y todas fallan con "Failed to send a request to the Edge Function".

**Architecture:** Un helper compartido (`_shared/cors.ts`) con **lista de orígenes permitidos**, no comodín. Cada función invocable desde el cliente responde `OPTIONS` con 204 + cabeceras, y añade las cabeceras a todas sus respuestas. La autenticación no cambia en absoluto: CORS es una restricción del navegador, no una capa de auth, y el `verify_jwt` de cada función sigue igual.

**Tech Stack:** Deno (Supabase Edge Functions) · Jest para el helper

---

## Contexto: cómo se encontró

El usuario recorrió el alta hasta KYC, subió DNI y selfie, y recibió *"Failed to send a request to the Edge Function"*. Diagnóstico con evidencia:

```
OPTIONS https://<proyecto>.supabase.co/functions/v1/kyc-start
  →  HTTP 405 Method Not Allowed, sin Access-Control-Allow-Origin
```

El navegador bloquea la llamada real y `supabase-js` la reporta como fallo de envío. **No es la verificación de identidad** — el modo demo ya existe y devuelve `verificado` al instante. **Ninguna** de las funciones del repo maneja CORS: se escribieron para el cliente nativo, donde no aplica.

Nunca se detectó porque nadie había recorrido la app desde un navegador — el mismo patrón que ya produjo el bug del bucle en el alta y el de `useWindowDimensions` en web.

---

## Alcance: 5 funciones, no 7

| Función | ¿La llama un navegador? | ¿CORS? |
|---|---|---|
| `kyc-start` | Sí (`lib/kyc.ts:13`) | **Sí** |
| `comprar-bebida` | Sí (`lib/tienda.ts:57`) | **Sí** |
| `confirmar-cita` | Sí (`lib/citas.ts:97`) | **Sí** |
| `crear-invitacion` | Todavía no, lo hará en 4.7b | **Sí** (dejarla lista) |
| `responder-invitacion` | Todavía no, lo hará en 4.7b | **Sí** (dejarla lista) |
| `kyc-webhook` | No — Truora, servidor a servidor | **No** |
| `pago-webhook` | No — Red Pontis, servidor a servidor | **No** |

**Los webhooks quedan fuera a propósito.** Los llama un partner desde su servidor, donde CORS no existe. Añadírselo sería ruido y ampliaría superficie sin ganancia.

---

## Global Constraints

- **La auth no cambia.** CORS no es autenticación. Ningún `verify_jwt` de `config.toml` se toca, ninguna comprobación de sesión se relaja. Si el cambio te lleva a tocar auth, te desviaste.
- **Lista de orígenes, no `*`.** Tres de estas funciones mueven dinero. Un comodín funcionaría, pero una lista explícita cuesta lo mismo y no deja la puerta abierta.
- **El preflight no lleva auth.** El navegador manda `OPTIONS` **sin** cabecera `Authorization` — si la función exige sesión antes de responder al preflight, el navegador nunca llega a mandar la petición real. El `OPTIONS` se responde **antes** de cualquier comprobación de autenticación. Es el error más fácil de cometer aquí.
- **Un origen no permitido no recibe cabeceras.** Sin `Access-Control-Allow-Origin` en la respuesta, el navegador bloquea — que es el comportamiento buscado.
- **Sin cambios de lógica de negocio.** Ni un solo cambio en lo que las funciones hacen. Solo cabeceras y el manejo de `OPTIONS`.
- **Idioma:** comentarios y commits en inglés técnico o español, siguiendo el estilo del archivo.
- **Cierre:** `npm run lint` + `npm run typecheck` + `npm test` + `npm run test:db` verdes.
- **El usuario ya autorizó el despliegue** de estas 5 funciones a su proyecto de Supabase.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/functions/_shared/cors.ts` | Orígenes permitidos, cabeceras, respuesta al preflight |
| `tests/functions/cors.test.ts` | Tests del helper |
| `supabase/functions/{kyc-start,comprar-bebida,confirmar-cita,crear-invitacion,responder-invitacion}/index.ts` | Preflight + cabeceras en las respuestas |

---

## Task 1: El helper

**Files:**
- Create: `supabase/functions/_shared/cors.ts`, `tests/functions/cors.test.ts`

**Interfaces:**
- Produces: `corsHeaders(origin: string | null): Record<string, string>` y `preflightResponse(req: Request): Response | null`.

- [ ] **Step 1: Tests que fallan**

```typescript
import { corsHeaders, isAllowedOrigin } from '@/supabase/functions/_shared/cors';

describe('corsHeaders', () => {
  it('devuelve el origen cuando está permitido', () => {
    expect(corsHeaders('http://localhost:8081')['Access-Control-Allow-Origin'])
      .toBe('http://localhost:8081');
  });

  it('no devuelve cabecera de origen si no está permitido', () => {
    expect(corsHeaders('https://sitio-ajeno.com')['Access-Control-Allow-Origin'])
      .toBeUndefined();
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
```

El último test evita el fallo más común al añadir CORS a Supabase: `supabase-js` manda `apikey` y `x-client-info` además de las obvias, y si no están en la lista el preflight falla igual con el error idéntico.

- [ ] **Step 2: Correr y verificar que fallan**

```bash
npx jest tests/functions/cors.test.ts
```

- [ ] **Step 3: Implementar**

```typescript
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
```

`Vary: Origin` importa: sin él, una caché intermedia podría servirle a un origen la respuesta cacheada de otro.

- [ ] **Step 4: Verificar y commitear**

```bash
npx jest tests/functions/cors.test.ts && npm run lint && npm run typecheck
git add supabase/functions/_shared/cors.ts tests/functions/cors.test.ts
git commit -m "feat(functions): helper de CORS con lista de origenes"
```

---

## Task 2: Aplicarlo a las 5 funciones

**Files:**
- Modify: `supabase/functions/{kyc-start,comprar-bebida,confirmar-cita,crear-invitacion,responder-invitacion}/index.ts`

- [ ] **Step 1: El patrón, idéntico en las cinco**

Al principio del handler, **antes de leer la sesión o el cuerpo**:

```typescript
const preflight = preflightResponse(req);
if (preflight) return preflight;
```

Y en **todas** las salidas —éxito y error— fusionar las cabeceras. Revisa cada `return` del archivo: si una respuesta de error se va sin cabeceras, el navegador oculta el mensaje real y el usuario ve un fallo genérico en vez del motivo. Es la mitad del beneficio de este cambio.

- [ ] **Step 2: Verificar que no quedó ningún `return` sin cabeceras**

```bash
grep -n "return new Response\|return Response.json" supabase/functions/kyc-start/index.ts
```

Repítelo por función y confirma que cada una lleva las cabeceras.

- [ ] **Step 3: Suite completa**

```bash
npm run lint && npm run typecheck && npm test
set -a; . ./.env; set +a; npm run test:db
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/
git commit -m "fix(functions): responder preflight CORS en las funciones del cliente"
```

---

## Task 3: Desplegar y verificar contra el proyecto real

El usuario ya autorizó el despliegue de estas 5 funciones.

- [ ] **Step 1: Desplegar**

Con la CLI de Supabase o el MCP de Supabase (`deploy_edge_function`), las 5. **Respeta el `verify_jwt` que cada una ya tiene en `config.toml`** — si el despliegue lo pisa, la función queda abierta o cerrada de más. Verifícalo después del despliegue, no lo asumas.

- [ ] **Step 2: Verificar el preflight de verdad**

Por cada función desplegada:

```bash
curl -s -i -X OPTIONS "https://<proyecto>.supabase.co/functions/v1/<funcion>" \
  -H "Origin: http://localhost:8081" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" | head -12
```

Esperado: **204** con `Access-Control-Allow-Origin: http://localhost:8081`. Antes del arreglo esto daba **405 sin cabeceras** — esa es la diferencia que prueba que sirvió.

- [ ] **Step 3: Verificar que un origen ajeno NO recibe permiso**

```bash
curl -s -i -X OPTIONS "https://<proyecto>.supabase.co/functions/v1/kyc-start" \
  -H "Origin: https://sitio-ajeno.com" \
  -H "Access-Control-Request-Method: POST" | grep -i "access-control-allow-origin" || echo "OK: sin cabecera para origen ajeno"
```

Esperado: **sin** cabecera. Si aparece, la lista no está filtrando y hay que parar.

- [ ] **Step 4: Verificar el `verify_jwt` post-despliegue**

Confirma por la Management API que las 5 conservan el `verify_jwt` que tenían. Un despliegue que lo cambie es un fallo de seguridad silencioso.

---

## Cierre

- [ ] **Verificación final, con la salida mostrada:** las dos suites, `git status`, `git diff tsconfig.json`.
- [ ] **Avisar al usuario** para que reintente el KYC en el preview: subir DNI y selfie debe terminar en `verificado` (modo demo) y llevarlo al home.
- [ ] **Anotar en `docs/backlog.md`** que los dos webhooks quedaron deliberadamente sin CORS, con el motivo — para que nadie lo lea como un olvido.
- [ ] **No cerrar D.3.** Esto es un arreglo transversal, no un bloque de la fase. Sin push.

**Este cambio toca funciones de fases cerradas que mueven dinero** (`comprar-bebida`, `confirmar-cita`). Aunque no altera lógica de negocio ni auth, cierra con **`superpowers:security-review`** antes de darlo por bueno.
