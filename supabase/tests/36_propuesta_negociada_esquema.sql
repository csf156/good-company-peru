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
--
-- Sección 3 (Tarea 2b): `invitaciones.cantidad` (spec §8b, sin tope de negocio y
-- no contraproponible) y las dos columnas donde se guarda la contrapropuesta
-- (`contra_bebida_catalogo_id`, `contra_tiempo_estimado_min`), con el check de
-- que una contrapropuesta tiene que cambiar algo respecto a la original; y el
-- resultado del backfill de `cantidad` sobre los datos anteriores (3g, acotado
-- por un corte fijo para que datos futuros no lo pongan en rojo).
--
-- Sección 4 (Tarea 5): el índice único parcial `invitaciones_una_relacion_
-- activa_por_par` (spec §6) — una sola relación activa por par sin ordenar,
-- ignora quién propuso. Reproduce el intento real de crear la segunda
-- relación por INSERT directo (como postgres/service_role, igual que el resto
-- del archivo), no a través de `crear_invitacion` — esa función no se toca en
-- F.1. La excepción: 4h documenta a propósito qué le pasa HOY a
-- `crear_invitacion` (sin tocarla) cuando el índice choca desde su propio
-- camino, porque es información real que F.2 necesita.
select plan(80);

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

-- ============================================================================
-- 3. Cantidad y columnas de la contrapropuesta (Tarea 2b)
-- ============================================================================
-- Fixtures propios de esta sección (ids con prefijo a0000002 / c0000002; nada
-- global). Reutiliza a Ana (11..) y Beto (22..) de la sección 2. TODAS las
-- filas nacen en estado 'rechazada': ni la cantidad ni la contrapropuesta ni
-- sus checks dependen del estado, y un estado terminal no ocupa la "relación
-- activa" del par (spec §6), así que estas filas no chocarán con el índice
-- único por par que llega después. 'rechazada' además es visible para el
-- receptor (lista blanca de la política), lo que permite probar la lectura de
-- Beto en 3f sin depender de la visibilidad de los estados nuevos.
insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v, activo)
values
  ('a0000002-0000-0000-0000-00000000000a', 'Bebida F1T2b A', 'autor', 10, true),
  ('a0000002-0000-0000-0000-00000000000b', 'Bebida F1T2b B', 'autor', 20, true);

-- --- 3a. Las tres columnas: existen, con su tipo, nullables; contra_cantidad NO
select has_column('public', 'invitaciones', 'cantidad',
  'invitaciones tiene cantidad');
select col_type_is('public', 'invitaciones', 'cantidad', 'integer',
  'cantidad es integer');
select col_is_null('public', 'invitaciones', 'cantidad',
  'cantidad es nullable (una solicitud no la trae hasta que el rentador actúa)');

select has_column('public', 'invitaciones', 'contra_bebida_catalogo_id',
  'invitaciones tiene contra_bebida_catalogo_id');
select col_type_is('public', 'invitaciones', 'contra_bebida_catalogo_id', 'uuid',
  'contra_bebida_catalogo_id es uuid');
select col_is_null('public', 'invitaciones', 'contra_bebida_catalogo_id',
  'contra_bebida_catalogo_id es nullable (nula hasta que hay contrapropuesta)');

select has_column('public', 'invitaciones', 'contra_tiempo_estimado_min',
  'invitaciones tiene contra_tiempo_estimado_min');
select col_type_is('public', 'invitaciones', 'contra_tiempo_estimado_min', 'integer',
  'contra_tiempo_estimado_min es integer');
select col_is_null('public', 'invitaciones', 'contra_tiempo_estimado_min',
  'contra_tiempo_estimado_min es nullable (nula hasta que hay contrapropuesta)');

-- La cantidad no es contraproponible (decisión del usuario, spec §8b): no hay
-- columna para contraproponerla.
select hasnt_column('public', 'invitaciones', 'contra_cantidad',
  'NO existe contra_cantidad: la cantidad no se contrapropone');

select fk_ok('public', 'invitaciones', 'contra_bebida_catalogo_id',
             'public', 'bebidas_catalogo', 'id',
  'contra_bebida_catalogo_id referencia a bebidas_catalogo(id)');

