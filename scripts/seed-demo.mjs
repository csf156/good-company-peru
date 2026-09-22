// Siembra y limpieza de datos de DEMO (Fase D.3, plan
// docs/superpowers/plans/2026-09-04-datos-demo.md, Tareas 2-6; revivida en
// E.2b Tarea 6 sobre el flujo de dinero nuevo — preautorizar al invitar,
// capturar al aceptar).
//
// Desechable y marcado: todo perfil sembrado lleva flags->>'demo' = 'true'.
// La limpieza borra SOLO eso. El catálogo de bebidas es dato de producto y
// vive en su propia migración (Tarea 1) — este script no lo toca.
//
// Igual que antes de E.1: invitaciones/citas se siembran vía las funciones
// SQL reales (crear_invitacion, responder_invitacion), nunca por inserts a
// mano. Nuevo en E.2b: la preautorización que en producción hace el Edge
// Function (llamar al proveedor, luego confirmar_preautorizacion) se simula
// acá mismo con el mock — `preautorizar()` reproduce exactamente esa cadena.
//
// ADVERTENCIA que no existía antes de esta tarea: `ordenes_pago.perfil_id` y
// `ledger.perfil_id` NO tienen `on delete cascade` — a propósito, desde la
// Fase 3.0 ("el ledger es un registro financiero que sobrevive; un perfil
// con historial no se borra en duro"). Antes de E.2b eso no importaba
// porque nada escribía ledger de demo. Ahora sí: cualquier perfil demo que
// participe en una invitación ACEPTADA (con su captura) queda con filas de
// ledger para siempre, y `--limpiar` NO PUEDE borrarlo en duro — ver
// `limpiar()` más abajo, que lo hace explícito en vez de fallar en silencio.
//
// Reglas de oro que siguen vigentes:
//   - El script se niega a tocar cualquier perfil sin flags->>'demo'='true',
//     salvo el cambio de rol explícito de la Tarea 6 sobre el perfil del
//     usuario real (identificado por email, nunca por su sola ausencia de
//     marca — el perfil viejo de prueba de fases previas tampoco tiene la
//     marca y debe quedar intacto).
//
// Uso:
//   npm run demo:seed                      — siembra completa (perfiles+
//                                             fotos+invitaciones/citas/chat)
//                                             y deja la cuenta del usuario
//                                             como 'rentador' (decisión del
//                                             usuario).
//   npm run demo:seed -- --rol=amigo       — solo cambia el rol de su cuenta.
//   npm run demo:limpiar                   — borra lo sembrado que se pueda
//                                             borrar (ver advertencia arriba).

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
  // F.1 Tarea 5 — dos perfiles nuevos, consecuencia del índice único
  // `invitaciones_una_relacion_activa_por_par` (spec §6). Antes de esta
  // tarea, los escenarios E (Vale→Rodri) y F (Seba→Fer) reusaban el MISMO
  // par que A (Rodri→Vale) y B (Fer→Seba) respectivamente — dos relaciones
  // no-terminales a la vez sobre un par, exactamente lo que el índice
  // rechaza. Bruno y Nina absorben la mitad de E y F que no es Rodri/Fer (ver
  // el comentario del escenario E/F más abajo para por qué esa mitad y no la
  // otra): así Rodri y Fer conservan su único papel de "el que paga" (A y B),
  // y ninguna aserción/dato de A-D-G cambia.
  {
    id: 'd0000000-0000-0000-0000-000000000009',
    email: 'demo9@ayni.test',
    rol: 'rentador',
    nombre: 'Bruno Salazar Ponce',
    alias: 'Bruno',
    ageYears: 33,
    genero: 'Hombre',
    profesion: 'Contador',
    hobbies: ['musica', 'viajar', 'futbol'],
    tipoSalida: ['comer', 'conciertos'],
    color: '#5C4033',
    distritos: [],
  },
  {
    id: 'd0000000-0000-0000-0000-000000000010',
    email: 'demo10@ayni.test',
    rol: 'amigo',
    nombre: 'Nina Vargas Ochoa',
    alias: 'Nina',
    ageYears: 25,
    genero: 'Mujer',
    profesion: 'Fotógrafa',
    hobbies: ['fotografia', 'senderismo', 'cine'],
    tipoSalida: ['turistear', 'conversar'],
    color: '#C08552',
    distritos: ['Miraflores', 'Barranco'],
  },
];

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
  console.log(
    `✓ Tarea 2 — ${DEMO_PROFILES.length} fotos subidas a 'fotos'. Muestra verificada: ${muestra.alias} (${bytes} bytes).`,
  );
}

