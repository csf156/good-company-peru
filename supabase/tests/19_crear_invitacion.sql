-- pgTAP: función atómica crear_invitacion (Fase 4.2).
-- Único camino que emite una propuesta y bloquea la bebida del bar del emisor.
-- Corre en UNA transacción con row lock, así:
--   * el emisor debe estar KYC-verificado (gate de negocio, fuente de verdad acá);
--   * una invitación de rentador pasa su bebida de `disponible`→`bloqueada`,
--     atómico con la creación de la fila (un fallo no deja el otro aplicado);
--   * no se puede invitar con una bebida ya `bloqueada`/`consumida`;
--   * idempotente: un reintento con la misma idempotency_key devuelve la fila ya
--     creada SIN re-validar ni re-bloquear la bebida;
--   * el cliente no puede ejecutar la función (crear/mover invitaciones es del
--     service_role).
select plan(17);

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

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v)
values ('99999999-9999-9999-9999-999999999999', 'Pisco Sour', 'divertida', 30.00);

-- Stock sembrado como postgres (simula al service_role tras una compra).
insert into public.bar (id, perfil_id, bebida_id, estado)
values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
   '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'disponible'),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2',
   '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'disponible'),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3',
   '33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'disponible');

-- ============================================================================
-- Camino feliz: Ana (rentador verificado) invita a Beto con bebida disponible.
-- ============================================================================
select lives_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222',
       'invitacion', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
       60, 'Miraflores', 'key-1') $$,
  'crear una invitación válida no falla');

select is(
  (select estado::text from public.invitaciones where idempotency_key = 'key-1'),
  'pendiente', 'la invitación nace en estado pendiente');
select is(
  (select alcance::text from public.invitaciones where idempotency_key = 'key-1'),
  'especifica', 'la invitación es de alcance especifica (global es SP2)');
select is(
  (select bebida_bar_id from public.invitaciones where idempotency_key = 'key-1'),
  'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'::uuid, 'guarda la bebida del bar');
select is(
  (select estado::text from public.bar where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'),
  'bloqueada', 'la bebida pasa de disponible a bloqueada (fondos ya en escrow)');

-- ============================================================================
-- Idempotencia: reintento con la MISMA key devuelve la fila ya creada sin
-- re-validar ni re-bloquear la bebida (que este intento ya dejó bloqueada).
-- ============================================================================
select is(
  (select (public.crear_invitacion(
     '11111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222',
     'invitacion', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
     60, 'Miraflores', 'key-1')).id),
  (select id from public.invitaciones where idempotency_key = 'key-1'),
  'un reintento con la misma idempotency_key devuelve la misma invitación');
select is(
  (select count(*) from public.invitaciones where idempotency_key = 'key-1')::int,
  1, 'el reintento idempotente NO crea una segunda fila');

-- ============================================================================
-- No se puede invitar con una bebida ya bloqueada (key nueva, misma bebida).
-- ============================================================================
select throws_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222',
       'invitacion', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
       60, 'Miraflores', 'key-2') $$,
  'AY409', null, 'no se puede invitar con una bebida ya bloqueada');
select is(
  (select count(*) from public.invitaciones where idempotency_key = 'key-2')::int,
  0, 'el conflicto de bebida no deja una invitación huérfana');

-- ============================================================================
-- Emisor no verificado (Carla) rechazado.
-- ============================================================================
select throws_ok(
  $$ select public.crear_invitacion(
       '33333333-3333-3333-3333-333333333333',
       '11111111-1111-1111-1111-111111111111',
       'invitacion', 'a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3',
       60, 'Miraflores', 'key-3') $$,
  'AY403', null, 'un emisor no verificado (KYC) es rechazado');

-- ============================================================================
-- Solicitud de amigo: sin bebida (la pone el rentador al aceptar, 4.3).
-- ============================================================================
select lives_ok(
  $$ select public.crear_invitacion(
       '22222222-2222-2222-2222-222222222222',
       '11111111-1111-1111-1111-111111111111',
       'solicitud', null, null, 'Barranco', 'key-4') $$,
  'crear una solicitud sin bebida no falla');
select is(
  (select bebida_bar_id from public.invitaciones where idempotency_key = 'key-4'),
  null, 'la solicitud no lleva bebida todavía');

-- ============================================================================
-- Validaciones de forma que también viven en la función (defensa en profundidad).
-- ============================================================================
select throws_ok(
  $$ select public.crear_invitacion(
       '22222222-2222-2222-2222-222222222222',
       '11111111-1111-1111-1111-111111111111',
       'solicitud', 'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 30, 'z', 'key-5') $$,
  'AY400', null, 'una solicitud NO puede llevar bebida');

select throws_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '11111111-1111-1111-1111-111111111111',
       'invitacion', 'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 60, 'z', 'key-6') $$,
  'AY400', null, 'nadie se invita a sí mismo');

select throws_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222',
       'invitacion', null, 60, 'z', 'key-7') $$,
  'AY400', null, 'una invitación de rentador requiere bebida');

-- Bebida que NO es del bar del emisor (es de Carla) → conflicto.
select throws_ok(
  $$ select public.crear_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22222222-2222-2222-2222-222222222222',
       'invitacion', 'a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', 60, 'z', 'key-8') $$,
  'AY409', null, 'no se puede invitar con una bebida que no es de tu bar');

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
       'invitacion', 'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 60, 'z', 'key-9') $$,
  '42501', null, 'un cliente autenticado NO puede ejecutar crear_invitacion');
reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