-- --- 3b. cantidad >= 1, sin tope --------------------------------------------
-- La cantidad NULL pasa a propósito (solicitud sin cantidad). Sin tope de
-- negocio (decisión del usuario): 1000 entra. El límite técnico de numeric(12,2)
-- del importe lo maneja F.2 en calcular_desglose, no esta columna.
select throws_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min, cantidad)
     values ('c0000002-0000-0000-0000-000000000001',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60, 0) $$,
  '23514',
  'new row for relation "invitaciones" violates check constraint "invitaciones_cantidad_check"',
  'cantidad = 0 se RECHAZA');

select throws_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min, cantidad)
     values ('c0000002-0000-0000-0000-000000000002',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60, -1) $$,
  '23514',
  'new row for relation "invitaciones" violates check constraint "invitaciones_cantidad_check"',
  'cantidad = -1 se RECHAZA');

select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min, cantidad)
     values ('c0000002-0000-0000-0000-000000000003',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60, 1) $$,
  'cantidad = 1 se ACEPTA');

select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min, cantidad)
     values ('c0000002-0000-0000-0000-000000000004',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60, 1000) $$,
  'cantidad = 1000 se ACEPTA (sin tope de negocio)');

select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min, cantidad)
     values ('c0000002-0000-0000-0000-000000000005',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'solicitud', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60, null) $$,
  'cantidad NULL se ACEPTA (una solicitud no la trae hasta que el rentador actúa)');

-- --- 3c. contra_tiempo_estimado_min > 0 (espejo de tiempo_estimado_min) -------
-- La original ya tiene `tiempo_estimado_min is null or > 0` desde la fase 4.2;
-- la contrapropuesta de duración tiene la misma regla. Solo esta condición
-- falla en estas filas (0 y -1 SÍ difieren de la original, así que el check
-- de "cambia algo" pasa y la violación es inequívoca).
select throws_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min, contra_tiempo_estimado_min)
     values ('c0000002-0000-0000-0000-000000000006',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60, 0) $$,
  '23514',
  'new row for relation "invitaciones" violates check constraint "invitaciones_contra_tiempo_estimado_min_check"',
  'contra_tiempo_estimado_min = 0 se RECHAZA');

select throws_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min, contra_tiempo_estimado_min)
     values ('c0000002-0000-0000-0000-000000000007',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60, -1) $$,
  '23514',
  'new row for relation "invitaciones" violates check constraint "invitaciones_contra_tiempo_estimado_min_check"',
  'contra_tiempo_estimado_min = -1 se RECHAZA');

-- --- 3d. Una contrapropuesta tiene que cambiar algo -------------------------
-- "Hay contrapropuesta" = al menos UNA columna contra no nula; una columna
-- contra NULL significa "ese campo no se contrapropone". Original de estas
-- filas: bebida A, 60 min. Los casos con UNA sola columna puesta e IGUAL a la
-- original atrapan un CHECK escrito sin `is not null` (deja pasar NULL) o con
-- `<>` en vez de `is distinct from`.
select throws_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min,
        contra_bebida_catalogo_id, contra_tiempo_estimado_min)
     values ('c0000002-0000-0000-0000-000000000008',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60,
             'a0000002-0000-0000-0000-00000000000a', 60) $$,
  '23514',
  'new row for relation "invitaciones" violates check constraint "invitaciones_contrapropuesta_cambia_algo"',
  'una contrapropuesta IDÉNTICA a la original (misma bebida y misma duración) se RECHAZA');

select throws_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min,
        contra_bebida_catalogo_id)
     values ('c0000002-0000-0000-0000-000000000009',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60,
             'a0000002-0000-0000-0000-00000000000a') $$,
  '23514',
  'new row for relation "invitaciones" violates check constraint "invitaciones_contrapropuesta_cambia_algo"',
  'contra_bebida igual a la original y contra_tiempo NULL se RECHAZA (no cambia nada)');

select throws_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min,
        contra_tiempo_estimado_min)
     values ('c0000002-0000-0000-0000-000000000010',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60, 60) $$,
  '23514',
  'new row for relation "invitaciones" violates check constraint "invitaciones_contrapropuesta_cambia_algo"',
  'contra_tiempo igual a la original y contra_bebida NULL se RECHAZA (no cambia nada)');

select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min,
        contra_bebida_catalogo_id)
     values ('c0000002-0000-0000-0000-000000000011',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60,
             'a0000002-0000-0000-0000-00000000000b') $$,
  'una contrapropuesta que cambia SOLO la bebida (contra_tiempo NULL) se ACEPTA');

