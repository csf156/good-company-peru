-- pgTAP: esquema de la propuesta negociada (Fase F.1) — spec
-- docs/superpowers/specs/2026-09-16-propuesta-negociada-design.md.
--
-- F.1 solo prepara el esquema y los datos: estados nuevos, columnas, la
-- visibilidad de los estados nuevos, la resolución de duplicados y el índice
-- de una sola relación activa por par. NO añade funciones ni ningún mecanismo
-- de vencimiento, y NO cambia el comportamiento de crear_invitacion ni
-- responder_invitacion (eso es F.2; el vencimiento es F.3).
--
-- Este archivo crece por tareas: cada tarea de F.1 añade su sección aquí y sube
-- el `plan(N)` en la misma cantidad. Una sección por tema, en el orden de las
-- tareas; `finish()` y el cierre quedan siempre al final.
--
-- Sección 1 (Tarea 1): los cuatro estados nuevos de `estado_invitacion`. Se
-- comprueban leyendo `pg_enum`, NO usando el valor: un valor de enum recién
-- añadido no se puede usar en la misma transacción que lo crea (y este archivo
-- corre entero dentro de una).
--
-- Sección 2 (Tarea 2): la intención de cada bebida (`intencion_titulo` +
-- `intencion_detalle`, spec §2), la desaparición de "Ayni" del catálogo, y la
-- columna `invitaciones.momento_propuesto` con su contrato de zona horaria.
select plan(29);

-- ============================================================================
-- 1. Estados nuevos de estado_invitacion
-- ============================================================================
select ok(
  exists (select 1 from pg_enum
           where enumtypid = 'public.estado_invitacion'::regtype
             and enumlabel = 'contrapropuesta'),
  'estado_invitacion tiene el valor contrapropuesta');

select ok(
  exists (select 1 from pg_enum
           where enumtypid = 'public.estado_invitacion'::regtype
             and enumlabel = 'contrapropuesta_rechazada'),
  'estado_invitacion tiene el valor contrapropuesta_rechazada');

select ok(
  exists (select 1 from pg_enum
           where enumtypid = 'public.estado_invitacion'::regtype
             and enumlabel = 'retirada'),
  'estado_invitacion tiene el valor retirada');

select ok(
  exists (select 1 from pg_enum
           where enumtypid = 'public.estado_invitacion'::regtype
             and enumlabel = 'concluida'),
  'estado_invitacion tiene el valor concluida');

-- Ampliación ADITIVA: las etiquetas de antes siguen ahí. Guarda contra un
-- DROP/RENAME accidental de un valor existente (Postgres no permite quitar
-- valores de un enum, pero sí renombrarlos — y ya se renombró uno antes:
-- por_pagar → preautorizando, migración 20260910110000).
select is(
  (select count(*)::int from pg_enum
    where enumtypid = 'public.estado_invitacion'::regtype
      and enumlabel in ('pendiente', 'aceptada', 'rechazada', 'expirada',
                        'preautorizando')),
  5, 'estado_invitacion conserva sus 5 valores previos (pendiente, aceptada, rechazada, expirada, preautorizando)');

-- ============================================================================
-- 2. Intención de cada bebida, "Ayni" y momento propuesto (Tarea 2)
-- ============================================================================
-- Fixtures (como postgres, que bypassa RLS): dos perfiles para la invitación
-- del ida y vuelta de zona horaria y para impersonar a un usuario
-- `authenticated`.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'ana@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'beto@test.dev', '', now(), now(), now(), '', '', '', '');

insert into public.profiles (id, rol, alias)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias'),
  ('22222222-2222-2222-2222-222222222222', 'amigo', 'BetoAlias');

-- --- 2a. Las dos columnas de intención existen --------------------------------
-- Van en DOS columnas (título en negrita + detalle) para que F.4 tenga
-- jerarquía tipográfica sin partir un string por ". " en el cliente. Son
-- NULLABLE a propósito (decisión de F.1): un NOT NULL habría roto los
-- fixtures de 9 archivos pgTAP de fases cerradas que insertan bebidas sin
-- intención. El costo es que una bebida futura puede crearse sin intención, y
-- la UI de F.4 debe tolerarlo. La coherencia la fija un check (sección 2c).
select has_column('public', 'bebidas_catalogo', 'intencion_titulo',
  'bebidas_catalogo tiene intencion_titulo');
select has_column('public', 'bebidas_catalogo', 'intencion_detalle',
  'bebidas_catalogo tiene intencion_detalle');
select col_is_null('public', 'bebidas_catalogo', 'intencion_titulo',
  'intencion_titulo es nullable (decisión: no romper fixtures de fases cerradas)');
