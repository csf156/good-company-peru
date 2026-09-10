-- pgTAP: función atómica responder_invitacion (Fase E.2a, Tarea 4).
--
-- Camino `invitacion`: el hold ya existe (Tarea 3b lo dejó preautorizado) —
-- aceptar captura, rechazar anula. Camino `solicitud`: SIMÉTRICO al de
-- `invitacion` — no hay hold todavía (una solicitud nunca preautoriza al
-- crearse, Tarea 3c), así que aceptar solo PREPARA (crea la orden en
-- `pendiente`, deja la invitación en `preautorizando`); quien captura y abre
-- la cita es `confirmar_preautorizacion` (Tarea 3b), cuando E.2b preautorice.
--
-- Conserva de la Fase 4.3 (y su fix post-review, 20260724160000): solo el
-- receptor responde, invitación inexistente → AY404, idempotencia-benigna,
-- apertura de cita al aceptar una `invitacion`, EXECUTE solo para
-- service_role, y el gate KYC aplicando SOLO a aceptar (rechazar no
-- compromete escrow — gatearlo dejaría un hold sin camino de liberación para
-- un receptor no verificado).
--
-- Regla de BRAIN (Tarea 3c): todo estado en el que esta función puede dejar
-- una fila tiene que tener quién la ve y qué la mueve, probado. La
-- `solicitud` aceptada queda en `preautorizando` — el emisor (amigo) la ve
-- siempre (RLS no filtra por estado al emisor), y `confirmar_preautorizacion`
-- (Tarea 3b) ya existe para sacarla de ahí. Sin hueco.
select plan(44);

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
   'beto@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'dani@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated',
   'elmo@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated',
   'fabi@test.dev', '', now(), now(), now(), '', '', '', '');

-- Ana (rentador) verificada; Beto y Dani (amigos) verificados; Elmo (amigo)
-- SIN verificar; Fabi (rentador) SIN verificar — receptor de una solicitud.
insert into public.profiles (id, rol, alias, kyc_estado)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias', 'verificado'),
  ('22222222-2222-2222-2222-222222222222', 'amigo', 'BetoAlias', 'verificado'),
  ('44444444-4444-4444-4444-444444444444', 'amigo', 'DaniAlias', 'verificado'),
  ('55555555-5555-5555-5555-555555555555', 'amigo', 'ElmoAlias', 'pendiente'),
  ('66666666-6666-6666-6666-666666666666', 'rentador', 'FabiAlias', 'pendiente');

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v, activo)
values
  ('99999999-9999-9999-9999-999999999999', 'Pisco Sour', 'divertida', 30.00, true),
  ('88888888-8888-8888-8888-888888888888', 'Cóctel Descontinuado', 'divertida', 20.00, false);

-- Invitaciones tipo `invitacion` (Ana→X), ya en pendiente con su orden
-- preautorizada — simula el estado que deja confirmar_preautorizacion
-- (Tarea 3b) tras un hold exitoso.
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id, estado)
values
  ('11110001-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente'), -- INV1: reject
  ('11110002-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente'), -- INV2: accept
  ('11110006-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente'), -- INV_YARES
  ('11110007-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente'), -- INV_ACCBEB
  ('11110008-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente'), -- INV_REJBEB
  ('11110009-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente'), -- INV_EMIS
  ('11110005-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente'), -- INV_UNVER (Elmo)
  ('11110010-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente'), -- INV_UNVER_ACC (Elmo)
  ('11110011-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente'), -- INV_NOHOLD: su orden NO queda preautorizada
  ('11110012-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente'); -- INV_REJCAP: su orden ya está capturada (inconsistencia a propósito)

