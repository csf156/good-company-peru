// Siembra y limpieza de datos de DEMO (Fase D.3, plan
// docs/superpowers/plans/2026-09-04-datos-demo.md, Tareas 2-6).
//
// Desechable y marcado: todo perfil sembrado lleva flags->>'demo' = 'true'.
// La limpieza borra SOLO eso. El catálogo de bebidas es dato de producto y
// vive en su propia migración (Tarea 1) — este script no lo toca.
//
// Reglas de oro (no negociables, ver plan §Global Constraints):
//   - `bar`/`ledger`/`ordenes_pago` nunca se insertan a mano: se llega a ellos
//     comprando (comprarBebidaDemo → confirmar_orden_pago), igual que el flujo
//     real, para que detectar_discrepancias_sp3() dé cero filas POR CONSTRUCCIÓN.
//   - Los estados de `invitaciones`/`citas` nunca se insertan a mano: se llega
//     con crear_invitacion / responder_invitacion / confirmar_cita.
//   - El script se niega a tocar cualquier perfil sin flags->>'demo'='true',
//     salvo el cambio de rol explícito de la Tarea 6 sobre el perfil del
//     usuario real (identificado por email, nunca por su sola ausencia de
//     marca — el perfil viejo de prueba de fases previas tampoco tiene la
//     marca y debe quedar intacto).
//
// Uso:
//   npm run demo:seed                      — siembra completa (Tareas 2-4) y
//                                             deja la cuenta del usuario como
//                                             'rentador' (decisión del usuario).
//   npm run demo:seed -- --rol=amigo       — solo cambia el rol de su cuenta.
//   npm run demo:limpiar                   — borra todo lo sembrado.

import { randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  solidColorPng,
  projectRefFromUrl,
  fetchServiceRoleKey,
  uploadFotoDemo,
  signFotoUrl,
} from './demo-avatars.mjs';

// ============================================================================
// Config
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!DATABASE_URL) {
  console.error('ERROR: falta DATABASE_URL.');
  process.exit(2);
}

// El perfil del usuario se identifica por email, no por ausencia de marca
// `demo` — hay un perfil viejo de prueba (fases previas) que tampoco la
// tiene y NO debe tocarse. Override con --usuario-email= si hiciera falta.
const args = process.argv.slice(2);
const LIMPIAR = args.includes('--limpiar');
const ROL_ARG = args.find((a) => a.startsWith('--rol='))?.split('=')[1] ?? null;
const USUARIO_EMAIL =
  args.find((a) => a.startsWith('--usuario-email='))?.split('=')[1] ?? 'csf156@gmail.com';

if (ROL_ARG && !['amigo', 'rentador'].includes(ROL_ARG)) {
  console.error(`ERROR: --rol debe ser 'amigo' o 'rentador' (recibido: ${ROL_ARG}).`);
  process.exit(2);
}

// ============================================================================
// Valores copiados de lib/onboarding-options.ts (los `value`, no los `label`)
// y de la lista GENERO_OPCIONES de app/(auth)/profile-setup.tsx — mantener en
// sync si esas listas cambian. No se importan directo porque son .ts y este
// script corre con Node plano (sin loader de TypeScript).
// ============================================================================