select col_is_null('public', 'bebidas_catalogo', 'intencion_detalle',
  'intencion_detalle es nullable (decisión: no romper fixtures de fases cerradas)');

-- --- 2b. Las cinco bebidas del catálogo y sus textos aprobados (spec §2) ------
-- Se busca por NOMBRE FINAL, nunca por uuid (los ids difieren entre entornos).
-- El título conserva el punto final: es la parte en negrita del spec, verbatim.
select results_eq(
  $$ select nombre, intencion_titulo, intencion_detalle
       from public.bebidas_catalogo
      where nombre in ('Chicha Morada de la Casa', 'Pisco Sour Clásico',
                       'Maracuyá Sour', 'Algarrobina Especial',
                       'Cóctel de Autor')
      order by nombre $$,
  $$ select * from (values
       ('Chicha Morada de la Casa', 'Solo compañía.',
        'Un café, una conversación, sin plan fijo.'),
       ('Pisco Sour Clásico', 'Para pasarla bien.',
        'Un bar, un juego, un rato de risas.'),
       ('Maracuyá Sour', 'Salida casual.',
        'Pasear, comer algo, conocer un lugar.'),
       ('Algarrobina Especial', 'Algo distinto.',
        'Un plan que no harías solo.'),
       ('Cóctel de Autor', 'Evento especial.',
        'Un concierto, una exposición, una celebración.')
     ) as t(nombre, titulo, detalle)
     order by nombre $$,
  'las cinco bebidas existen (por nombre final) con título y detalle iguales a los textos aprobados');

select results_eq(
  $$ select count(*)::int from public.bebidas_catalogo
      where nombre in ('Chicha Morada de la Casa', 'Pisco Sour Clásico',
                       'Maracuyá Sour', 'Algarrobina Especial',
                       'Cóctel de Autor')
        and btrim(intencion_titulo) <> '' and btrim(intencion_detalle) <> '' $$,
  $$ values (5) $$,
  'las cinco bebidas tienen título y detalle NO vacíos');

-- "Ayni" era el nombre anterior de la app (Ayni -> Martini, D.4). Ni el nombre
-- ni las intenciones pueden contenerlo. Filtro por patrón, no conteo global.
select results_eq(
  $$ select count(*)::int from public.bebidas_catalogo
      where nombre ilike '%ayni%'
         or coalesce(intencion_titulo, '') ilike '%ayni%'
         or coalesce(intencion_detalle, '') ilike '%ayni%' $$,
  $$ values (0) $$,
  'ninguna bebida (nombre ni intención) contiene "Ayni"');

-- --- 2c. El check de coherencia de la intención -------------------------------
-- O las dos columnas son NULL, o las dos tienen texto no vacío. Se ejercita con
-- el rol privilegiado (postgres) que corre este archivo. Un CHECK deja pasar
-- el resultado NULL (solo rechaza FALSE), así que la fila "una NULL, otra con
-- texto" es el caso que atrapa una expresión escrita sin `is not null`.
select lives_ok(
  $$ insert into public.bebidas_catalogo
       (id, nombre, tipo_invitacion, valor_v, activo,
        intencion_titulo, intencion_detalle)
     values ('a0000001-0000-0000-0000-000000000001', 'Bebida F1T2 completa',
             'autor', 1, true, 'Título fixture.', 'Detalle fixture.') $$,
  'el check ACEPTA una fila con título y detalle no vacíos');

select lives_ok(
  $$ insert into public.bebidas_catalogo (nombre, tipo_invitacion, valor_v)
     values ('Bebida F1T2 sin intención', 'autor', 1) $$,
  'el check ACEPTA una fila con las dos columnas NULL (bebida futura sin intención)');

select throws_ok(
  $$ insert into public.bebidas_catalogo
       (nombre, tipo_invitacion, valor_v, intencion_titulo)
     values ('Bebida F1T2 mitad título', 'autor', 1, 'Solo título.') $$,
  '23514',
  'new row for relation "bebidas_catalogo" violates check constraint "bebidas_catalogo_intencion_coherente"',
  'el check RECHAZA título con texto y detalle NULL');

select throws_ok(
  $$ insert into public.bebidas_catalogo
       (nombre, tipo_invitacion, valor_v, intencion_detalle)
     values ('Bebida F1T2 mitad detalle', 'autor', 1, 'Solo detalle.') $$,
  '23514',
  'new row for relation "bebidas_catalogo" violates check constraint "bebidas_catalogo_intencion_coherente"',
  'el check RECHAZA detalle con texto y título NULL');

