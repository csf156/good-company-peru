-- pgTAP: la vista `balance` es una suma calculada del ledger, aislada por RLS
-- (Fase 3.0). El balance nunca es un número mutable suelto: se recalcula
-- sumando `monto` (con signo) por perfil. security_invoker garantiza que cada
-- quien vea SOLO su balance.
select plan(5);

select has_view('public', 'balance', 'existe la vista balance');

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

insert into public.profiles (id, rol, alias)
values
  ('11111111-1111-1111-1111-111111111111', 'amigo', 'AliceAlias'),
  ('22222222-2222-2222-2222-222222222222', 'rentador', 'BobAlias');

-- Ledger (como postgres/service_role). Alice: +100 payout, -20 fee = 80.
-- Bob: +50 payout = 50.
insert into public.ledger (perfil_id, tipo, monto, idempotency_key) values
  ('11111111-1111-1111-1111-111111111111', 'payout', 100.00, 'a:payout'),
  ('11111111-1111-1111-1111-111111111111', 'fee', -20.00, 'a:fee'),
  ('22222222-2222-2222-2222-222222222222', 'payout', 50.00, 'b:payout');

-- --- impersonar a Alice ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select balance from public.balance
    where perfil_id = '11111111-1111-1111-1111-111111111111'),
  80.00::numeric,
  'balance de Alice = suma con signo del ledger (100 - 20 = 80)');

select is(
  (select count(*) from public.balance)::int,
  1, 'Alice solo ve 1 grupo en balance (el suyo)');

select is(
  (select count(*) from public.balance
    where perfil_id = '22222222-2222-2222-2222-222222222222')::int,
  0, 'Alice NO ve el balance de Bob (security_invoker aísla)');

reset role;
select set_config('request.jwt.claims', null, true);

-- --- impersonar a Bob ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select balance from public.balance
    where perfil_id = '22222222-2222-2222-2222-222222222222'),
  50.00::numeric,
  'balance de Bob = 50');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