const DEMO_PROFILES = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    email: 'demo1@ayni.test',
    rol: 'amigo',
    nombre: 'Valentina Quispe Rojas',
    alias: 'Vale',
    ageYears: 24,
    genero: 'Mujer',
    profesion: 'Diseñadora gráfica',
    hobbies: ['yoga', 'leer', 'viajar'],
    tipoSalida: ['conversar', 'cine_cultura'],
    color: '#C9A24B',
    distritos: ['Miraflores', 'Barranco', 'San Isidro'],
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    email: 'demo2@ayni.test',
    rol: 'amigo',
    nombre: 'Sebastián Torres Medina',
    alias: 'Seba',
    ageYears: 29,
    genero: 'Hombre',
    profesion: null,
    hobbies: ['futbol', 'gimnasio', 'musica'],
    tipoSalida: ['deporte', 'noche'],
    color: '#7A5C3E',
    distritos: ['Santiago de Surco', 'La Molina', 'San Borja'],
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    email: 'demo3@ayni.test',
    rol: 'amigo',
    nombre: 'Camila Fernández Paredes',
    alias: 'Cami',
    ageYears: 35,
    genero: 'Mujer',
    profesion: 'Chef',
    hobbies: ['cocinar', 'pintar', 'cine'],
    tipoSalida: ['comer', 'turistear'],
    color: '#B5651D',
    distritos: ['Pueblo Libre', 'Jesús María', 'Magdalena del Mar'],
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    email: 'demo4@ayni.test',
    rol: 'amigo',
    nombre: 'Andrea Salazar Vidal',
    alias: 'Andy',
    ageYears: 26,
    genero: 'No binario',
    profesion: null,
    hobbies: ['fotografia', 'senderismo', 'surf'],
    tipoSalida: ['deporte', 'turistear'],
    color: '#8E735B',
    distritos: ['Barranco', 'Chorrillos', 'Miraflores', 'San Miguel'],
  },
  {
    id: 'd0000000-0000-0000-0000-000000000005',
    email: 'demo5@ayni.test',
    rol: 'rentador',
    nombre: 'Rodrigo Castillo Bravo',
    alias: 'Rodri',
    ageYears: 31,
    genero: 'Hombre',
    profesion: 'Ingeniero de sistemas',
    hobbies: ['videojuegos', 'musica', 'viajar'],
    tipoSalida: ['trabajar', 'conciertos'],
    color: '#4B3621',
    distritos: [],
  },
  {
    id: 'd0000000-0000-0000-0000-000000000006',
    email: 'demo6@ayni.test',
    rol: 'rentador',
    nombre: 'Fernando Ríos Guzmán',
    alias: 'Fer',
    ageYears: 40,
    genero: 'Hombre',
    profesion: 'Empresario',
    hobbies: ['futbol', 'cocinar', 'leer'],
    tipoSalida: ['comer', 'noche'],
    color: '#6B4226',
    distritos: [],
  },
  {
    id: 'd0000000-0000-0000-0000-000000000007',
    email: 'demo7@ayni.test',
    rol: 'rentador',
    nombre: 'Gabriela Núñez Campos',
    alias: 'Gaby',
    ageYears: 27,
    genero: 'Mujer',
    profesion: 'Abogada',
    hobbies: ['yoga', 'bailar', 'musica'],
    tipoSalida: ['conciertos', 'acompanamiento'],
    color: '#9C6B30',
    distritos: [],
  },
  {
    id: 'd0000000-0000-0000-0000-000000000008',
    email: 'demo8@ayni.test',
    rol: 'rentador',
    nombre: 'Diego Huamán Rojas',
    alias: 'Diego',
    ageYears: 45,
    genero: 'Prefiero no decirlo',
    profesion: 'Arquitecto',
    hobbies: ['gimnasio', 'viajar', 'fotografia'],
    tipoSalida: ['sin_plan', 'turistear'],
    color: '#A9744F',
    distritos: [],
  },
];

const byAlias = Object.fromEntries(DEMO_PROFILES.map((p) => [p.alias, p]));

// ============================================================================
// Dinero: mismo desglose que supabase/functions/_shared/pagos.ts
// (calcularDesgloseCompra) — rentador free = +15% buyer fee. Duplicado a
// propósito (Deno vs Node, sin import cruzado); mantener en sync.
// ============================================================================

function calcularDesglose(valorV) {
  const vCent = Math.round(Number(valorV) * 100);
  const feeCent = Math.round(vCent * 0.15);
  return { valorV: vCent / 100, buyerFee: feeCent / 100, total: (vCent + feeCent) / 100 };
}

// ============================================================================
// Utilidades de DB
// ============================================================================

async function connect() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

async function getDemoIds(client) {
  const { rows } = await client.query(`select id from public.profiles where flags->>'demo' = 'true'`);
  return rows.map((r) => r.id);
}

async function resolveTargetUser(client, email) {
  const { rows } = await client.query(
    `select p.id, p.rol, p.flags from public.profiles p join auth.users u on u.id = p.id where u.email = $1`,
    [email],
  );
  if (rows.length === 0) {
    throw new Error(
      `No se encontró ningún perfil con email ${email}. Pasa --usuario-email= si el email es otro.`,
    );
  }
  if (rows[0].flags?.demo === true) {
    throw new Error(`El perfil de ${email} está marcado como demo — algo está mal, abortando.`);
  }
  return rows[0];
}