select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min,
        contra_tiempo_estimado_min)
     values ('c0000002-0000-0000-0000-000000000012',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60, 45) $$,
  'una contrapropuesta que cambia SOLO la duración (contra_bebida NULL) se ACEPTA');

-- Esta fila (las dos cambian) es la que 3f lee como Ana y como Beto.
select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min, cantidad,
        contra_bebida_catalogo_id, contra_tiempo_estimado_min)
     values ('c0000002-0000-0000-0000-000000000013',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60, 3,
             'a0000002-0000-0000-0000-00000000000b', 45) $$,
  'una contrapropuesta que cambia la bebida Y la duración se ACEPTA');

select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min, cantidad)
     values ('c0000002-0000-0000-0000-000000000014',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60, 2) $$,
  'sin contrapropuesta (las dos columnas contra NULL) se ACEPTA');

-- Decisión de diseño fijada aquí para que no cambie sin querer: el check pide
-- que AL MENOS UNA columna contra difiera de la original (spec §8b). Una
-- columna contra puesta con el valor original NO invalida la fila mientras la
-- otra sí cambie (el cliente puede enviar las dos columnas aunque solo una
-- cambie).
select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min,
        contra_bebida_catalogo_id, contra_tiempo_estimado_min)
     values ('c0000002-0000-0000-0000-000000000015',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60,
             'a0000002-0000-0000-0000-00000000000a', 45) $$,
  'contra_bebida igual a la original pero contra_tiempo distinto se ACEPTA (basta que una difiera)');

-- El espejo del caso anterior: bebida distinta y duración igual a la original.
select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min,
        contra_bebida_catalogo_id, contra_tiempo_estimado_min)
     values ('c0000002-0000-0000-0000-000000000017',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60,
             'a0000002-0000-0000-0000-00000000000b', 60) $$,
  'contra_bebida distinta y contra_tiempo igual a la original se ACEPTA (basta que una difiera)');

-- Por qué el check usa `is distinct from` y no `<>`: la original puede ser
-- NULL (las solicitudes nacen sin bebida ni duración). Contraproponer un valor
-- frente a "ninguno" SÍ es un cambio y se ACEPTA. Un check escrito como
-- "original no nula Y distinta" rechazaría estas filas.
select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        tiempo_estimado_min, contra_bebida_catalogo_id)
     values ('c0000002-0000-0000-0000-000000000018',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'solicitud', 'especifica', 'rechazada',
             60, 'a0000002-0000-0000-0000-00000000000b') $$,
  'original SIN bebida (NULL) y contra_bebida con valor se ACEPTA (NULL frente a algo es un cambio)');

select lives_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, contra_tiempo_estimado_min)
     values ('c0000002-0000-0000-0000-000000000019',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'solicitud', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 45) $$,
  'original SIN duración (NULL) y contra_tiempo con valor se ACEPTA (NULL frente a algo es un cambio)');

-- --- 3e. contra_bebida_catalogo_id apunta a una bebida que existe -------------
select throws_ok(
  $$ insert into public.invitaciones
       (id, emisor_id, receptor_id, tipo, alcance, estado,
        bebida_catalogo_id, tiempo_estimado_min,
        contra_bebida_catalogo_id)
     values ('c0000002-0000-0000-0000-000000000016',
             '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada',
             'a0000002-0000-0000-0000-00000000000a', 60,
             'a0000002-0000-0000-0000-0000000000ff') $$,
  '23503',
  'insert or update on table "invitaciones" violates foreign key constraint "invitaciones_contra_bebida_catalogo_id_fkey"',
  'una contra_bebida_catalogo_id que no existe en el catálogo se RECHAZA');

-- --- 3f. Lectura y escritura desde el cliente ---------------------------------
-- `authenticated` lee `invitaciones` con SELECT a nivel de TABLA (ninguna
-- columna tiene ACL propia), así que las tres columnas nuevas heredan la
-- lectura para las partes; y no tiene INSERT/UPDATE/DELETE sobre la tabla
-- (fase 4.0), así que tampoco puede escribirlas. Este bloque lo comprueba.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select results_eq(
  $$ select cantidad, contra_bebida_catalogo_id, contra_tiempo_estimado_min
       from public.invitaciones
      where id = 'c0000002-0000-0000-0000-000000000013' $$,
  $$ values (3, 'a0000002-0000-0000-0000-00000000000b'::uuid, 45) $$,
  'Ana (emisor) LEE cantidad y las dos columnas de la contrapropuesta de su invitación');

