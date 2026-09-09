-- pgTAP: el ledger es append-only, idempotente y aislado por RLS (Fase 3.0).
-- Requisitos críticos de dinero:
--   * No se puede UPDATE ni DELETE una fila del ledger (ni siquiera el owner
--     de la base): las correcciones se hacen con filas compensatorias nuevas.
--   * idempotency_key duplicada rechazada (doble webhook no duplica movimiento).
--   * El cliente autenticado NO escribe saldo; solo lee sus propias filas.
select plan(7);

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'alice@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'bob@test.dev', '', now(), now(), now(), '', '', '', '');

-- Alice es 'rentador' aquí a propósito, aunque el test no es sobre roles: las
-- invariantes de crédito/débito de la Fase E.1 (Tareas 3/3b/4) restringen
-- fuerte cualquier movimiento sobre un perfil 'amigo' (payout exige cita
-- finalizada + captura; nada más entra). Este archivo prueba mecánica
-- genérica del ledger (append-only, idempotencia, RLS) — no la semántica de
-- pagos — y no tiene sentido montar un escenario de cita/captura completo
-- solo para poder insertar una fila de relleno.
insert into public.profiles (id, rol, alias)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AliceAlias'),
  ('22222222-2222-2222-2222-222222222222', 'rentador', 'BobAlias');

-- Fila de ledger sembrada como postgres (simula al service_role que sí escribe).
insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
values ('11111111-1111-1111-1111-111111111111', 'payout', 100.00, 'op-1:payout');

-- --- append-only: nadie modifica ni borra filas del ledger ---
select throws_ok(
  $$ update public.ledger set monto = 999999 where idempotency_key = 'op-1:payout' $$,
  'P0001', null, 'no se puede UPDATE una fila del ledger (append-only)');

select throws_ok(
  $$ delete from public.ledger where idempotency_key = 'op-1:payout' $$,
  'P0001', null, 'no se puede DELETE una fila del ledger (append-only)');

-- --- idempotencia: idempotency_key es unique ---
select throws_ok(
  $$ insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
     values ('11111111-1111-1111-1111-111111111111', 'payout', 100.00, 'op-1:payout') $$,
  '23505', null, 'idempotency_key duplicada es rechazada');

-- --- append sí funciona: una fila nueva con otra key entra ---
select lives_ok(
  $$ insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
     values ('11111111-1111-1111-1111-111111111111', 'fee', -20.00, 'op-1:fee') $$,
  'una fila nueva (append) con otra idempotency_key sí se inserta');

-- --- RLS: el cliente autenticado no escribe saldo, solo lee lo suyo ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select throws_ok(
  $$ insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
     values ('11111111-1111-1111-1111-111111111111', 'compra', 50.00, 'hack:1') $$,
  '42501', null, 'Alice (cliente) NO puede escribir en el ledger');

select is(
  (select count(*) from public.ledger
    where perfil_id = '11111111-1111-1111-1111-111111111111')::int,
  2, 'Alice ve sus 2 filas de ledger');

select is(
  (select count(*) from public.ledger
    where perfil_id = '22222222-2222-2222-2222-222222222222')::int,
  0, 'Alice NO ve el ledger de Bob');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