async function discrepancias(client) {
  const { rows } = await client.query('select * from public.detectar_discrepancias_sp3()');
  return rows;
}

// ============================================================================
// Tarea 2 — Perfiles de demo con foto
// ============================================================================

async function seedAuthUsersYProfiles(client) {
  for (const p of DEMO_PROFILES) {
    await client.query(
      `insert into auth.users
         (instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          confirmation_token, email_change, email_change_token_new, recovery_token)
       values
         ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
          $2, '', now(), now(), now(), '', '', '', '')
       on conflict (id) do nothing`,
      [p.id, p.email],
    );

    await client.query(
      `insert into public.profiles
         (id, rol, nombre, alias, fecha_nacimiento, genero, profesion, hobbies,
          tipo_salida, foto_url, kyc_estado, verificado_at, flags)
       values
         ($1, $2, $3, $4, current_date - ($5 || ' years')::interval, $6, $7, $8,
          $9, $10, 'verificado', now(), '{"demo": true}'::jsonb)
       on conflict (id) do nothing`,
      [
        p.id,
        p.rol,
        p.nombre,
        p.alias,
        p.ageYears,
        p.genero,
        p.profesion,
        p.hobbies,
        p.tipoSalida,
        `${p.id}/foto.jpg`,
      ],
    );

    if (p.distritos.length > 0) {
      await client.query(
        `insert into public.preferencias_salida (perfil_id, distritos)
         values ($1, $2)
         on conflict (perfil_id) do update set distritos = excluded.distritos`,
        [p.id, p.distritos],
      );
    }
  }
  console.log(`✓ Tarea 2 — ${DEMO_PROFILES.length} perfiles de demo (auth.users + profiles).`);
}

async function seedFotos() {
  if (!SUPABASE_URL || !SUPABASE_ACCESS_TOKEN) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_ACCESS_TOKEN para subir fotos.');
  }
  const projectRef = projectRefFromUrl(SUPABASE_URL);
  const serviceRoleKey = await fetchServiceRoleKey(SUPABASE_ACCESS_TOKEN, projectRef);

  for (const p of DEMO_PROFILES) {
    const bytes = solidColorPng(p.color);
    await uploadFotoDemo({ supabaseUrl: SUPABASE_URL, serviceRoleKey, path: `${p.id}/foto.jpg`, bytes });
  }

  // Prueba real (no solo la fila): abrir una URL firmada y confirmar que el
  // objeto responde. Una ruta inventada daría 400/404 acá.
  const muestra = DEMO_PROFILES[0];
  const url = await signFotoUrl({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey,
    path: `${muestra.id}/foto.jpg`,
  });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`La foto de muestra (${muestra.alias}) no existe de verdad en el bucket: ${res.status}`);
  }
  const bytes = Number(res.headers.get('content-length') ?? 0);
  console.log(`✓ Tarea 2 — 8 fotos subidas a 'fotos'. Muestra verificada: ${muestra.alias} (${bytes} bytes).`);
}

// ============================================================================
// Tarea 3 — Bar y bebidas compradas (SOLO vía confirmar_orden_pago)
// ============================================================================

async function getCatalogo(client) {
  const { rows } = await client.query(
    `select id, nombre, valor_v from public.bebidas_catalogo where activo order by valor_v`,
  );
  if (rows.length === 0) throw new Error('bebidas_catalogo está vacío — corre la Tarea 1 primero.');
  return rows;
}

/**
 * Compra UNA bebida para `perfilId`, igual que comprar-bebida + confirmar_orden_pago
 * en el flujo real. Idempotente por (perfil_id, idempotency_key): una key estable
 * reutilizada en un segundo `npm run demo:seed` no duplica.
 * Devuelve el id de la fila de `bar` resultante.
 */
