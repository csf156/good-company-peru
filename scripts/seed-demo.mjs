// Siembra y limpieza de datos de DEMO (Fase D.3, plan
// docs/superpowers/plans/2026-09-04-datos-demo.md, Tareas 2-6).
//
// Desechable y marcado: todo perfil sembrado lleva flags->>'demo' = 'true'.
// La limpieza borra SOLO eso. El catálogo de bebidas es dato de producto y
// vive en su propia migración (Tarea 1) — este script no lo toca.
//
// SUSPENDIDO desde Fase E.1 (2026-09-09): la siembra de bar (Tarea 3 de este
// script) y de invitaciones/citas/chat (Tarea 4) están cortadas a propósito.
// El rediseño de dinero (docs/superpowers/plans/2026-09-09-fase-e1-esquema-
// sbs.md) mató la tabla `bar` y con ella tres funciones que este script
// llamaba: crear_invitacion / responder_invitacion (insertan/leen `bar`
// directo) y detectar_discrepancias_sp3() (su invariante #4 cuenta filas de
// `bar`). Las tres existen todavía pero invocarlas hoy falla con "relation
// bar does not exist" — se reescriben en E.2 sobre preautorización/captura.
// Hasta entonces este script solo siembra lo que no depende de ellas:
// perfiles con foto (Tarea 2) y el cambio de rol a demanda (Tarea 6).
//
// Reglas de oro que siguen vigentes:
//   - El script se niega a tocar cualquier perfil sin flags->>'demo'='true',
//     salvo el cambio de rol explícito de la Tarea 6 sobre el perfil del
//     usuario real (identificado por email, nunca por su sola ausencia de
//     marca — el perfil viejo de prueba de fases previas tampoco tiene la
//     marca y debe quedar intacto).
//
// Uso:
//   npm run demo:seed                      — siembra perfiles+fotos (Tarea 2,
//                                             Tareas 3/4 suspendidas) y deja
//                                             la cuenta del usuario como
//                                             'rentador' (decisión del usuario).
//   npm run demo:seed -- --rol=amigo       — solo cambia el rol de su cuenta.
//   npm run demo:limpiar                   — borra todo lo sembrado.

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
  console.log(`✓ Tarea 2 — 8 fotos subidas a 'fotos'. Muestra verificada: ${muestra.alias} (${bytes} bytes).`);
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

  if (ids.length === 0) {
    console.log('✓ Tarea 5 — nada que limpiar.');
    return;
  }

  // Con la siembra de bar/ledger/ordenes_pago/invitaciones suspendida (ver
  // nota de cabecera, Fase E.1), no hay dinero ni citas de demo que limpiar
  // aparte — borrar por auth.users basta: profiles.id → auth.users.id es on
  // delete cascade y arrastra preferencias_salida (y cualquier invitación
  // vieja donde el perfil demo participe, si quedó alguna de antes de E.1).
  await client.query(`delete from auth.users where id = any($1::uuid[])`, [ids]);

  console.log(`✓ Tarea 5 — ${ids.length} perfiles de demo y su rastro (cascada) borrados.`);
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

    console.log(
      "\n⚠ Tarea 3 (bar) y Tarea 4 (invitaciones/citas/chat) SUSPENDIDAS: dependen de " +
        "crear_invitacion / responder_invitacion / detectar_discrepancias_sp3(), rotas por " +
        "la Fase E.1 hasta que E.2 las reescriba sobre preautorización/captura.",
    );

    // ---- Reporte final ----
    const conteos = await client.query(`
      select (select count(*) from public.profiles where flags->>'demo'='true') as perfiles_demo
    `);

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
