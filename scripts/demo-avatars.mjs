// Helpers de fotos de perfil para la siembra de demo (Fase D.3, Tarea 2).
//
// El bucket `fotos` es privado (fase 1.1): la app SIEMPRE lee vía URL firmada
// (lib/storage.ts:67), nunca por URL pública. Por eso una fila con `foto_url`
// no basta — tiene que existir el OBJETO real en el bucket, o la firma resuelve
// a un 404 y la imagen sale rota. Estas funciones generan un PNG de color
// sólido a mano (sin dependencias nuevas, solo `node:zlib`) y lo suben con la
// key `service_role`, obtenida en tiempo de ejecución — nunca se guarda a disco
// ni se imprime.

import { deflateSync } from 'node:zlib';

// ============================================================================
// PNG mínimo: firma + IHDR + un IDAT (deflate de todas las filas) + IEND.
// ============================================================================

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** PNG cuadrado de color sólido (RGB, 8 bits). `hex` tipo '#C9A24B'. */
export function solidColorPng(hex, size = 256) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB (sin alpha)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Cada scanline lleva su byte de filtro (0 = ninguno) al frente.
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) {
    const o = 1 + x * 3;
    row[o] = r;
    row[o + 1] = g;
    row[o + 2] = b;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idatData = deflateSync(raw);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idatData),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ============================================================================
// Management API: obtiene la key service_role EN TIEMPO DE EJECUCIÓN.
// No se guarda a disco ni se imprime — solo vive en memoria del proceso.
// ============================================================================

export function projectRefFromUrl(supabaseUrl) {
  const host = new URL(supabaseUrl).hostname; // <ref>.supabase.co
  return host.split('.')[0];
}

export async function fetchServiceRoleKey(accessToken, projectRef) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Management API /api-keys respondió ${res.status}: ${await res.text()}`);
  }
  const keys = await res.json();
  const serviceRole = Array.isArray(keys) ? keys.find((k) => k.name === 'service_role') : null;
  if (!serviceRole?.api_key) {
    throw new Error('No se encontró la key service_role en la respuesta de la Management API.');
  }
  return serviceRole.api_key;
}

// ============================================================================
// Storage: subir + firmar. Misma forma de ruta que lib/storage.ts (<uid>/foto.jpg).
// ============================================================================

export async function uploadFotoDemo({ supabaseUrl, serviceRoleKey, path, bytes }) {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/fotos/${path}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`Storage upload de ${path} respondió ${res.status}: ${await res.text()}`);
  }
}

export async function signFotoUrl({ supabaseUrl, serviceRoleKey, path, expiresIn = 3600 }) {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/sign/fotos/${path}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) {
    throw new Error(`Storage sign de ${path} respondió ${res.status}: ${await res.text()}`);
  }
  const { signedURL } = await res.json();
  return `${supabaseUrl}/storage/v1${signedURL}`;
}
