-- pgTAP: calcular_desglose (Fase E.3, Tarea 2) — desglose de compra de
-- solo lectura, para que el cliente pueda mostrar el total ANTES de
-- confirmar sin calcularlo él mismo (regla de oro del proyecto).
--
-- Reduce deuda de paso: la fórmula del fee vivía en DOS sitios (TypeScript
-- en _shared/pagos.ts, SQL inline en crear_invitacion y responder_invitacion).
-- Esta función pasa a ser la ÚNICA copia en SQL; las otras dos la llaman en
-- vez de repetirla. El assert que más importa es que coincida AL CÉNTIMO con
-- lo que crear_invitacion/responder_invitacion terminan escribiendo — si
-- divergen, el usuario ve un precio y se le cobra otro.
select plan(14);

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
   'cami@test.dev', '', now(), now(), now(), '', '', '', '');

insert into public.profiles (id, rol, alias, kyc_estado)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias', 'verificado'),
  ('22222222-2222-2222-2222-222222222222', 'amigo', 'BetoAlias', 'verificado'),
  ('33333333-3333-3333-3333-333333333333', 'rentador', 'CamiAlias', 'verificado');

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v, activo)
values
  ('99999999-9999-9999-9999-999999999999', 'Pisco Sour', 'divertida', 40.00, true),
  ('88888888-8888-8888-8888-888888888888', 'Vino Inactivo', 'romantica', 25.00, false);

-- ============================================================================
-- 1. Desglose de una bebida activa: valor_v del catálogo, buyer_fee = 15%
--    redondeado en centavos, total = suma.
-- ============================================================================
select is(
  (select valor_v from public.calcular_desglose('99999999-9999-9999-9999-999999999999')),
  40.00::numeric, 'valor_v = el del catálogo');
select is(
  (select buyer_fee from public.calcular_desglose('99999999-9999-9999-9999-999999999999')),
  6.00::numeric, 'buyer_fee = 15%% de valor_v, redondeado a centavos');
select is(
  (select total from public.calcular_desglose('99999999-9999-9999-9999-999999999999')),
  46.00::numeric, 'total = valor_v + buyer_fee');

-- ============================================================================
-- 2. Coincide AL CÉNTIMO con lo que crear_invitacion escribe en ordenes_pago
--    para la misma bebida — el assert que importa.
-- ============================================================================
select public.crear_invitacion(
  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
  'invitacion', '99999999-9999-9999-9999-999999999999', 30, 'Miraflores', 'test-key-1');

select is(
  (select o.valor_v from public.ordenes_pago o
     join public.invitaciones i on i.id = o.invitacion_id
    where i.idempotency_key = 'test-key-1'),
  (select valor_v from public.calcular_desglose('99999999-9999-9999-9999-999999999999')),
  'crear_invitacion escribe el mismo valor_v que calcular_desglose');
select is(
  (select o.buyer_fee from public.ordenes_pago o
     join public.invitaciones i on i.id = o.invitacion_id
    where i.idempotency_key = 'test-key-1'),
  (select buyer_fee from public.calcular_desglose('99999999-9999-9999-9999-999999999999')),
  'crear_invitacion escribe el mismo buyer_fee que calcular_desglose');
select is(
  (select o.total from public.ordenes_pago o
     join public.invitaciones i on i.id = o.invitacion_id
    where i.idempotency_key = 'test-key-1'),
  (select total from public.calcular_desglose('99999999-9999-9999-9999-999999999999')),
  'crear_invitacion escribe el mismo total que calcular_desglose');

-- Regresión explícita (Step 1, punto 8): el mismo monto que el cálculo
-- inline producía antes de esta tarea, no solo "coincide consigo mismo".
select is(
  (select o.total from public.ordenes_pago o
     join public.invitaciones i on i.id = o.invitacion_id
    where i.idempotency_key = 'test-key-1'),
  46.00::numeric, 'crear_invitacion sigue produciendo el mismo monto que antes de esta tarea');

-- Mismo assert, camino de la solicitud (responder_invitacion también pasa a
-- llamar calcular_desglose): coincide al céntimo también ahí.
select public.crear_invitacion(
  '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
  'solicitud', null, 30, 'San Isidro', 'test-key-2');
select public.responder_invitacion(
  '33333333-3333-3333-3333-333333333333',
  (select id from public.invitaciones where idempotency_key = 'test-key-2'),
  'aceptar', '99999999-9999-9999-9999-999999999999');

select is(
  (select o.total from public.ordenes_pago o
     join public.invitaciones i on i.id = o.invitacion_id
    where i.idempotency_key = 'test-key-2'),
  46.00::numeric, 'responder_invitacion (solicitud) también coincide al céntimo con calcular_desglose');

-- ============================================================================
-- 3/4. Bebida inactiva / inexistente: no devuelve filas.
-- ============================================================================
select is(
  (select count(*)::int from public.calcular_desglose('88888888-8888-8888-8888-888888888888')),
  0, 'una bebida inactiva no devuelve filas');
select is(
  (select count(*)::int from public.calcular_desglose('00000000-0000-0000-0000-000000000000')),
  0, 'una bebida inexistente no devuelve filas');

-- ============================================================================
-- 5/6. Permisos: authenticated SÍ, anon NO — reproducido, no leído de pg_proc.
-- ============================================================================
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;
select lives_ok(
  $$ select * from public.calcular_desglose('99999999-9999-9999-9999-999999999999') $$,
  'authenticated SÍ puede ejecutar calcular_desglose');
reset role;
select set_config('request.jwt.claims', null, true);

set local role anon;
select throws_ok(
  $$ select * from public.calcular_desglose('99999999-9999-9999-9999-999999999999') $$,
  '42501', null, 'anon NO puede ejecutar calcular_desglose');
reset role;

-- ============================================================================
-- 7. No escribe nada — escopado a las invitaciones de ESTE fixture, no al
--    total de la tabla (la base de dev ya tiene datos demo persistentes;
--    contar global fue exactamente el defecto que se corrigió en E.2b
--    Tarea 4b — no repetirlo acá). Solo existen las 2 órdenes que crearon
--    crear_invitacion y responder_invitacion arriba, pese a todas las
--    llamadas a calcular_desglose de este archivo (es `stable`, de solo
--    lectura).
-- ============================================================================
select is(
  (select count(*)::int from public.ordenes_pago o
     join public.invitaciones i on i.id = o.invitacion_id
    where i.idempotency_key in ('test-key-1', 'test-key-2')),
  2, 'calcular_desglose no escribe ninguna orden propia');
select is(
  (select count(*)::int from public.ledger l
     join public.invitaciones i on i.id = l.referencia_id
    where i.idempotency_key in ('test-key-1', 'test-key-2')),
  0, 'calcular_desglose no escribe ledger (ninguna de las 2 órdenes de arriba se capturó)');

select * from finish();