select throws_ok(
  $$ insert into public.invitaciones
       (emisor_id, receptor_id, tipo, alcance, estado, cantidad,
        contra_bebida_catalogo_id, contra_tiempo_estimado_min)
     values ('11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 'rechazada', 5,
             'a0000002-0000-0000-0000-00000000000b', 30) $$,
  '42501', null,
  'Ana NO puede insertar una invitación con cantidad ni contrapropuesta');

select throws_ok(
  $$ update public.invitaciones
        set cantidad = 99,
            contra_bebida_catalogo_id = 'a0000002-0000-0000-0000-00000000000a',
            contra_tiempo_estimado_min = 5
      where id = 'c0000002-0000-0000-0000-000000000013' $$,
  '42501', null,
  'Ana NO puede modificar cantidad ni la contrapropuesta de su invitación');

select results_eq(
  $$ select cantidad, contra_bebida_catalogo_id, contra_tiempo_estimado_min
       from public.invitaciones
      where id = 'c0000002-0000-0000-0000-000000000013' $$,
  $$ values (3, 'a0000002-0000-0000-0000-00000000000b'::uuid, 45) $$,
  'el intento de Ana no cambió nada: cantidad y contrapropuesta siguen intactas');

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select results_eq(
  $$ select cantidad, contra_bebida_catalogo_id, contra_tiempo_estimado_min
       from public.invitaciones
      where id = 'c0000002-0000-0000-0000-000000000013' $$,
  $$ values (3, 'a0000002-0000-0000-0000-00000000000b'::uuid, 45) $$,
  'Beto (receptor) LEE cantidad y las dos columnas de la contrapropuesta de la invitación');

reset role;
select set_config('request.jwt.claims', null, true);

-- --- 3g. El backfill de la migración, sobre los datos anteriores ---------------
-- La migración rellena `cantidad = 1` en toda fila que YA tenía orden, y deja
-- NULL las que no (spec §8b). Estas dos aserciones comprueban ese resultado
-- sobre los datos demo que existían al escribirla. Son aserciones sobre datos
-- reales, así que están ACOTADAS a la población previa con un corte FIJO:
-- 2026-09-16 21:03:18.795356+00 = el mayor `created_at` entre TODAS las filas
-- de `invitaciones` y de `ordenes_pago` cuando se escribió la migración (medido
-- por introspección). Nada con `created_at` posterior al corte cuenta, y ninguna
-- fila nueva puede nacer con un `created_at` anterior (las crea el flujo real
-- —también la siembra `scripts/seed-demo.mjs`, que pasa por crear_invitacion—,
-- con `now()`), así que el conjunto de ids evaluado está congelado: solo puede
-- encogerse (si se borran filas), nunca crecer. Ni `count(*)` global ni ids
-- fijos: `is_empty` sobre los infractores, que además los muestra si falla.
--
-- (a) Ninguna invitación previa que tuviera una orden previa quedó con cantidad
--     NULL. La orden también tiene que ser anterior al corte: una solicitud
--     pendiente de ayer que se acepte mañana recibe su orden DESPUÉS y no debe
--     contar. Solo se pondría en rojo si alguien vuelve a poner en NULL la
--     cantidad de una fila que ya tenía orden; ningún camino legítimo lo hace
--     (F.2 fija la cantidad, no la borra). Si se borran filas, el conjunto solo
--     se achica y el test sigue verde (vacuo si la base se resembrara entera).
select is_empty(
  $$ select i.id
       from public.invitaciones i
      where i.created_at <= timestamptz '2026-09-16 21:03:18.795356+00'
        and i.cantidad is null
        and exists (select 1
                      from public.ordenes_pago o
                     where o.invitacion_id = i.id
                       and o.created_at <= timestamptz '2026-09-16 21:03:18.795356+00') $$,
  'toda fila previa con orden previa quedó con cantidad (backfill: cantidad = 1)');