async function comprarBebidaDemo(client, { perfilId, bebida, idempotencyKey }) {
  const desglose = calcularDesglose(bebida.valor_v);
  const ordenId = randomUUID();
  const escrowRef = `mock-escrow-demo-${idempotencyKey}`;

  const { rows: existentes } = await client.query(
    `select id, estado from public.ordenes_pago where perfil_id = $1 and idempotency_key = $2`,
    [perfilId, idempotencyKey],
  );

  let orden;
  if (existentes.length > 0) {
    orden = existentes[0];
  } else {
    const { rows } = await client.query(
      `insert into public.ordenes_pago
         (id, perfil_id, bebida_catalogo_id, valor_v, buyer_fee, total, estado, provider, idempotency_key)
       values ($1, $2, $3, $4, $5, $6, 'pendiente', 'mock', $7)
       returning id, estado`,
      [ordenId, perfilId, bebida.id, desglose.valorV, desglose.buyerFee, desglose.total, idempotencyKey],
    );
    orden = rows[0];
  }

  if (orden.estado === 'pendiente') {
    await client.query('select public.confirmar_orden_pago($1, $2, $3)', [orden.id, 'confirmada', escrowRef]);
  }

  const { rows: barRows } = await client.query(
    `select id, estado from public.bar where perfil_id = $1 and escrow_ref like $2 order by created_at desc limit 1`,
    [perfilId, `%${idempotencyKey}%`],
  );
  // El escrow_ref lleva la idempotencyKey embebida arriba; si por alguna razón
  // no matchea (reintento con otro sufijo), cae al último bebida_id igual.
  if (barRows.length > 0) return barRows[0];
  const { rows: fallback } = await client.query(
    `select id, estado from public.bar where perfil_id = $1 and bebida_id = $2 order by created_at desc limit 1`,
    [perfilId, bebida.id],
  );
  return fallback[0];
}

async function seedBar(client, targetUserId) {
  const catalogo = await getCatalogo(client);
  const pick = (i) => catalogo[i % catalogo.length];

  const barUsuario = {};
  const compras = ['A', 'D1', 'D2', 'D3', 'D4', 'spare'];
  for (let i = 0; i < compras.length; i++) {
    barUsuario[compras[i]] = await comprarBebidaDemo(client, {
      perfilId: targetUserId,
      bebida: pick(i),
      idempotencyKey: `demo-seed:usuario:${compras[i]}`,
    });
  }

  const barDemoRentador = {};
  const rentadores = ['Rodri', 'Fer', 'Gaby', 'Diego'];
  for (const alias of rentadores) {
    const perfilId = byAlias[alias].id;
    barDemoRentador[alias] = [];
    for (let i = 0; i < 2; i++) {
      barDemoRentador[alias].push(
        await comprarBebidaDemo(client, {
          perfilId,
          bebida: pick(i),
          idempotencyKey: `demo-seed:${alias}:${i}`,
        }),
      );
    }
  }

  const disc = await discrepancias(client);
  if (disc.length > 0) {
    console.error('✗ Tarea 3 — detectar_discrepancias_sp3() NO da cero filas:', disc);
    throw new Error('Conciliación rota tras sembrar el bar. Deteniendo (no se ignora).');
  }
  console.log('✓ Tarea 3 — bar sembrado vía confirmar_orden_pago. Conciliación: 0 discrepancias.');
  return { barUsuario, barDemoRentador };
}

// ============================================================================
// Tarea 4 — Invitaciones, citas y chats (SOLO vía las funciones reales)
// ============================================================================

async function crearInvitacion(client, { emisorId, receptorId, tipo, bebidaBarId, key }) {
  const { rows } = await client.query(
    `select * from public.crear_invitacion($1, $2, $3, $4, $5, $6, $7)`,
    [emisorId, receptorId, tipo, bebidaBarId, 30, 'Por confirmar', key],
  );
  return rows[0];
}

async function responderInvitacion(client, { receptorId, invitacionId, accion, bebidaBarId }) {
  const { rows } = await client.query(
    `select public.responder_invitacion($1, $2, $3, $4) as resultado`,
    [receptorId, invitacionId, accion, bebidaBarId],
  );
  return rows[0].resultado;
}

async function citaDe(client, invitacionId) {
  const { rows } = await client.query(`select * from public.citas where invitacion_id = $1`, [invitacionId]);
  return rows[0];
}

async function confirmarCita(client, { amigoId, citaId, zona, hora, mensaje }) {
  const { rows } = await client.query(
    `select public.confirmar_cita($1, $2, $3, $4, $5) as resultado`,
    [amigoId, citaId, zona, hora, mensaje],
  );
  return rows[0].resultado;
}

async function tieneMensajes(client, citaId) {
  const { rows } = await client.query(`select count(*)::int as n from public.chat_mensajes where cita_id = $1`, [
    citaId,
  ]);
  return rows[0].n > 0;
}