select throws_ok(
  $$ insert into public.bebidas_catalogo
       (nombre, tipo_invitacion, valor_v, intencion_titulo, intencion_detalle)
     values ('Bebida F1T2 título en blanco', 'autor', 1, '   ', 'Detalle.') $$,
  '23514',
  'new row for relation "bebidas_catalogo" violates check constraint "bebidas_catalogo_intencion_coherente"',
  'el check RECHAZA un título en blanco (solo espacios)');

select throws_ok(
  $$ insert into public.bebidas_catalogo
       (nombre, tipo_invitacion, valor_v, intencion_titulo, intencion_detalle)
     values ('Bebida F1T2 ambos vacíos', 'autor', 1, '', '') $$,
  '23514',
  'new row for relation "bebidas_catalogo" violates check constraint "bebidas_catalogo_intencion_coherente"',
  'el check RECHAZA título y detalle como cadenas vacías');

-- --- 2d. invitaciones.momento_propuesto ---------------------------------------
select has_column('public', 'invitaciones', 'momento_propuesto',
  'invitaciones tiene momento_propuesto');
select col_type_is('public', 'invitaciones', 'momento_propuesto',
  'timestamp with time zone', 'momento_propuesto es timestamptz');
select col_is_null('public', 'invitaciones', 'momento_propuesto',
  'momento_propuesto es nullable (las invitaciones existentes no tienen momento)');

-- Contrato de zona horaria. `timestamptz` guarda el INSTANTE bien; el riesgo es
-- CONVERTIR texto a hora con la sesión en UTC (ya corrió 5 horas en
-- confirmar_cita, revisión 4.6). Con la sesión en UTC, un momento insertado
-- como '2026-10-01 20:00 America/Lima' debe leerse de vuelta como las 20:00 de
-- Lima (= 01:00 UTC del día siguiente; Lima es UTC-5 y no tiene horario de
-- verano). El literal lleva la zona explícita: sin ella, en UTC se leería como
-- 20:00 UTC = 15:00 Lima.
set local timezone = 'UTC';

select results_eq(
  $$ select current_setting('TimeZone') $$,
  $$ values ('UTC') $$,
  'la sesión corre en UTC (el caso peligroso que el contrato tiene que aguantar)');

select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, tiempo_estimado_min,
        estado, momento_propuesto)
     values ('c0000001-0000-0000-0000-000000000001',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 60, 'pendiente',
             '2026-10-01 20:00 America/Lima') $$,
  'se puede guardar una invitación con momento_propuesto');

select results_eq(
  $$ select momento_propuesto at time zone 'America/Lima'
       from public.invitaciones
      where id = 'c0000001-0000-0000-0000-000000000001' $$,
  $$ values (timestamp '2026-10-01 20:00') $$,
  'ida y vuelta: se lee de vuelta como las 20:00 de Lima');

select results_eq(
  $$ select momento_propuesto from public.invitaciones
      where id = 'c0000001-0000-0000-0000-000000000001' $$,
  $$ values (timestamptz '2026-10-02 01:00:00+00') $$,
  'ida y vuelta: el instante es 2026-10-02 01:00 UTC');

-- --- 2e. El cliente lee la intención pero no la escribe -----------------------
-- Ana (authenticated) LEE la intención de una bebida activa (grants de tabla:
-- la columna nueva hereda SELECT) y NO puede escribirla: nadie desde el cliente.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select results_eq(
  $$ select intencion_titulo, intencion_detalle from public.bebidas_catalogo
      where id = 'a0000001-0000-0000-0000-000000000001' $$,
  $$ values ('Título fixture.', 'Detalle fixture.') $$,
  'Ana (authenticated) LEE la intención de una bebida activa');

select throws_ok(
  $$ update public.bebidas_catalogo set intencion_titulo = 'Pirata.'
      where id = 'a0000001-0000-0000-0000-000000000001' $$,
  '42501', null, 'Ana NO puede modificar la intención de una bebida');

select throws_ok(
  $$ insert into public.bebidas_catalogo
       (nombre, tipo_invitacion, valor_v, intencion_titulo, intencion_detalle)
     values ('Bebida Pirata', 'autor', 1, 'Pirata.', 'Pirata.') $$,
  '42501', null, 'Ana NO puede insertar una bebida con intención');

reset role;
select set_config('request.jwt.claims', null, true);

select results_eq(
  $$ select intencion_titulo, intencion_detalle from public.bebidas_catalogo
      where id = 'a0000001-0000-0000-0000-000000000001' $$,
  $$ values ('Título fixture.', 'Detalle fixture.') $$,
  'el intento de Ana no cambió nada: la intención sigue intacta');

select * from finish();
rollback;