-- (b) Las solicitudes previas SIN ninguna orden siguen con cantidad NULL: el
--     rentador nunca llegó a pagar, así que no hay cantidad que rellenar. Sin
--     filtro de estado a propósito: hoy no hay ninguna solicitud previa
--     `pendiente` sin orden (habría sido un test vacuo); la población real es
--     la solicitud rechazada sin orden. No puede ponerse en rojo por datos
--     legítimos: una solicitud previa solo deja de estar "sin orden" cuando el
--     rentador actúa, y entonces sale del conjunto (la condición es "no existe
--     NINGUNA orden", de cualquier fecha); y la única fila hoy en el conjunto
--     es terminal, así que F.2 no la toca. Residual: si F.2 dejara una
--     cantidad puesta en una solicitud previa tras una acción fallida
--     (revertiendo el estado pero no la cantidad), este test lo señalaría, y
--     sería un hallazgo legítimo (spec: cantidad NULL hasta que el rentador
--     actúa).
select is_empty(
  $$ select i.id
       from public.invitaciones i
      where i.tipo = 'solicitud'
        and i.created_at <= timestamptz '2026-09-16 21:03:18.795356+00'
        and i.cantidad is not null
        and not exists (select 1
                          from public.ordenes_pago o
                         where o.invitacion_id = i.id) $$,
  'toda solicitud previa sin ninguna orden sigue con cantidad NULL (el backfill no la tocó)');

-- ============================================================================
-- 4. Una relación activa por par (Tarea 5, spec §6)
-- ============================================================================
-- Fixtures propios de esta sección — pares nuevos y exclusivos (prefijo
-- f501../f50a../f50b..), sin tocar Ana/Beto (1111/2222) ni sus filas de las
-- secciones 2/3 (c0000001 sigue `pendiente` en el par Ana↔Beto). Cada
-- escenario usa SU PROPIO par: el índice es por par, así que mezclar
-- escenarios en un mismo par invalidaría la prueba de que ESTE choque en
-- particular es el que lo dispara.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000', 'f5010001-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sofia.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5010002-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tomas.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5020001-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uma.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5020002-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'victor.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5030001-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'walter.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5030002-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ximena.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5040001-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'yara.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5040002-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zeus.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5050001-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alan.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5050002-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bella.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5060001-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'caleb.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5060002-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dana.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5070001-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'efrain.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5070002-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fiona.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5080001-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gael.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5080002-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'helena.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5090001-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ivan.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f5090002-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'julia.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f50a0001-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'karla.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f50a0002-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leo.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f50b0001-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mona.f1t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f50b0002-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nico.f1t5@test.dev', '', now(), now(), now(), '', '', '', '');

insert into public.profiles (id, rol, alias, kyc_estado)
values
  ('f5010001-0000-0000-0000-000000000000', 'rentador', 'SofiaF1T5', 'verificado'),
  ('f5010002-0000-0000-0000-000000000000', 'amigo', 'TomasF1T5', 'verificado'),
  ('f5020001-0000-0000-0000-000000000000', 'rentador', 'UmaF1T5', 'verificado'),
  ('f5020002-0000-0000-0000-000000000000', 'amigo', 'VictorF1T5', 'verificado'),
  ('f5030001-0000-0000-0000-000000000000', 'rentador', 'WalterF1T5', 'verificado'),
  ('f5030002-0000-0000-0000-000000000000', 'amigo', 'XimenaF1T5', 'verificado'),
  ('f5040001-0000-0000-0000-000000000000', 'rentador', 'YaraF1T5', 'verificado'),
  ('f5040002-0000-0000-0000-000000000000', 'amigo', 'ZeusF1T5', 'verificado'),
  ('f5050001-0000-0000-0000-000000000000', 'rentador', 'AlanF1T5', 'verificado'),
  ('f5050002-0000-0000-0000-000000000000', 'amigo', 'BellaF1T5', 'verificado'),
  ('f5060001-0000-0000-0000-000000000000', 'rentador', 'CalebF1T5', 'verificado'),
  ('f5060002-0000-0000-0000-000000000000', 'amigo', 'DanaF1T5', 'verificado'),
  ('f5070001-0000-0000-0000-000000000000', 'rentador', 'EfrainF1T5', 'verificado'),
  ('f5070002-0000-0000-0000-000000000000', 'amigo', 'FionaF1T5', 'verificado'),
  ('f5080001-0000-0000-0000-000000000000', 'rentador', 'GaelF1T5', 'verificado'),
  ('f5080002-0000-0000-0000-000000000000', 'amigo', 'HelenaF1T5', 'verificado'),
  ('f5090001-0000-0000-0000-000000000000', 'rentador', 'IvanF1T5', 'verificado'),
  ('f5090002-0000-0000-0000-000000000000', 'amigo', 'JuliaF1T5', 'verificado'),
  ('f50a0001-0000-0000-0000-000000000000', 'rentador', 'KarlaF1T5', 'verificado'),
  ('f50a0002-0000-0000-0000-000000000000', 'amigo', 'LeoF1T5', 'verificado'),
  ('f50b0001-0000-0000-0000-000000000000', 'rentador', 'MonaF1T5', 'verificado'),
  ('f50b0002-0000-0000-0000-000000000000', 'amigo', 'NicoF1T5', 'verificado');

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v, activo)
values ('f50c0001-0000-0000-0000-000000000000', 'Bebida F1T5', 'autor', 10.00, true);