async function insertarMensaje(client, { citaId, emisorId, texto, createdAt }) {
  const { rows } = await client.query(
    `insert into public.chat_mensajes (cita_id, emisor_id, texto, created_at)
     values ($1, $2, $3, coalesce($4, now()))
     returning oculto`,
    [citaId, emisorId, texto, createdAt ?? null],
  );
  return rows[0].oculto;
}

// crear_invitacion/responder_invitacion(aceptar) exigen KYC 'verificado' tanto
// del emisor como del receptor que acepta — sin eso ninguna invitación/cita de
// SU cuenta es sembrable (bloqueante, no contemplado por el plan original).
// Decisión del usuario (2026-09-04): marcarlo verificado. Es dato REAL suyo,
// no de demo — no lleva flags->>'demo' y la limpieza jamás lo toca.
async function asegurarUsuarioVerificado(client, targetUserId) {
  const { rows } = await client.query(`select kyc_estado from public.profiles where id = $1`, [targetUserId]);
  if (rows[0].kyc_estado === 'verificado') {
    console.log("✓ KYC — tu cuenta ya estaba 'verificado', sin cambios.");
    return;
  }
  await client.query(
    `update public.profiles set kyc_estado = 'verificado', verificado_at = now() where id = $1`,
    [targetUserId],
  );
  console.log(
    "✓ KYC — tu cuenta pasó a 'verificado' (decisión explícita del usuario, 2026-09-04): " +
      'sin esto ninguna invitación/cita de tu propia cuenta era sembrable.',
  );
}