-- Solicitudes (X→Ana / X→Fabi), en pendiente y SIN orden (Tarea 3c: nace ahí
-- de una, no tiene nada que preautorizar hasta que el rentador acepte).
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id, estado)
values
  ('22220001-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'solicitud', 'especifica', null, 'pendiente'), -- SOL_ACC
  ('22220003-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'solicitud', 'especifica', null, 'pendiente'), -- SOL_REJ
  ('22220004-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'solicitud', 'especifica', null, 'pendiente'), -- SOL_NOBEB
  ('22220005-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'solicitud', 'especifica', null, 'pendiente'), -- SOL_INACTIVA
  ('22220006-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666666', 'solicitud', 'especifica', null, 'pendiente'); -- SOL_UNVER (Fabi receptor)

-- Órdenes preautorizadas para las invitaciones que sí tienen hold (todas
-- excepto INV_NOHOLD, sin orden viva, e INV_REJCAP, ya capturada).
insert into public.ordenes_pago (perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
select '11111111-1111-1111-1111-111111111111', id, 30.00, 4.50, 34.50, 'preautorizada', 'mock'
from public.invitaciones
where id in (
  '11110001-0000-0000-0000-000000000000', '11110002-0000-0000-0000-000000000000',
  '11110006-0000-0000-0000-000000000000', '11110007-0000-0000-0000-000000000000',
  '11110008-0000-0000-0000-000000000000', '11110009-0000-0000-0000-000000000000',
  '11110005-0000-0000-0000-000000000000', '11110010-0000-0000-0000-000000000000'
);

insert into public.ordenes_pago (perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values ('11111111-1111-1111-1111-111111111111', '11110012-0000-0000-0000-000000000000', 30.00, 4.50, 34.50, 'capturada', 'mock');

-- ============================================================================
-- RECHAZAR una `invitacion`: anula su hold, sin escribir ledger.
-- ============================================================================
select is(
  public.responder_invitacion('22222222-2222-2222-2222-222222222222', '11110001-0000-0000-0000-000000000000', 'rechazar', null),
  'rechazada', 'rechazar una invitación devuelve rechazada');
select is(
  (select estado::text from public.invitaciones where id = '11110001-0000-0000-0000-000000000000'),
  'rechazada', 'la invitación rechazada queda en estado rechazada');
select is(
  (select estado::text from public.ordenes_pago where invitacion_id = '11110001-0000-0000-0000-000000000000'),
  'anulada', 'rechazar anula el hold de la orden');
select is(
  (select count(*) from public.ledger where referencia_id = '11110001-0000-0000-0000-000000000000')::int,
  0, 'rechazar NO escribe ninguna fila de ledger');

-- ============================================================================
-- RECHAZAR una `solicitud` (sin orden): no falla, no crea nada.
-- ============================================================================
select is(
  public.responder_invitacion('11111111-1111-1111-1111-111111111111', '22220003-0000-0000-0000-000000000000', 'rechazar', null),
  'rechazada', 'rechazar una solicitud sin orden no falla');
select is(
  (select count(*) from public.ordenes_pago where invitacion_id = '22220003-0000-0000-0000-000000000000')::int,
  0, 'rechazar una solicitud no crea ninguna orden');

-- ============================================================================
-- ACEPTAR una `invitacion`: captura el hold, invitación aceptada, crea cita.
-- ============================================================================
select is(
  public.responder_invitacion('22222222-2222-2222-2222-222222222222', '11110002-0000-0000-0000-000000000000', 'aceptar', null),
  'aceptada', 'aceptar una invitación devuelve aceptada');
select is(
  (select estado::text from public.invitaciones where id = '11110002-0000-0000-0000-000000000000'),
  'aceptada', 'la invitación aceptada queda en estado aceptada');
select is(
  (select estado::text from public.ordenes_pago where invitacion_id = '11110002-0000-0000-0000-000000000000'),
  'capturada', 'aceptar captura el hold de la orden');
select is(
  (select count(*) from public.ledger where referencia_id = '11110002-0000-0000-0000-000000000000')::int,
  3, 'la captura escribe las 3 filas de ledger de siempre, con referencia_id en la invitación');
select is(
  (select count(*) from public.citas where invitacion_id = '11110002-0000-0000-0000-000000000000')::int,
  1, 'aceptar una invitación crea exactamente una cita');

-- ============================================================================
-- ACEPTAR una `solicitud`: PREPARA — crea su orden en pendiente y deja la
-- invitación en preautorizando. No captura, no ledger, no cita todavía.
-- ============================================================================
select is(
  public.responder_invitacion('11111111-1111-1111-1111-111111111111', '22220001-0000-0000-0000-000000000000', 'aceptar', '99999999-9999-9999-9999-999999999999'),
  'preautorizando', 'aceptar una solicitud devuelve preautorizando, no aceptada');
select is(
  (select estado::text from public.invitaciones where id = '22220001-0000-0000-0000-000000000000'),
  'preautorizando', 'la solicitud queda en preautorizando — confirmar_preautorizacion la cierra después');
select is(
  (select count(*) from public.ordenes_pago where invitacion_id = '22220001-0000-0000-0000-000000000000')::int,
  1, 'aceptar una solicitud crea exactamente una orden');
select is(
  (select estado::text from public.ordenes_pago where invitacion_id = '22220001-0000-0000-0000-000000000000'),
  'pendiente', 'la orden de la solicitud nace pendiente, no capturada — no hay hold todavía');
select is(
  (select perfil_id from public.ordenes_pago where invitacion_id = '22220001-0000-0000-0000-000000000000'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'la orden es del receptor (rentador) que acepta, no del emisor');
select is(
  (select bebida_catalogo_id from public.invitaciones where id = '22220001-0000-0000-0000-000000000000'),
  '99999999-9999-9999-9999-999999999999'::uuid, 'la solicitud guarda la bebida elegida por el receptor');
select is(
  (select count(*) from public.ledger where referencia_id = '22220001-0000-0000-0000-000000000000')::int,
  0, 'preparar una solicitud NO escribe ledger');
select is(
  (select count(*) from public.citas where invitacion_id = '22220001-0000-0000-0000-000000000000')::int,
  0, 'preparar una solicitud NO abre cita todavía');

-- --- (tipo, estado) nuevo: solicitud en preautorizando. Quién la ve: el
-- emisor (amigo), siempre — RLS no filtra por estado al emisor. ---
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
select is(
  (select count(*) from public.invitaciones where id = '22220001-0000-0000-0000-000000000000')::int,
  1, 'el emisor (Beto, amigo) SÍ ve su solicitud en preautorizando — es la suya');
reset role;
select set_config('request.jwt.claims', null, true);

-- ============================================================================
-- Tras aceptar una `invitacion`, la cita la ven SOLO las dos partes (INV2:
-- emisor Ana, receptor Beto; Dani es tercero).
-- ============================================================================
set local role authenticated;

select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
select is(
  (select count(*) from public.citas where invitacion_id = '11110002-0000-0000-0000-000000000000')::int,
  1, 'el emisor (parte) ve la cita');

select set_config('request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
select is(
  (select count(*) from public.citas where invitacion_id = '11110002-0000-0000-0000-000000000000')::int,
  1, 'el receptor (parte) ve la cita');

select set_config('request.jwt.claims',
  json_build_object('sub', '44444444-4444-4444-4444-444444444444', 'role', 'authenticated')::text, true);
select is(
  (select count(*) from public.citas where invitacion_id = '11110002-0000-0000-0000-000000000000')::int,
  0, 'un tercero ajeno NO ve la cita');

select set_config('request.jwt.claims', null, true);
reset role;

-- ============================================================================
-- Solo el receptor responde.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion('11111111-1111-1111-1111-111111111111', '11110009-0000-0000-0000-000000000000', 'rechazar', null) $$,
  'AY403', null, 'el emisor no puede responder su propia invitación');

-- ============================================================================
-- KYC gatea SOLO aceptar. Elmo (no verificado) SÍ puede rechazar, NO aceptar.
-- ============================================================================
select is(
  public.responder_invitacion('55555555-5555-5555-5555-555555555555', '11110005-0000-0000-0000-000000000000', 'rechazar', null),
  'rechazada', 'un receptor no verificado (KYC) SÍ puede rechazar');
select is(
  (select estado::text from public.ordenes_pago where invitacion_id = '11110005-0000-0000-0000-000000000000'),
  'anulada', 'rechazar sin verificar igual anula el hold');
select throws_ok(
  $$ select public.responder_invitacion('55555555-5555-5555-5555-555555555555', '11110010-0000-0000-0000-000000000000', 'aceptar', null) $$,
  'AY403', null, 'un receptor no verificado (KYC) NO puede aceptar');
select throws_ok(
  $$ select public.responder_invitacion('66666666-6666-6666-6666-666666666666', '22220006-0000-0000-0000-000000000000', 'aceptar', '99999999-9999-9999-9999-999999999999') $$,
  'AY403', null, 'el receptor de una solicitud también debe estar KYC-verificado');

-- ============================================================================
-- Idempotente-benigno: responder de nuevo no re-aplica ni re-captura.
-- ============================================================================
select is(
  public.responder_invitacion('22222222-2222-2222-2222-222222222222', '11110006-0000-0000-0000-000000000000', 'aceptar', null),
  'aceptada', 'primera aceptación de INV_YARES aplica');
select is(
  public.responder_invitacion('22222222-2222-2222-2222-222222222222', '11110006-0000-0000-0000-000000000000', 'aceptar', null),
  'ya_resuelta', 'responder de nuevo es idempotente-benigno');
select is(
  (select count(*) from public.citas where invitacion_id = '11110006-0000-0000-0000-000000000000')::int,
  1, 'una invitación ya resuelta no crea una segunda cita');
select is(
  (select count(*) from public.ledger where referencia_id = '11110006-0000-0000-0000-000000000000')::int,
  3, 'una invitación ya resuelta no re-captura (sigue en 3 filas de ledger, no 6)');

-- ============================================================================
-- Atomicidad: sin hold que capturar, la invitación NO queda aceptada y NO se
-- abre chat — todo o nada, en la misma transacción.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion('22222222-2222-2222-2222-222222222222', '11110011-0000-0000-0000-000000000000', 'aceptar', null) $$,
  'AY409', null, 'aceptar sin un hold preautorizado falla');
select is(
  (select estado::text from public.invitaciones where id = '11110011-0000-0000-0000-000000000000'),
  'pendiente', 'la invitación sigue pendiente tras el fallo — no queda a medias');
select is(
  (select count(*) from public.citas where invitacion_id = '11110011-0000-0000-0000-000000000000')::int,
  0, 'no se abre chat si la captura falla');

-- ============================================================================
-- Rechazar una invitación cuya orden ya está capturada falla — no se
-- rechaza algo ya cobrado.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion('22222222-2222-2222-2222-222222222222', '11110012-0000-0000-0000-000000000000', 'rechazar', null) $$,
  'AY409', null, 'rechazar una invitación con orden ya capturada falla');

-- ============================================================================
-- Bebida inactiva al aceptar una solicitud → conflicto.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion('11111111-1111-1111-1111-111111111111', '22220005-0000-0000-0000-000000000000', 'aceptar', '88888888-8888-8888-8888-888888888888') $$,
  'AY409', null, 'no se puede aceptar una solicitud con una bebida inactiva');

-- ============================================================================
-- Aceptar una solicitud SIN asignar bebida → forma inválida.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion('11111111-1111-1111-1111-111111111111', '22220004-0000-0000-0000-000000000000', 'aceptar', null) $$,
  'AY400', null, 'aceptar una solicitud exige asignar una bebida');

-- ============================================================================
-- Aceptar una `invitacion` mandando bebida (ya tiene la suya) → forma inválida.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion('22222222-2222-2222-2222-222222222222', '11110007-0000-0000-0000-000000000000', 'aceptar', '99999999-9999-9999-9999-999999999999') $$,
  'AY400', null, 'aceptar una invitación no admite mandar otra bebida');

-- ============================================================================
-- Rechazar mandando bebida (rechazar no toma bebida) → forma inválida.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion('22222222-2222-2222-2222-222222222222', '11110008-0000-0000-0000-000000000000', 'rechazar', '99999999-9999-9999-9999-999999999999') $$,
  'AY400', null, 'rechazar no admite mandar una bebida');

-- ============================================================================
-- Invitación inexistente → no encontrada.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000ff', 'rechazar', null) $$,
  'AY404', null, 'responder una invitación inexistente falla como no encontrada');

-- ============================================================================
-- Acción inválida.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion('22222222-2222-2222-2222-222222222222', '11110007-0000-0000-0000-000000000000', 'saltar', null) $$,
  'AY400', null, 'una acción que no es aceptar ni rechazar es inválida');

-- ============================================================================
-- El cliente no puede ejecutar la función directamente.
-- ============================================================================
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
set local role authenticated;
select throws_ok(
  $$ select public.responder_invitacion('22222222-2222-2222-2222-222222222222', '11110007-0000-0000-0000-000000000000', 'rechazar', null) $$,
  '42501', null, 'un cliente autenticado NO puede ejecutar responder_invitacion');
reset role;
select set_config('request.jwt.claims', null, true);

set local role anon;
select throws_ok(
  $$ select public.responder_invitacion('22222222-2222-2222-2222-222222222222', '11110007-0000-0000-0000-000000000000', 'rechazar', null) $$,
  '42501', null, 'anon tampoco puede ejecutar responder_invitacion');
reset role;

select * from finish();