// crear_invitacion/responder_invitacion(aceptar) exigían KYC 'verificado'
// tanto del emisor como del receptor que acepta. Suspendido junto con las
// Tareas 3/4 de arriba (ver nota de cabecera), pero se deja corriendo: es
// dato REAL del usuario (no lleva flags->>'demo', la limpieza jamás lo toca)
// y no depende de `bar` ni de las funciones rotas — no hace daño mantenerlo
// verificado de cara a cuando E.2 reviva la siembra de invitaciones.
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

// ============================================================================
// Tarea 4 — Invitaciones, citas y chat (revivida en E.2b Tarea 6 sobre el
// flujo de dinero nuevo — preautorizar al invitar/al aceptar solicitud,
// capturar al aceptar). Siembra por las funciones SQL reales
// (crear_invitacion / responder_invitacion / confirmar_cita), nunca por
// inserts a mano — mismo criterio que la versión pre-E.1 de este script.
//
// La preautorización que en producción hace el Edge Function (proveedor
// PRIMERO, base DESPUÉS — ver supabase/functions/crear-invitacion/index.ts y
// responder-invitacion/index.ts) se simula acá mismo con `preautorizar()`,
// que reproduce EXACTAMENTE esa cadena: lee la orden 'pendiente' de la
// invitación y la confirma con el mismo mock determinista que usan las
// Edge Functions (`hold:<orden_id>`, siempre ok — ver mockPreautorizar en
// supabase/functions/_shared/pagos.ts).
// ============================================================================

async function getCatalogoIds(client) {
  const { rows } = await client.query(
    `select id from public.bebidas_catalogo where activo order by valor_v`,
  );
  if (rows.length === 0) {
    throw new Error("bebidas_catalogo está vacío — no se puede sembrar ninguna invitación.");
  }
  return rows.map((r) => r.id);
}

async function preautorizar(client, invitacionId) {
  const { rows } = await client.query(
    `select id, estado from public.ordenes_pago
      where invitacion_id = $1
      order by created_at desc limit 1`,
    [invitacionId],
  );
  const orden = rows[0];
  // Sin orden (una `solicitud` recién creada, Tarea 3c) o ya resuelta (un
  // reintento): nada que preautorizar — mismo guard que `debePreautorizar`
  // en _shared/pagos.ts.
  if (!orden || orden.estado !== 'pendiente') return;
  const providerRef = `hold:${orden.id}`;
  await client.query(`select public.confirmar_preautorizacion($1, true, $2)`, [orden.id, providerRef]);
}

async function crearInvitacion(client, { emisorId, receptorId, tipo, bebidaCatalogoId, key }) {
  const { rows } = await client.query(
    `select * from public.crear_invitacion($1,$2,$3,$4,$5,$6,$7)`,
    [emisorId, receptorId, tipo, bebidaCatalogoId, 30, 'Por confirmar', key],
  );
  const inv = rows[0];
  // Solo `invitacion` crea su orden de una (spec §4) — simula el paso 5-6 de
  // crear-invitacion/index.ts. Una `solicitud` no tiene nada que preautorizar
  // todavía; preautorizar() lo detecta sola (no encuentra orden 'pendiente').
  await preautorizar(client, inv.id);
  return inv;
}

