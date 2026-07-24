// Detector de fuga de pago externo (Fase 4.4) — regla de negocio "todo pago
// dentro de la app; compartir contacto/cuenta para pagar por fuera = ban"
// (docs/2026-07-01-modelo-negocio-design.md, "Regla anti-fuga").
//
// Deliberadamente ISOMÓRICO y sin I/O (mismo criterio que _shared/invitaciones.ts):
// lógica pura, testeable con Jest. Su GEMELO en SQL es la función plpgsql
// `moderar_chat_mensaje` (migración 20260724170000): un trigger BEFORE INSERT en
// `chat_mensajes` que aplica LA MISMA regla server-side, porque el cliente
// inserta mensajes directo (no pasa por Edge Function — decisión de arquitectura
// de la fase 4.0/4.4). Este módulo TS documenta y prueba la regla; la fuente de
// verdad en producción es el trigger (el cliente jamás decide si oculta un
// mensaje). Ambos deben mantenerse en sincronía — cualquier cambio de patrón va
// en los dos lados y se re-testea (Jest acá, pgTAP para el trigger).

// Palabras clave de pago/canal externo. Case-insensitive; se matchean con
// límites de palabra sobre el texto en minúsculas para no disparar dentro de
// otra palabra (p.ej. "cuenta" NO debe saltar en "cuéntame"). Lista razonable,
// no exhaustiva: apps de pago (yape/plin), términos de cuenta/transferencia, y
// los bancos peruanos más comunes. Se amplía de forma aditiva si se detecta
// evasión real (anótalo en backlog, no lo infles preventivamente).
const PALABRAS_CLAVE = [
  'yape', // incluye "yapea", "yapeame", "yapear" (sufijos, ver regex)
  'plin',
  'cuenta',
  'transferencia',
  'transferir',
  'deposito',
  'cci',
  'cbvu',
  'bcp',
  'interbank',
  'bbva',
  'scotiabank',
];

// \b(palabra)\w*  → la palabra como inicio de token, con sufijos opcionales
// ("yape"→"yapeame"). El \b inicial evita matches internos ("recci..." no
// dispara "cci"). Sobre texto en minúsculas.
const KEYWORD_RE = new RegExp(`\\b(?:${PALABRAS_CLAVE.join('|')})\\w*`, 'i');

// Teléfono peruano: opcional prefijo +51 / 51, luego un 9 y 8 dígitos más.
// Se corre sobre el texto COMPACTADO (sin espacios ni guiones), así "987-654-321"
// y "987 654 321" se normalizan a "987654321". La búsqueda es sin anclas: un
// teléfono embebido en más texto igual se detecta.
const TELEFONO_RE = /(?:\+?51)?9\d{8}/;

// Secuencia larga de dígitos (cuenta bancaria / CCI: en Perú la CCI son 20
// dígitos, las cuentas 10-14). 10+ dígitos consecutivos (ya compactados) es
// muy improbable en un chat inocente (un precio o una hora no llegan a 10).
const DIGITOS_LARGOS_RE = /\d{10,}/;

/**
 * True si el texto contiene un patrón de fuga (teléfono, cuenta/CCI larga, o
 * palabra clave de pago externo). Conservador hacia la detección: la regla de
 * negocio prioriza cerrar la fuga sobre no molestar un caso límite raro, pero
 * evita los falsos positivos obvios (número de casa de 3 dígitos, hora "8pm",
 * "cuéntame"). Ver los tests en tests/functions/moderacion.test.ts.
 */
export function detectarFuga(texto: string): boolean {
  if (!texto) {
    return false;
  }

  // Compacta separadores SOLO espacios/guiones (no letras ni comas): las letras
  // siguen separando números distintos ("40 y 30" no se une), y una lista con
  // comas ("1, 2, 3") tampoco se concatena.
  const compacto = texto.replace(/[\s-]/g, '');

  if (TELEFONO_RE.test(compacto) || DIGITOS_LARGOS_RE.test(compacto)) {
    return true;
  }

  return KEYWORD_RE.test(texto);
}