async function seedInvitacionesCitasChat(client, { targetUserId, barUsuario, barDemoRentador }) {
  const V = byAlias.Vale.id;
  const S = byAlias.Seba.id;
  const C = byAlias.Cami.id;
  const A = byAlias.Andy.id;

  // --- Recibidas por el usuario (solicitud amigo → él como rentador) --------
  await crearInvitacion(client, {
    emisorId: V,
    receptorId: targetUserId,
    tipo: 'solicitud',
    bebidaBarId: null,
    key: 'demo-seed:recibida-pendiente',
  }); // queda pendiente, sin tocar

  const invB = await crearInvitacion(client, {
    emisorId: S,
    receptorId: targetUserId,
    tipo: 'solicitud',
    bebidaBarId: null,
    key: 'demo-seed:recibida-aceptada',
  });
  await responderInvitacion(client, {
    receptorId: targetUserId,
    invitacionId: invB.id,
    accion: 'aceptar',
    bebidaBarId: barUsuario.A.id,
  });
  const citaPendiente = await citaDe(client, invB.id); // nace 'pendiente', se deja así

  const invC = await crearInvitacion(client, {
    emisorId: C,
    receptorId: targetUserId,
    tipo: 'solicitud',
    bebidaBarId: null,
    key: 'demo-seed:recibida-rechazada',
  });
  await responderInvitacion(client, {
    receptorId: targetUserId,
    invitacionId: invC.id,
    accion: 'rechazar',
    bebidaBarId: null,
  });

  // --- Enviadas por el usuario (invitacion él como rentador → amigo) --------
  await crearInvitacion(client, {
    emisorId: targetUserId,
    receptorId: C,
    tipo: 'invitacion',
    bebidaBarId: barUsuario.D1.id,
    key: 'demo-seed:enviada-pendiente',
  }); // queda pendiente

  const invE = await crearInvitacion(client, {
    emisorId: targetUserId,
    receptorId: A,
    tipo: 'invitacion',
    bebidaBarId: barUsuario.D2.id,
    key: 'demo-seed:enviada-aceptada-confirmada',
  });
  await responderInvitacion(client, { receptorId: A, invitacionId: invE.id, accion: 'aceptar', bebidaBarId: null });
  const citaAConfirmar = await citaDe(client, invE.id);
  // Offset -05:00 EXPLÍCITO: el saneamiento de zona horaria (fase 4.8) aún no
  // existe. Sin el offset, la hora quedaría corrida 5h y parecería un bug de
  // la siembra en vez de la deuda ya conocida.
  await confirmarCita(client, {
    amigoId: A,
    citaId: citaAConfirmar.id,
    zona: 'Parque Kennedy, Miraflores',
    hora: '2026-09-10 19:00:00-05:00',
    mensaje: 'Nos vemos ahí, cualquier cosa te aviso.',
  });

  const invF = await crearInvitacion(client, {
    emisorId: targetUserId,
    receptorId: V,
    tipo: 'invitacion',
    bebidaBarId: barUsuario.D3.id,
    key: 'demo-seed:enviada-rechazada',
  });
  await responderInvitacion(client, { receptorId: V, invitacionId: invF.id, accion: 'rechazar', bebidaBarId: null });

  const invG = await crearInvitacion(client, {
    emisorId: targetUserId,
    receptorId: S,
    tipo: 'invitacion',
    bebidaBarId: barUsuario.D4.id,
    key: 'demo-seed:enviada-aceptada-sin-chat',
  });
  await responderInvitacion(client, { receptorId: S, invitacionId: invG.id, accion: 'aceptar', bebidaBarId: null });
  const citaSinChat = await citaDe(client, invG.id); // pendiente, sin mensajes

  // --- Flavor: un rentador de demo también deja una bebida bloqueada --------
  await crearInvitacion(client, {
    emisorId: byAlias.Rodri.id,
    receptorId: V,
    tipo: 'invitacion',
    bebidaBarId: barDemoRentador.Rodri[0].id,
    key: 'demo-seed:flavor-rodri-vale',
  }); // queda pendiente adrede

  // --- Chats -----------------------------------------------------------------
  // 1) Iniciada (2-3 mensajes) — cita aún pendiente (invB/citaPendiente).
  //    Idempotente: si ya hay mensajes en esta cita (segunda corrida), se
  //    salta — un `npm run demo:seed` repetido no duplica el chat.
  if (!(await tieneMensajes(client, citaPendiente.id))) {
    await insertarMensaje(client, {
      citaId: citaPendiente.id,
      emisorId: S,
      texto: 'Hola! Vi tu perfil, me encantaría que salgamos algún día 😊',
      createdAt: '2026-09-04 18:00:00-05:00',
    });
    await insertarMensaje(client, {
      citaId: citaPendiente.id,
      emisorId: targetUserId,
      texto: 'Hola Seba! Claro, cuéntame qué tienes en mente.',
      createdAt: '2026-09-04 18:05:00-05:00',
    });
  }

  // 2) Con historia (8-10 mensajes, ida y vuelta) — cita confirmada
  //    (invE/citaAConfirmar). Incluye UN mensaje que dispara la moderación
  //    a propósito, para que el usuario vea cómo se comporta esa pantalla.
  let mensajeOculto = null;
  if (!(await tieneMensajes(client, citaAConfirmar.id))) {
    const historia = [
      [targetUserId, 'Hola Andy! Qué bueno que aceptaste, ¿cómo va tu semana?'],
      [A, 'Todo bien por acá! Con ganas de la salida del sábado.'],
      [targetUserId, 'Genial. ¿Te parece Parque Kennedy a las 7pm?'],
      [A, 'Perfecto, ahí estaré.'],
      [targetUserId, '¿Prefieres que caminemos por Larcomar o nos quedamos por el parque?'],
      [A, 'Por el parque está bien, así conversamos con calma.'],
      [targetUserId, 'Dale. Cualquier cambio te aviso por acá.'],
      [A, '¿Tienes Yape? Así te paso el resto directo'], // dispara moderación (sin tilde: el trigger matchea substring literal "yape")
      [targetUserId, 'Mejor seguimos por el chat de la app, así queda todo registrado 🙂'],
      [A, 'Tienes razón, mejor así.'],
    ];
    let t = new Date('2026-09-06T20:00:00-05:00').getTime();
    for (const [emisorId, texto] of historia) {
      const createdAt = new Date(t).toISOString();
      const oculto = await insertarMensaje(client, { citaId: citaAConfirmar.id, emisorId, texto, createdAt });
      if (oculto) mensajeOculto = texto;
      t += 6 * 60 * 1000; // +6 min entre mensajes
    }
  } else {
    const { rows } = await client.query(
      `select texto from public.chat_mensajes where cita_id = $1 and oculto limit 1`,
      [citaAConfirmar.id],
    );
    mensajeOculto = rows[0]?.texto ?? null;
  }

  // 3) Sin mensajes — chat abierto que nadie estrenó (invG/citaSinChat).

  const disc = await discrepancias(client);
  if (disc.length > 0) {
    console.error('✗ Tarea 4 — detectar_discrepancias_sp3() NO da cero filas:', disc);
    throw new Error('Conciliación rota tras sembrar invitaciones/citas. Deteniendo.');
  }

  console.log('✓ Tarea 4 — invitaciones/citas/chats sembrados vía las funciones reales. Conciliación: 0.');
  return { mensajeOculto, citaConHistoria: citaAConfirmar.id, citaIniciada: citaPendiente.id, citaVacia: citaSinChat.id };
}