-- --- 4a. Segunda propuesta EN EL MISMO SENTIDO mientras la primera está
-- `pendiente` → falla (Step 1, punto 1 del brief). ---
insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
values ('f5010001-0000-0000-0000-000000000000', 'f5010002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'pendiente');

select throws_ok(
  $$ insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
     values ('f5010001-0000-0000-0000-000000000000', 'f5010002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'pendiente') $$,
  '23505', null,
  'segunda propuesta en el MISMO sentido mientras la primera está pendiente falla (índice único por par)');

-- --- 4b. Propuesta en SENTIDO CONTRARIO mientras la primera está `pendiente`
-- → falla. Es la regla del usuario (spec §3.1: "Rodri invita a Vale, Vale le
-- manda una solicitud a Rodri, la segunda se bloquea") y la más fácil de que
-- no funcione, porque `least`/`greatest` tiene que ignorar quién propuso. ---
insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
values ('f5020001-0000-0000-0000-000000000000', 'f5020002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'pendiente');

select throws_ok(
  $$ insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
     values ('f5020002-0000-0000-0000-000000000000', 'f5020001-0000-0000-0000-000000000000', 'solicitud', 'especifica', 'pendiente') $$,
  '23505', null,
  'propuesta en sentido CONTRARIO mientras la primera está pendiente falla (mismo par, sin importar quién propuso)');

-- --- 4c. Segunda propuesta mientras la primera está `aceptada` → falla. Es
-- el "hasta que termine el encuentro" (spec §3.1). ---
insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
values ('f5030001-0000-0000-0000-000000000000', 'f5030002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'aceptada');

select throws_ok(
  $$ insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
     values ('f5030001-0000-0000-0000-000000000000', 'f5030002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'pendiente') $$,
  '23505', null,
  'segunda propuesta mientras la primera está aceptada falla ("hasta que termine el encuentro")');

-- --- 4d. Segunda propuesta mientras la primera está `preautorizando` →
-- falla. ---
insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
values ('f5040001-0000-0000-0000-000000000000', 'f5040002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'preautorizando');

select throws_ok(
  $$ insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
     values ('f5040001-0000-0000-0000-000000000000', 'f5040002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'pendiente') $$,
  '23505', null,
  'segunda propuesta mientras la primera está preautorizando falla');

-- --- 4e. Nueva propuesta tras cada uno de los cuatro estados terminales →
-- funciona. Un par (y un test) por estado, para que cada uno se pruebe solo. ---
insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
values ('f5050001-0000-0000-0000-000000000000', 'f5050002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'rechazada');
select lives_ok(
  $$ insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
     values ('f5050001-0000-0000-0000-000000000000', 'f5050002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'pendiente') $$,
  'nueva propuesta tras una rechazada funciona');

insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
values ('f5060001-0000-0000-0000-000000000000', 'f5060002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'expirada');
select lives_ok(
  $$ insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
     values ('f5060001-0000-0000-0000-000000000000', 'f5060002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'pendiente') $$,
  'nueva propuesta tras una expirada funciona');

insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
values ('f5070001-0000-0000-0000-000000000000', 'f5070002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'retirada');
select lives_ok(
  $$ insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
     values ('f5070001-0000-0000-0000-000000000000', 'f5070002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'pendiente') $$,
  'nueva propuesta tras una retirada funciona');

insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
values ('f5080001-0000-0000-0000-000000000000', 'f5080002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'concluida');
select lives_ok(
  $$ insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
     values ('f5080001-0000-0000-0000-000000000000', 'f5080002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'pendiente') $$,
  'nueva propuesta tras una concluida funciona');

-- --- 4f. Un par DISTINTO no se ve afectado — reusa el par de 4a (Sofia↔
-- Tomas, que sigue `pendiente`: el intento de 4a falló y no lo tocó) para
-- probar que tener un par activo en la base no bloquea a un par ajeno. ---
select lives_ok(
  $$ insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
     values ('f5090001-0000-0000-0000-000000000000', 'f5090002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'pendiente') $$,
  'un par distinto no se ve afectado por un par ajeno activo');

-- --- 4g. Dos `global` activas del mismo emisor conviven (receptor_id is
-- null → el índice, con `where receptor_id is not null`, las ignora: sin
-- receptor no hay par). ---
insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
values ('f50b0001-0000-0000-0000-000000000000', null, 'invitacion', 'global', 'pendiente');
select lives_ok(
  $$ insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
     values ('f50b0001-0000-0000-0000-000000000000', null, 'invitacion', 'global', 'pendiente') $$,
  'dos invitaciones global activas del mismo emisor conviven (sin receptor no hay par)');

-- --- Una `global` activa de un emisor NO impide una específica activa de
-- ese emisor a otra persona. ---
select lives_ok(
  $$ insert into public.invitaciones (emisor_id, receptor_id, tipo, alcance, estado)
     values ('f50b0001-0000-0000-0000-000000000000', 'f50b0002-0000-0000-0000-000000000000', 'invitacion', 'especifica', 'pendiente') $$,
  'una global activa de un emisor no bloquea una específica activa de ese mismo emisor a otra persona');

-- --- 4h. HALLAZGO (no se arregla en F.1 — crear_invitacion es F.2): qué le
-- pasa HOY a crear_invitacion, sin tocarla, cuando el índice choca desde su
-- propio camino. Medido por introspección/probe empírico (no supuesto): NO
-- lanza una unique_violation cruda al caller. `crear_invitacion` ya trae su
-- PROPIO manejador `exception when unique_violation` alrededor del INSERT,
-- pensado para SU idempotencia (emisor_id + idempotency_key) — pero Postgres
-- no distingue de QUÉ índice vino la violación, así que ese manejador
-- atrapa TAMBIÉN la violación del índice de esta tarea. Al no encontrar
-- ninguna fila con (emisor_id, idempotency_key) de la llamada que chocó
-- (nunca la hubo — el choque fue por el PAR, no por esa key), el `select ...
-- into v_inv` no encuentra nada y la función devuelve un registro con TODOS
-- los campos NULL, sin lanzar nada. Un caller que solo mira si hubo
-- excepción cree que la llamada "funcionó". Pinneado a propósito para que
-- F.2 tenga un test rojo que poner en verde al arreglarlo (mapear este caso
-- a un error explícito, o distinguir el índice de origen).
select is(
  (select (public.crear_invitacion(
     'f50a0001-0000-0000-0000-000000000000', 'f50a0002-0000-0000-0000-000000000000',
     'invitacion', 'f50c0001-0000-0000-0000-000000000000', 60, 'zona', 'f1t5-keyA')).estado::text),
  'preautorizando',
  'HALLAZGO 4h, paso 1: Karla invita a Leo normalmente — crea preautorizando en su par');

select is(
  (select (public.crear_invitacion(
     'f50a0002-0000-0000-0000-000000000000', 'f50a0001-0000-0000-0000-000000000000',
     'solicitud', null, null, 'zona', 'f1t5-keyB')).id),
  null,
  'HALLAZGO 4h, paso 2: la llamada en sentido contrario (Leo→Karla) NO lanza excepción — devuelve un registro con id NULL en vez de fallar (ver comentario arriba)');

select is(
  (select count(*)::int from public.invitaciones
     where emisor_id in ('f50a0001-0000-0000-0000-000000000000', 'f50a0002-0000-0000-0000-000000000000')
       and receptor_id in ('f50a0001-0000-0000-0000-000000000000', 'f50a0002-0000-0000-0000-000000000000')
       and estado not in ('rechazada', 'expirada', 'retirada', 'concluida')),
  1,
  'HALLAZGO 4h, paso 3: y pese a "no fallar", el índice SÍ bloqueó el insert por dentro — sigue habiendo una sola fila activa en el par, no dos');

select * from finish();
rollback;
