-- pgTAP: función atómica confirmar_preautorizacion (Fase E.2a, Tarea 3b) — la
-- pieza que faltaba entre crear_invitacion (deja preautorizando/pendiente) y
-- responder_invitacion (necesita pendiente/preautorizada para responder). Dos
-- escrituras acopladas (orden + invitación) que tienen que ser atómicas — por
-- eso es SQL, no dos updates sueltos desde el Edge Function de E.2b.
select plan(25);

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
   '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'carla.f34t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'dani.f34t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated',
   'ely.f34t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated',
   'fabi.f34t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '77777777-7777-7777-7777-777777777777', 'authenticated', 'authenticated',
   'gia.f34t5@test.dev', '', now(), now(), now(), '', '', '', '');

insert into public.profiles (id, rol, alias, kyc_estado)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias', 'verificado'),
  ('22222222-2222-2222-2222-222222222222', 'amigo', 'BetoAlias', 'verificado'),
  ('33333333-3333-3333-3333-333333333333', 'amigo', 'CarlaAlias', 'verificado'),
  ('44444444-4444-4444-4444-444444444444', 'amigo', 'DaniAlias', 'verificado'),
  ('55555555-5555-5555-5555-555555555555', 'amigo', 'ElyAlias', 'verificado'),
  ('66666666-6666-6666-6666-666666666666', 'amigo', 'FabiAlias', 'verificado'),
  ('77777777-7777-7777-7777-777777777777', 'amigo', 'GiaAlias', 'verificado');

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v, activo)
values ('99999999-9999-9999-9999-999999999999', 'Pisco Sour', 'divertida', 30.00, true);