// ============================================================================
// Tarea 6 — Rol a demanda
// ============================================================================

async function setRol(client, targetUserId, rol) {
  await client.query(`update public.profiles set rol = $1 where id = $2`, [rol, targetUserId]);
  console.log(
    `✓ Tarea 6 — tu cuenta ahora es '${rol}'. El descubrimiento pasa a mostrar el rol contrario, ` +
      `y las invitaciones ya sembradas quedan con tu cuenta en el papel opuesto al que tenían — ` +
      `no es un bug de la siembra, es consecuencia de tener una cuenta y dos roles.`,
  );
}

// ============================================================================
// Tarea 5 — Limpieza
// ============================================================================

async function limpiar(client) {
  const ids = await getDemoIds(client);

  // Defensa explícita (Tarea 5, Step 2): si hay MÁS perfiles marcados demo de
  // los que este script sembró, algo los marcó de más — abortar sin borrar
  // nada, en vez de arrastrar filas que no sembramos nosotros.
  if (ids.length > DEMO_PROFILES.length) {
    throw new Error(
      `Hay ${ids.length} perfiles con flags->>'demo'='true', pero este script solo sembró ` +
        `${DEMO_PROFILES.length}. Abortando sin borrar nada — el delete alcanzaría más filas de ` +
        'las sembradas.',
    );
  }

  // Ojo: las compras de la Tarea 3 para LA CUENTA DEL USUARIO (bar/ledger/
  // ordenes_pago de su bar de rentador) tienen perfil_id = su id REAL, no uno
  // de `ids` — filtrar solo por perfil_id demo las dejaría huérfanas (rompió
  // el primer ciclo sembrar→limpiar→sembrar: comprarBebidaDemo encontraba la
  // orden vieja por idempotency_key y devolvía bar ya bloqueada de la corrida
  // anterior). Toda compra de este script, sea de quien sea, lleva el prefijo
  // 'demo-seed:' en idempotency_key — es la marca real para dinero, igual que
  // flags->>'demo' lo es para perfiles.
  const { rows: ordenes } = await client.query(
    `select id from public.ordenes_pago where idempotency_key like 'demo-seed:%'`,
  );
  const ordenIds = ordenes.map((r) => r.id);

  if (ids.length === 0 && ordenIds.length === 0) {
    console.log('✓ Tarea 5 — nada que limpiar.');
    return;
  }

  // ledger y ordenes_pago NO tienen on delete cascade sobre profiles (a
  // diferencia de bar) — hay que vaciarlos primero o el borrado de abajo
  // choca con la FK. Deuda de invariante #4 anticipada en backlog desde la
  // fase 3.4: se resuelve acá, explícito.
  //
  // ledger además tiene un trigger que bloquea CUALQUIER delete/update, sin
  // excepción de rol (public.ledger_append_only(), 20260723120000) — es la
  // invariante contable real, no un permiso. `session_replication_role =
  // replica` desactiva los triggers SOLO dentro de esta transacción (con
  // SET LOCAL, revierte solo al hacer commit) para esta ÚNICA sentencia de
  // limpieza de demo, acotada a las órdenes ya identificadas por su prefijo
  // 'demo-seed:' más arriba. No es un bypass general: fuera de esta
  // transacción el append-only sigue absoluto, y el chequeo de conciliación
  // de abajo (detectar_discrepancias_sp3) confirma que no quedó nada
  // descuadrado.
  if (ordenIds.length > 0) {
    await client.query('begin');
    await client.query('set local session_replication_role = replica');
    await client.query(`delete from public.ledger where referencia_id = any($1::uuid[])`, [ordenIds]);
    await client.query('commit');
    await client.query(`delete from public.ordenes_pago where id = any($1::uuid[])`, [ordenIds]);
  }

  // Borrar por auth.users (no por profiles): profiles.id → auth.users.id SÍ
  // es on delete cascade, y eso arrastra bar / preferencias_salida /
  // invitaciones (→ citas → chat_mensajes) en cadena — INCLUIDAS las
  // invitaciones donde el usuario real es emisor/receptor (cascada por el
  // lado demo de la fila). Tiene que ir DESPUÉS de soltar ledger/ordenes_pago
  // (arriba) y ANTES de borrar el bar propio del usuario (abajo): sus filas
  // de bar siguen referenciadas por esas invitaciones hasta este punto.
  if (ids.length > 0) {
    await client.query(`delete from auth.users where id = any($1::uuid[])`, [ids]);
  }

  // Bar propio del usuario (perfil_id = su id real): sus filas de demo llevan
  // el mismo prefijo 'mock-escrow-demo-' en escrow_ref. El de los perfiles
  // demo ya se fue por cascada arriba; esto es un no-op seguro para esas.
  await client.query(`delete from public.bar where escrow_ref like 'mock-escrow-demo-%'`);

  const disc = await discrepancias(client);
  if (disc.length > 0) {
    console.error('✗ Tarea 5 — la limpieza dejó la conciliación descuadrada:', disc);
    throw new Error('Limpieza incompleta — peor que no limpiar. Deteniendo.');
  }
  console.log(
    `✓ Tarea 5 — ${ids.length} perfiles de demo, ${ordenIds.length} órdenes de dinero (propias y ajenas) ` +
      `y su rastro borrados. Conciliación: 0.`,
  );
}

