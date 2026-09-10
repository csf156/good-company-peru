-- pgTAP: función atómica crear_invitacion (Fase E.2a) — la invitación es la
-- compra (spec §3.2, §4). Reescrita sobre el esquema de E.1: nace en
-- `preautorizando`, crea su propia `orden_pago` en `pendiente`, sin `bar`.
--
-- Conserva de la Fase 4.2 (y su endurecimiento post-review, 20260724130000):
-- gate de KYC del emisor, nadie se invita a sí mismo, coherencia por tipo,
-- idempotencia SCOPED por emisor (una key repetida desde otro emisor NO
-- devuelve la fila ajena — era un hallazgo real de fuga cross-user), EXECUTE
-- solo para service_role.
select plan(26);

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
   'carla@test.dev', '', now(), now(), now(), '', '', '', '');

-- Ana (rentador) y Beto (amigo) verificados; Carla (amigo) SIN verificar.
insert into public.profiles (id, rol, alias, kyc_estado)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias', 'verificado'),
  ('22222222-2222-2222-2222-222222222222', 'amigo', 'BetoAlias', 'verificado'),
  ('33333333-3333-3333-3333-333333333333', 'amigo', 'CarlaAlias', 'pendiente');

-- valor_v = 33.33 a propósito: mismo caso de redondeo que
-- tests/functions/pagos.test.ts (calcularDesgloseCompra) — 15% de 33.33 =
-- 4.9995 -> 5.00, total 38.33. El desglose en SQL tiene que coincidir al
-- céntimo con el de TypeScript (deuda anotada en backlog: vive en dos sitios).
insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v, activo)
values
  ('99999999-9999-9999-9999-999999999999', 'Pisco Sour', 'divertida', 33.33, true),
  ('88888888-8888-8888-8888-888888888888', 'Cóctel Descontinuado', 'divertida', 20.00, false);

-- ============================================================================
-- Camino feliz: Ana (rentador verificado) invita a Beto con bebida activa.
-- ============================================================================
select lives_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222',
       'invitacion', '99999999-9999-9999-9999-999999999999',
       60, 'Miraflores', 'key-1') $$,
  'crear una invitación válida no falla');

select is(
  (select estado::text from public.invitaciones where idempotency_key = 'key-1' and emisor_id = '11111111-1111-1111-1111-111111111111'),
  'preautorizando', 'la invitación nace en preautorizando, no en pendiente');
select is(
  (select alcance::text from public.invitaciones where idempotency_key = 'key-1' and emisor_id = '11111111-1111-1111-1111-111111111111'),
  'especifica', 'la invitación es de alcance especifica (global es SP2)');
select is(
  (select bebida_catalogo_id from public.invitaciones where idempotency_key = 'key-1' and emisor_id = '11111111-1111-1111-1111-111111111111'),
  '99999999-9999-9999-9999-999999999999'::uuid, 'guarda la bebida del catálogo');

-- --- crea UNA orden_pago ligada, con montos calculados en la base ---
select is(
  (select count(*) from public.ordenes_pago op
    join public.invitaciones inv on inv.id = op.invitacion_id
   where inv.idempotency_key = 'key-1' and inv.emisor_id = '11111111-1111-1111-1111-111111111111')::int,
  1, 'crea exactamente una orden_pago ligada a la invitación');
select is(
  (select op.estado::text from public.ordenes_pago op
    join public.invitaciones inv on inv.id = op.invitacion_id
   where inv.idempotency_key = 'key-1' and inv.emisor_id = '11111111-1111-1111-1111-111111111111'),
  'pendiente', 'la orden nace pendiente (la preautorización real es de E.2b)');
select is(
  (select op.valor_v from public.ordenes_pago op
    join public.invitaciones inv on inv.id = op.invitacion_id
   where inv.idempotency_key = 'key-1' and inv.emisor_id = '11111111-1111-1111-1111-111111111111'),
  33.33::numeric, 'valor_v de la orden = valor_v del catálogo');
select is(
  (select op.buyer_fee from public.ordenes_pago op
    join public.invitaciones inv on inv.id = op.invitacion_id
   where inv.idempotency_key = 'key-1' and inv.emisor_id = '11111111-1111-1111-1111-111111111111'),
  5.00::numeric, 'buyer_fee calculado en SQL coincide al céntimo con TypeScript (33.33 -> 4.9995 -> 5.00)');
select is(
  (select op.total from public.ordenes_pago op
    join public.invitaciones inv on inv.id = op.invitacion_id
   where inv.idempotency_key = 'key-1' and inv.emisor_id = '11111111-1111-1111-1111-111111111111'),
  38.33::numeric, 'total = valor_v + buyer_fee (38.33)');

-- ============================================================================
-- Idempotencia: reintento con la MISMA key (mismo emisor) devuelve la fila ya
-- creada, sin re-validar ni crear una segunda orden.
-- ============================================================================
select is(
  (select (public.crear_invitacion(
     '11111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222',
     'invitacion', '99999999-9999-9999-9999-999999999999',
     60, 'Miraflores', 'key-1')).id),
  (select id from public.invitaciones where idempotency_key = 'key-1' and emisor_id = '11111111-1111-1111-1111-111111111111'),
  'un reintento con la misma idempotency_key (mismo emisor) devuelve la misma invitación');