-- Seis invitaciones, simulando el estado que deja crear_invitacion (Tarea 3)
-- para `invitacion`, y el que dejaría responder_invitacion (Tarea 4, todavía
-- no reescrita) para `solicitud` aceptada: preautorizando + orden pendiente.
--
-- F.1 Tarea 5: las seis nacían todas sobre el mismo par (Ana, Beto) —
-- `preautorizando`/`pendiente` son no-terminales, así que las seis a la vez
-- violarían el índice único por par (spec §6), incluso de forma transitoria
-- dentro de este mismo INSERT. Cada fila (salvo INV_A, que se queda con
-- Beto) pasa a un par propio con una contraparte nueva y exclusiva de este
-- archivo — ninguna aserción cambia de expectativa, solo la identidad de la
-- contraparte en las filas que no la impersonan (B, C, D, F, G no impersonan
-- a nadie; solo INV_A lo hace, y se queda igual).
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id, estado)
values
  ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'preautorizando'), -- INV_A: invitacion, p_ok — par (Ana, Beto)
  ('a0000000-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'solicitud', 'especifica', '99999999-9999-9999-9999-999999999999', 'preautorizando'), -- INV_B: solicitud, p_ok — par (Ana, Carla)
  ('a0000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'preautorizando'), -- INV_C: invitacion, not p_ok — par (Ana, Dani)
  ('a0000000-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'preautorizando'), -- INV_D: transición ilegal (orden) — par (Ana, Ely)
  ('a0000000-0000-0000-0000-00000000000f', '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'solicitud', 'especifica', '99999999-9999-9999-9999-999999999999', 'preautorizando'), -- INV_F: solicitud, not p_ok (tarjeta del rentador falla) — par (Ana, Fabi)
  ('a0000000-0000-0000-0000-00000000000e', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente'); -- INV_G: YA no está en preautorizando — par (Ana, Gia)

insert into public.ordenes_pago (id, perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values
  ('b0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', 30.00, 4.50, 34.50, 'pendiente', 'mock'), -- ORD_A
  ('b0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000b', 30.00, 4.50, 34.50, 'pendiente', 'mock'), -- ORD_B
  ('b0000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000c', 30.00, 4.50, 34.50, 'pendiente', 'mock'), -- ORD_C
  ('b0000000-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000d', 30.00, 4.50, 34.50, 'anulada', 'mock'),   -- ORD_D: ya resuelta por otra vía
  ('b0000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000f', 30.00, 4.50, 34.50, 'pendiente', 'mock'), -- ORD_F
  ('b0000000-0000-0000-0000-00000000000e', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000e', 30.00, 4.50, 34.50, 'pendiente', 'mock'); -- ORD_G

-- ============================================================================
-- 1-3. p_ok sobre una `invitacion`: orden a preautorizada, invitación a
-- pendiente, sin ledger, y el receptor ya la ve (Tarea 2b, por el otro lado).
-- ============================================================================
select is(
  public.confirmar_preautorizacion('b0000000-0000-0000-0000-00000000000a', true, 'hold-a'),
  'aplicada', 'p_ok sobre invitacion devuelve aplicada');
select is(
  (select estado::text from public.ordenes_pago where id = 'b0000000-0000-0000-0000-00000000000a'),
  'preautorizada', 'la orden de la invitacion queda preautorizada, no capturada');
select is(
  (select estado::text from public.invitaciones where id = 'a0000000-0000-0000-0000-00000000000a'),
  'pendiente', 'la invitacion pasa a pendiente — recién ahora visible al amigo');
select is(
  (select count(*) from public.ledger where referencia_id = 'a0000000-0000-0000-0000-00000000000a')::int,
  0, 'preautorizar NO escribe ledger — el hold no es un movimiento');

select set_config('request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
set local role authenticated;
select is(
  (select count(*) from public.invitaciones where id = 'a0000000-0000-0000-0000-00000000000a')::int,
  1, 'el receptor (Beto) SÍ ve la invitación ahora que está en pendiente');
reset role;
select set_config('request.jwt.claims', null, true);

-- ============================================================================
-- 4-6. p_ok sobre una `solicitud`: captura en el mismo acto, aceptada, cita.
-- ============================================================================
select is(
  public.confirmar_preautorizacion('b0000000-0000-0000-0000-00000000000b', true, 'hold-b'),
  'aplicada', 'p_ok sobre solicitud devuelve aplicada');
select is(
  (select estado::text from public.ordenes_pago where id = 'b0000000-0000-0000-0000-00000000000b'),
  'capturada', 'la orden de la solicitud queda capturada de una — el acuerdo ya estaba cerrado');
select is(
  (select estado::text from public.invitaciones where id = 'a0000000-0000-0000-0000-00000000000b'),
  'aceptada', 'la solicitud pasa directo a aceptada');
select is(
  (select count(*) from public.ledger where referencia_id = 'a0000000-0000-0000-0000-00000000000b')::int,
  3, 'la captura de la solicitud SÍ escribe las 3 filas de ledger de siempre');
select is(
  (select count(*) from public.citas where invitacion_id = 'a0000000-0000-0000-0000-00000000000b')::int,
  1, 'aceptar una solicitud (vía confirmar_preautorizacion) abre la cita');

-- ============================================================================
-- 7-8. not p_ok: la orden nunca existió como hold, sin ledger.
-- ============================================================================
select is(
  public.confirmar_preautorizacion('b0000000-0000-0000-0000-00000000000c', false, null),
  'aplicada', 'not p_ok devuelve aplicada');
select is(
  (select estado::text from public.ordenes_pago where id = 'b0000000-0000-0000-0000-00000000000c'),
  'fallida', 'la orden queda fallida si la preautorización no respondió ok');
select is(
  (select estado::text from public.invitaciones where id = 'a0000000-0000-0000-0000-00000000000c'),
  'expirada', 'invitacion + not p_ok queda expirada — nunca fue visible para nadie');
select is(
  (select count(*) from public.ledger where referencia_id = 'a0000000-0000-0000-0000-00000000000c')::int,
  0, 'not p_ok NO escribe ledger');

-- ============================================================================
-- not p_ok sobre una `solicitud`: NO expira — el amigo no tiene la culpa de
-- que falle la tarjeta del rentador. Vuelve a pendiente, y el rentador puede
-- reintentar con otra tarjeta: el índice único parcial solo bloquea órdenes
-- preautorizada/capturada vivas, así que una segunda orden para la MISMA
-- invitación no colisiona.
-- ============================================================================
select is(
  public.confirmar_preautorizacion('b0000000-0000-0000-0000-00000000000f', false, null),
  'aplicada', 'not p_ok sobre solicitud devuelve aplicada');
select is(
  (select estado::text from public.ordenes_pago where id = 'b0000000-0000-0000-0000-00000000000f'),
  'fallida', 'la orden fallida de la solicitud');
select is(
  (select estado::text from public.invitaciones where id = 'a0000000-0000-0000-0000-00000000000f'),
  'pendiente', 'solicitud + not p_ok vuelve a pendiente, NO expira');
select lives_ok(
  $$ insert into public.ordenes_pago (perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
     values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000f', 30.00, 4.50, 34.50, 'preautorizada', 'mock') $$,
  'tras el fallo, una segunda orden para la misma invitación NO colisiona con el índice parcial');

-- ============================================================================
-- 9. Segunda llamada con el MISMO resultado: idempotente, no duplica. Prueba
-- también el orden de las guardas: para cuando esto corre, INV_A ya NO está
-- en preautorizando (quedó en pendiente arriba) — si la guarda de estado de
-- la invitación estuviera ANTES del cortocircuito de ya_resuelta, esto
-- reventaría en vez de devolver ya_resuelta.
-- ============================================================================
select is(
  public.confirmar_preautorizacion('b0000000-0000-0000-0000-00000000000a', true, 'hold-a'),
  'ya_resuelta', 'una segunda confirmación con el mismo resultado es idempotente, aunque la invitación ya no esté en preautorizando');
select is(
  (select count(*) from public.citas where invitacion_id = 'a0000000-0000-0000-0000-00000000000b')::int,
  1, 'reconfirmar la solicitud (si se reintentara) no duplicaría la cita');

-- ============================================================================
-- 10. Orden que no está en pendiente y no coincide con el resultado pedido →
-- transición ilegal.
-- ============================================================================
select throws_ok(
  $$ select public.confirmar_preautorizacion('b0000000-0000-0000-0000-00000000000d', true, null) $$,
  'P0001', null, 'confirmar sobre una orden que no está pendiente ni ya resuelta con ese resultado falla');

-- ============================================================================
-- La invitación ya no está en preautorizando (guarda nueva, orden de locks:
-- invitación primero) → transición ilegal, aunque su orden sí esté pendiente.
-- ============================================================================
select throws_ok(
  $$ select public.confirmar_preautorizacion('b0000000-0000-0000-0000-00000000000e', true, null) $$,
  'P0001', null, 'confirmar sobre una invitación que ya no espera preautorización falla');

-- ============================================================================
-- Orden inexistente falla como no encontrada (AY404, no genérico) — E.2b
-- Tarea 4b, mismo motivo que capturar_orden (13): pago-webhook distinguía
-- 404 de 500 leyendo el TEXTO del mensaje, sin errcode propio que lo probara.
-- ============================================================================
select throws_ok(
  $$ select public.confirmar_preautorizacion('ffffffff-ffff-ffff-ffff-ffffffffffff', true, null) $$,
  'AY404', null, 'confirmar sobre una orden inexistente falla con AY404, no con un error genérico');

-- ============================================================================
-- 11-12. El cliente no puede ejecutar la función.
-- ============================================================================
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;
select throws_ok(
  $$ select public.confirmar_preautorizacion('b0000000-0000-0000-0000-00000000000c', true, null) $$,
  '42501', null, 'un cliente autenticado NO puede ejecutar confirmar_preautorizacion');
reset role;
select set_config('request.jwt.claims', null, true);

set local role anon;
select throws_ok(
  $$ select public.confirmar_preautorizacion('b0000000-0000-0000-0000-00000000000c', true, null) $$,
  '42501', null, 'anon tampoco puede ejecutar confirmar_preautorizacion');
reset role;

select * from finish();