// ============================================================================
// main
// ============================================================================

async function main() {
  const client = await connect();
  try {
    if (LIMPIAR) {
      await limpiar(client);
      return;
    }

    if (ROL_ARG) {
      const usuario = await resolveTargetUser(client, USUARIO_EMAIL);
      await setRol(client, usuario.id, ROL_ARG);
      return;
    }

    const usuario = await resolveTargetUser(client, USUARIO_EMAIL);

    // Deja la cuenta como 'rentador' PRIMERO (Tarea 6, decisión del usuario):
    // toda la Tarea 4 asume esa dirección (invitacion = él → amigo de demo,
    // solicitud = amigo de demo → él) para que confirmar_cita determine "el
    // amigo" correctamente.
    if (usuario.rol !== 'rentador') {
      await setRol(client, usuario.id, 'rentador');
    } else {
      console.log("✓ Tarea 6 — tu cuenta ya era 'rentador', sin cambios.");
    }

    await asegurarUsuarioVerificado(client, usuario.id);
    await seedAuthUsersYProfiles(client);
    await seedFotos();
    const { barUsuario, barDemoRentador } = await seedBar(client, usuario.id);
    const resumen = await seedInvitacionesCitasChat(client, { targetUserId: usuario.id, barUsuario, barDemoRentador });

    // ---- Reporte final ----
    const conteos = await client.query(`
      select
        (select count(*) from public.profiles where flags->>'demo'='true') as perfiles_demo,
        (select count(*) from public.bar) as bar,
        (select count(*) from public.ledger) as ledger,
        (select count(*) from public.ordenes_pago) as ordenes_pago,
        (select count(*) from public.invitaciones) as invitaciones,
        (select count(*) from public.citas) as citas,
        (select count(*) from public.chat_mensajes) as chat_mensajes
    `);
    const porEstadoInv = await client.query(
      `select estado, count(*) from public.invitaciones group by estado order by estado`,
    );
    const porEstadoCita = await client.query(`select estado, count(*) from public.citas group by estado order by estado`);

    console.log('\n=== Reporte de siembra ===');
    console.table(conteos.rows[0]);
    console.log('Invitaciones por estado:', porEstadoInv.rows);
    console.log('Citas por estado:', porEstadoCita.rows);
    console.log(`Chat con historia (con el mensaje que dispara moderación): cita ${resumen.citaConHistoria}`);
    console.log(`  → mensaje ocultado: ${JSON.stringify(resumen.mensajeOculto)}`);
    console.log(`Chat iniciada (2 mensajes): cita ${resumen.citaIniciada}`);
    console.log(`Chat vacío (sin estrenar): cita ${resumen.citaVacia}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