select is(
  (select count(*) from public.invitaciones where idempotency_key = 'key-1' and emisor_id = '11111111-1111-1111-1111-111111111111')::int,
  1, 'el reintento idempotente NO crea una segunda invitación');
select is(
  (select count(*) from public.ordenes_pago op
    join public.invitaciones inv on inv.id = op.invitacion_id
   where inv.idempotency_key = 'key-1' and inv.emisor_id = '11111111-1111-1111-1111-111111111111')::int,
  1, 'el reintento idempotente NO crea una segunda orden');

-- ============================================================================
-- Idempotencia SCOPED por emisor (hallazgo real de la fase 4.2, endurecimiento
-- 20260724130000): la MISMA idempotency_key desde OTRO emisor NO es una
-- colisión ni filtra la invitación ajena — procede por sus propios méritos.
-- ============================================================================
select is(
  (select (public.crear_invitacion(
     '22222222-2222-2222-2222-222222222222',
     '11111111-1111-1111-1111-111111111111',
     'solicitud', null, null, 'Barranco', 'key-1')).emisor_id),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'la misma key desde otro emisor NO devuelve la invitación ajena; crea la suya');
select is(
  (select count(*) from public.invitaciones where idempotency_key = 'key-1')::int,
  2, 'la misma idempotency_key coexiste entre emisores distintos (scope por emisor)');

-- ============================================================================
-- Solicitud de amigo: NO crea orden, bebida_catalogo_id nulo (el rentador
-- pone la bebida y el dinero al aceptar, spec §4.1).
-- ============================================================================
select is(
  (select bebida_catalogo_id from public.invitaciones where idempotency_key = 'key-1' and emisor_id = '22222222-2222-2222-2222-222222222222'),
  null, 'la solicitud no lleva bebida todavía');
select is(
  (select count(*) from public.ordenes_pago op
    join public.invitaciones inv on inv.id = op.invitacion_id
   where inv.idempotency_key = 'key-1' and inv.emisor_id = '22222222-2222-2222-2222-222222222222')::int,
  0, 'una solicitud NO crea orden_pago');

-- ============================================================================
-- Bebida inactiva rechazada.
-- ============================================================================
select throws_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222',
       'invitacion', '88888888-8888-8888-8888-888888888888',
       60, 'Miraflores', 'key-2') $$,
  'AY409', null, 'una bebida inactiva es rechazada');
select is(
  (select count(*) from public.invitaciones where idempotency_key = 'key-2')::int,
  0, 'el rechazo por bebida inactiva no deja una invitación huérfana');

-- ============================================================================
-- Emisor no verificado (Carla) rechazado.
-- ============================================================================
select throws_ok(
  $$ select public.crear_invitacion(
       '33333333-3333-3333-3333-333333333333',
       '11111111-1111-1111-1111-111111111111',
       'invitacion', '99999999-9999-9999-9999-999999999999',
       60, 'Miraflores', 'key-3') $$,
  'AY403', null, 'un emisor no verificado (KYC) es rechazado');

-- ============================================================================
-- Validaciones de forma (defensa en profundidad).
-- ============================================================================
select throws_ok(
  $$ select public.crear_invitacion(
       '22222222-2222-2222-2222-222222222222',
       '11111111-1111-1111-1111-111111111111',
       'solicitud', '99999999-9999-9999-9999-999999999999', 30, 'z', 'key-5') $$,
  'AY400', null, 'una solicitud NO puede llevar bebida');

select throws_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '11111111-1111-1111-1111-111111111111',
       'invitacion', '99999999-9999-9999-9999-999999999999', 60, 'z', 'key-6') $$,
  'AY400', null, 'nadie se invita a sí mismo');

select throws_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222',
       'invitacion', null, 60, 'z', 'key-7') $$,
  'AY400', null, 'una invitación de rentador requiere bebida');

-- Bebida que no existe en el catálogo -> conflicto (FK).
select throws_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222',
       'invitacion', '77777777-7777-7777-7777-777777777777', 60, 'z', 'key-8') $$,
  'AY409', null, 'una bebida que no existe en el catálogo es rechazada');

-- ============================================================================
-- El cliente no puede ejecutar la función directamente (es del service_role).
-- ============================================================================
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;
select throws_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222',
       'invitacion', '99999999-9999-9999-9999-999999999999', 60, 'z', 'key-9') $$,
  '42501', null, 'un cliente autenticado NO puede ejecutar crear_invitacion');
reset role;
select set_config('request.jwt.claims', null, true);

set local role anon;
select throws_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222',
       'invitacion', '99999999-9999-9999-9999-999999999999', 60, 'z', 'key-10') $$,
  '42501', null, 'anon tampoco puede ejecutar crear_invitacion');
reset role;

-- ============================================================================
-- La invitación en preautorizando no es visible para el receptor bajo su RLS
-- (Tarea 2b, 20260910160000) — reproduce la lectura real, no lee pg_policy.
-- ============================================================================
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
set local role authenticated;
select is(
  (select count(*) from public.invitaciones
    where idempotency_key = 'key-1' and emisor_id = '11111111-1111-1111-1111-111111111111')::int,
  0, 'Beto (receptor) NO ve su invitación en preautorizando (dinero aún no cobrado)');
reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