async function responderInvitacion(client, { receptorId, invitacionId, accion, bebidaCatalogoId }) {
  const { rows } = await client.query(
    `select public.responder_invitacion($1,$2,$3,$4) as resultado`,
    [receptorId, invitacionId, accion, bebidaCatalogoId],
  );
  const resultado = rows[0].resultado;
  // Solo el camino `solicitud` aceptada devuelve 'preautorizando' — simula el
  // resto de responder-invitacion/index.ts (paso proveedor + confirmar).
  if (resultado === 'preautorizando') {
    await preautorizar(client, invitacionId);
    return 'aceptada';
  }
  return resultado;
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

async function insertarMensaje(client, { citaId, emisorId, texto }) {
  const { rows } = await client.query(
    `insert into public.chat_mensajes (cita_id, emisor_id, texto) values ($1, $2, $3) returning oculto`,
    [citaId, emisorId, texto],
  );
  return rows[0].oculto;
}

async function tieneMensajes(client, citaId) {
  const { rows } = await client.query(`select count(*)::int as n from public.chat_mensajes where cita_id = $1`, [
    citaId,
  ]);
  return rows[0].n > 0;
}

// Siete escenarios: cubren cada (tipo, estado) en el que una invitación puede
// nacer o quedar bajo el mock (que siempre preautoriza ok — 'expirada' no es
// alcanzable sin simular un fallo del proveedor, queda fuera a propósito).
// Solo dos perfiles terminan con filas de ledger (Rodri y Fer, los que pagan
// en A y F) — nunca emparejados entre sí, así que ninguna invitación queda
// atrapada sin poder limpiarse (ver limpiar()). Sigue siendo cierto tras F.1
// Tarea 5 (ver los comentarios de E y F más abajo): Bruno y Nina absorben el
// choque de par con A/B, Rodri y Fer no se tocan.
async function seedInvitacionesCitasChat(client) {
  const catalogo = await getCatalogoIds(client);
  const bebida = (i) => catalogo[i % catalogo.length];
  const perfil = Object.fromEntries(DEMO_PROFILES.map((d) => [d.alias, d.id]));
  let contadorKey = 0;
  const key = () => `demo-seed-${++contadorKey}`;

  let invitaciones = 0;
  let citasConfirmadas = 0;
  let mensajesTotales = 0;
  let mensajesOcultos = 0;
  // Ids de las invitaciones que crea ESTA corrida — para poder distinguir,
  // en el chequeo de discrepancias de más abajo, "esto lo rompió lo que
  // acabo de sembrar" de "esto ya estaba roto de antes" (ver ese chequeo).
  const invitacionIds = [];

  // A) invitación (Rodri→Vale) aceptada, capturada, cita confirmada, con
  //    historial de chat que incluye un mensaje que dispara moderación.
  {
    const inv = await crearInvitacion(client, {
      emisorId: perfil.Rodri,
      receptorId: perfil.Vale,
      tipo: 'invitacion',
      bebidaCatalogoId: bebida(0),
      key: key(),
    });
    invitaciones++;
    invitacionIds.push(inv.id);
    await responderInvitacion(client, {
      receptorId: perfil.Vale,
      invitacionId: inv.id,
      accion: 'aceptar',
      bebidaCatalogoId: null,
    });
    const cita = await citaDe(client, inv.id);
    await confirmarCita(client, {
      amigoId: perfil.Vale,
      citaId: cita.id,
      zona: 'Miraflores',
      hora: new Date(Date.now() + 2 * 86400000).toISOString(),
      mensaje: 'Nos vemos en el parque Kennedy',
    });
    citasConfirmadas++;
    // A diferencia de crear_invitacion/responder_invitacion/confirmar_cita,
    // chat_mensajes no tiene idempotencia propia (no hay unique/idempotency_
    // key) — en un reintento sobre una cita YA sembrada (crearInvitacion
    // reusó la invitación por su idempotency_key), insertar sin este guard
    // duplicaría el historial en cada corrida de `npm run demo:seed`.
    if (!(await tieneMensajes(client, cita.id))) {
      await insertarMensaje(client, {
        citaId: cita.id,
        emisorId: perfil.Rodri,
        texto: '¡Hola! Nos vemos el jueves 😊',
      });
      mensajesTotales++;
      const oculto = await insertarMensaje(client, {
        citaId: cita.id,
        emisorId: perfil.Vale,
        texto: 'Mejor te paso mi yape así no pagamos comisión',
      });
      mensajesTotales++;
      if (oculto) mensajesOcultos++;
    }
  }

  // B) invitación (Fer→Seba) aceptada, capturada, cita SIN confirmar, sin chat.
  {
    const inv = await crearInvitacion(client, {
      emisorId: perfil.Fer,
      receptorId: perfil.Seba,
      tipo: 'invitacion',
      bebidaCatalogoId: bebida(1),
      key: key(),
    });
    invitaciones++;
    invitacionIds.push(inv.id);
    await responderInvitacion(client, {
      receptorId: perfil.Seba,
      invitacionId: inv.id,
      accion: 'aceptar',
      bebidaCatalogoId: null,
    });
  }

  // C) invitación (Gaby→Cami) rechazada — hold preautorizado anulado.
  {
    const inv = await crearInvitacion(client, {
      emisorId: perfil.Gaby,
      receptorId: perfil.Cami,
      tipo: 'invitacion',
      bebidaCatalogoId: bebida(2),
      key: key(),
    });
    invitaciones++;
    invitacionIds.push(inv.id);
    await responderInvitacion(client, {
      receptorId: perfil.Cami,
      invitacionId: inv.id,
      accion: 'rechazar',
      bebidaCatalogoId: null,
    });
  }

  // D) invitación (Diego→Andy) preautorizada, pendiente de respuesta.
  {
    const inv = await crearInvitacion(client, {
      emisorId: perfil.Diego,
      receptorId: perfil.Andy,
      tipo: 'invitacion',
      bebidaCatalogoId: bebida(3),
      key: key(),
    });
    invitaciones++;
    invitacionIds.push(inv.id);
  }

  // E) solicitud (Vale→Bruno) pendiente, nunca respondida — nace en
  //    'pendiente' directo (Tarea 3c), sin orden todavía.
  //
  //    F.1 Tarea 5: el receptor original era Rodri, MISMO par sin ordenar
  //    que A (Rodri→Vale) — A queda 'aceptada' (no-terminal) para siempre
  //    (sub-proyecto 5 no existe todavía, spec §3.1), así que E y A serían
  //    dos relaciones no-terminales a la vez sobre el par (Rodri, Vale):
  //    justo lo que `invitaciones_una_relacion_activa_por_par` (spec §6)
  //    rechaza. E no crea orden ni ledger (una solicitud sin responder nunca
  //    llega a preautorizar), así que cambiar su receptor no toca ninguna
  //    otra invariante del script — Bruno (perfil nuevo) releva a Rodri acá,
  //    y Rodri conserva su único papel de pagador en A.
  {
    const inv = await crearInvitacion(client, {
      emisorId: perfil.Vale,
      receptorId: perfil.Bruno,
      tipo: 'solicitud',
      bebidaCatalogoId: null,
      key: key(),
    });
    invitaciones++;
    invitacionIds.push(inv.id);
  }

  // F) solicitud (Nina→Fer) aceptada — el rentador asigna la bebida al
  //    aceptar, cita confirmada, chat vacío ("iniciada").
  //
  //    F.1 Tarea 5: el emisor original era Seba, MISMO par sin ordenar que B
  //    (Fer→Seba) — mismo choque que en E, esta vez con B ('aceptada',
  //    no-terminal). F SÍ paga (Fer captura al aceptar, como B) — por eso
  //    acá se cambia el lado CONTRARIO al de E: se releva a Seba (el amigo),
  //    no a Fer, para que Fer conserve su único papel de pagador (spec del
  //    comentario de cabecera de esta función: "solo dos perfiles terminan
  //    con filas de ledger — Rodri y Fer — nunca emparejados entre sí", que
  //    sigue siendo cierto tal cual). Nina (perfil nuevo) releva a Seba.
  {
    const inv = await crearInvitacion(client, {
      emisorId: perfil.Nina,
      receptorId: perfil.Fer,
      tipo: 'solicitud',
      bebidaCatalogoId: null,
      key: key(),
    });
    invitaciones++;
    invitacionIds.push(inv.id);
    await responderInvitacion(client, {
      receptorId: perfil.Fer,
      invitacionId: inv.id,
      accion: 'aceptar',
      bebidaCatalogoId: bebida(0),
    });
    const cita = await citaDe(client, inv.id);
    await confirmarCita(client, {
      amigoId: perfil.Nina,
      citaId: cita.id,
      zona: 'San Borja',
      hora: new Date(Date.now() + 3 * 86400000).toISOString(),
      mensaje: null,
    });
    citasConfirmadas++;
  }

  // G) solicitud (Cami→Gaby) rechazada — nunca tuvo orden, nada que anular.
  {
    const inv = await crearInvitacion(client, {
      emisorId: perfil.Cami,
      receptorId: perfil.Gaby,
      tipo: 'solicitud',
      bebidaCatalogoId: null,
      key: key(),
    });
    invitaciones++;
    invitacionIds.push(inv.id);
    await responderInvitacion(client, {
      receptorId: perfil.Gaby,
      invitacionId: inv.id,
      accion: 'rechazar',
      bebidaCatalogoId: null,
    });
  }

  console.log(
    `✓ Tarea 4 — ${invitaciones} invitaciones/solicitudes sembradas (7 escenarios: invitación ` +
      'aceptada+confirmada+chat con moderación, invitación aceptada sin confirmar, invitación ' +
      'rechazada, invitación pendiente, solicitud pendiente, solicitud aceptada+confirmada, ' +
      `solicitud rechazada), ${citasConfirmadas} citas confirmadas, ${mensajesTotales} mensajes ` +
      `(${mensajesOcultos} oculto por moderación, esperado — contiene 'yape').`,
  );

  // No sembrar discrepancias: el mismo chequeo que corre en pgTAP (14).
  //
  // Solo aborta por discrepancias cuya `referencia` sea una invitación de
  // ESTA corrida — no por el total de la tabla. Motivo real, no hipotético:
  // un bug ya corregido de limpiar() (esta misma tarea, antes de este fix)
  // borró en duro 4 órdenes YA CAPTURADAS antes de que existiera la guarda
  // `estado <> 'capturada'` de abajo — sus filas de ledger (append-only,
  // CLAUDE.md prohíbe DELETE/UPDATE sin excepción, ni siquiera para arreglar
  // esto) quedaron huérfanas para siempre en esta base de dev. Eso deja
  // 'escrow_captura_desbalance' (agregado global, no por invitación) en rojo
  // permanentemente — no es nuevo ni lo causó esta siembra. Ver
  // docs/backlog.md. Las clases por-invitación (con `referencia`) SÍ siguen
  // abortando duro si aparecen en una de las 7 de esta corrida.
  const { rows: discrepancias } = await client.query(`select * from public.detectar_discrepancias_sp3()`);
  const idsNuevos = new Set(invitacionIds);
  const nuevas = discrepancias.filter((d) => d.referencia && idsNuevos.has(d.referencia));
  const preexistentes = discrepancias.filter((d) => !nuevas.includes(d));

  if (nuevas.length > 0) {
    console.error(nuevas);
    throw new Error(
      `detectar_discrepancias_sp3() encontró ${nuevas.length} discrepancia(s) EN LO QUE ACABA DE ` +
        'SEMBRAR esta corrida — la siembra no debe crear discrepancias nuevas. Ver filas arriba.',
    );
  }

  if (preexistentes.length > 0) {
    console.log(
      `⚠ detectar_discrepancias_sp3() reporta ${preexistentes.length} discrepancia(s) preexistente(s) ` +
        '(no de esta corrida — ver comentario arriba y docs/backlog.md). No abortan la siembra:',
    );
    console.table(preexistentes);
  }

  console.log('✓ Tarea 4 — detectar_discrepancias_sp3() confirma 0 discrepancias nuevas de esta corrida.');
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

// Un perfil NO se puede borrar en duro si:
//   (a) tiene filas propias en `ledger` (append-only, sin cascada — pagó
//       algo), o
//   (b) es parte (emisor o receptor) de una invitación con una orden
//       'capturada' TODAVÍA VIVA. Encontrado sembrando dos veces seguidas en
//       esta misma tarea (E.2b Tarea 6): una orden 'capturada' escribe
//       ledger (capturar_orden), así que borrarla —aunque ordenes_pago en sí
//       NO sea append-only— deja esas filas de ledger huérfanas
//       (`ledger_sin_orden` en detectar_discrepancias_sp3()). Por eso la
//       orden capturada tiene que sobrevivir igual que el ledger, y
//       ordenes_pago.invitacion_id es 'no action' (no cascada): mientras esa
//       orden viva, su invitación tampoco se puede borrar, así que NINGUNA
//       de las dos partes de esa invitación es borrable — tenga o no ledger
//       propio (el que no pagó igual queda atrapado por el que sí).
async function perfilesBloqueados(client, ids) {
  if (ids.length === 0) return new Set();
  const { rows } = await client.query(
    `select p.id
       from unnest($1::uuid[]) as p(id)
      where exists (select 1 from public.ledger l where l.perfil_id = p.id)
         or exists (
              select 1
                from public.invitaciones i
                join public.ordenes_pago o on o.invitacion_id = i.id
               where o.estado = 'capturada'
                 and (i.emisor_id = p.id or i.receptor_id = p.id)
            )`,
    [ids],
  );
  return new Set(rows.map((r) => r.id));
}

async function limpiar(client) {
  const todos = await getDemoIds(client);

  if (todos.length === 0) {
    console.log('✓ Tarea 5 — nada que limpiar.');
    return;
  }

  // Defensa (Tarea 5, Step 2, endurecida en E.2b Tarea 6 tras un caso real:
  // dos perfiles de una verificación manual de E.2b Tareas 2/3 quedaron
  // marcados flags->>'demo'='true', sin ser de este script — y uno de ellos
  // estaba bloqueado). Comparar CANTIDADES (ids.length > DEMO_PROFILES.
  // length) se rompía permanentemente ante eso: ese sobrante nunca se va,
  // así que --limpiar abortaría por el resto de la vida del proyecto. En vez
  // de eso, se distingue por IDENTIDAD:
  //   - ajeno bloqueado (como el caso real de arriba): atrapado para siempre
  //     por la MISMA razón que uno propio (ver perfilesBloqueados) — no se
  //     toca nada suyo y no bloquea la limpieza de lo propio. Solo se informa.
  //   - ajeno SIN bloqueo: nada lo protege de un delete — si alguien lo marcó
  //     demo por error, esto es lo único que puede atraparlo antes de que
  //     `--limpiar` lo borre. Aborta TODO sin tocar nada, igual que antes.
  const idsPropios = new Set(DEMO_PROFILES.map((p) => p.id));
  const ajenos = todos.filter((id) => !idsPropios.has(id));

  if (ajenos.length > 0) {
    const ajenosBloqueados = await perfilesBloqueados(client, ajenos);
    const ajenosSinBloqueo = ajenos.filter((id) => !ajenosBloqueados.has(id));

    if (ajenosSinBloqueo.length > 0) {
      throw new Error(
        `Hay ${ajenosSinBloqueo.length} perfil(es) con flags->>'demo'='true' que este script NO ` +
          `sembró y que nada protege de un delete: ${ajenosSinBloqueo.join(', ')}. Algo los marcó ` +
          'de más — abortando sin borrar nada.',
      );
    }

    console.log(
      `⚠ ${ajenosBloqueados.size} perfil(es) demo AJENOS a este script (marcados por otra tarea, ` +
        'p.ej. una verificación manual) están bloqueados y quedan atrapados para siempre, igual que ' +
        'uno propio bloqueado — no se tocan y no bloquean la limpieza de abajo.',
    );
  }

  const ids = todos.filter((id) => idsPropios.has(id));
  if (ids.length === 0) {
    console.log('✓ Tarea 5 — nada propio que limpiar (solo quedaban perfiles ajenos, ver arriba).');
    return;
  }

  // Paso 1: se borra toda orden que NUNCA se capturó (pendiente,
  // preautorizada, anulada, fallida) — no escribió ledger, no deja rastro
  // que perder. Una orden 'capturada' se preserva a propósito (ver
  // perfilesBloqueados) — ANTES de tocar auth.users, para que el cascade de
  // abajo no choque con una orden no-capturada todavía viva (ordenes_pago no
  // tiene 'on delete cascade' desde profiles ni desde invitaciones).
  await client.query(
    `delete from public.ordenes_pago
      where estado <> 'capturada'
        and (perfil_id = any($1::uuid[])
          or invitacion_id in (
               select id from public.invitaciones
                where emisor_id = any($1::uuid[]) or receptor_id = any($1::uuid[])
             ))`,
    [ids],
  );

  // Paso 2: perfiles bloqueados (propios o no) no se tocan. El resto sí: su
  // cascada desde auth.users arrastra profiles/preferencias_salida, y de
  // regreso cualquier invitación/cita/chat donde participe — el cascade de
  // `invitaciones` dispara con CUALQUIERA de sus dos partes, así que una
  // invitación entre un perfil borrable y uno bloqueado igual se limpia
  // (su orden, si tenía una, ya no está capturada — Paso 1 la borró).
  const idsBloqueados = await perfilesBloqueados(client, ids);
  const idsBorrables = ids.filter((id) => !idsBloqueados.has(id));

  if (idsBorrables.length > 0) {
    await client.query(`delete from auth.users where id = any($1::uuid[])`, [idsBorrables]);
  }

  console.log(
    `✓ Tarea 5 — ${idsBorrables.length}/${ids.length} perfiles de demo y su rastro (cascada) borrados.`,
  );

  if (idsBloqueados.size > 0) {
    const alias = DEMO_PROFILES.filter((p) => idsBloqueados.has(p.id))
      .map((p) => p.alias)
      .join(', ');
    console.log(
      `⚠ ${idsBloqueados.size} perfil(es) de demo NO se pudieron borrar en duro (${alias}): tienen ` +
        'ledger propio o son parte de una invitación con una orden capturada — ambos append-only en ' +
        'la práctica, por diseño (un registro financiero sobrevive). Sus invitaciones SIN captura ' +
        '(y las citas/chat de esas) SÍ se limpiaron. El perfil, su foto, su invitación capturada y ' +
        'sus filas de ledger quedan para siempre — volver a sembrar los saltea (ON CONFLICT DO ' +
        'NOTHING), sin duplicarlos.',
    );
  }
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

    // Deja la cuenta como 'rentador' (Tarea 6, decisión del usuario) — se
    // mantiene aunque la Tarea 4 que dependía de esta dirección esté
    // suspendida (ver nota de cabecera): es la dirección de cuenta que el
    // usuario pidió para su propia cuenta, no un artefacto de la siembra.
    if (usuario.rol !== 'rentador') {
      await setRol(client, usuario.id, 'rentador');
    } else {
      console.log("✓ Tarea 6 — tu cuenta ya era 'rentador', sin cambios.");
    }

    await asegurarUsuarioVerificado(client, usuario.id);
    await seedAuthUsersYProfiles(client);
    await seedFotos();
    await seedInvitacionesCitasChat(client);

    // ---- Reporte final ----
    const demoIds = await getDemoIds(client);
    const conteos = await client.query(
      `select
         (select count(*) from public.profiles where id = any($1::uuid[])) as perfiles_demo,
         (select count(*) from public.invitaciones
            where emisor_id = any($1::uuid[]) or receptor_id = any($1::uuid[])) as invitaciones,
         (select count(*) from public.citas c
            join public.invitaciones i on i.id = c.invitacion_id
           where i.emisor_id = any($1::uuid[]) or i.receptor_id = any($1::uuid[])) as citas,
         (select count(*) from public.chat_mensajes m
            join public.citas c on c.id = m.cita_id
            join public.invitaciones i on i.id = c.invitacion_id
           where i.emisor_id = any($1::uuid[]) or i.receptor_id = any($1::uuid[])) as mensajes_chat,
         (select count(*) from public.ledger where perfil_id = any($1::uuid[])) as filas_ledger
      `,
      [demoIds],
    );

    console.log('\n=== Reporte de siembra ===');
    console.table(conteos.rows[0]);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
