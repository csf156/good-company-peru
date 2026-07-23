-- pgTAP: aislamiento RLS del bar (stock del rentador) — Fase 3.0.
-- El rentador solo LEE su propio bar. El stock lo crea/mueve el service_role
-- (compra añade; invitación bloquea; cita consume/refund): el cliente nunca
-- escribe su stock.
select plan(4);

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
  ('22222222-2222-2222-2222-222222222222', 'rentador', 'BetoAlias');

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v)
values ('99999999-9999-9999-9999-999999999999', 'Pisco Sour', 'divertida', 30.00);

-- Stock sembrado como postgres (simula al service_role tras una compra).
insert into public.bar (perfil_id, bebida_id, estado)
values
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'disponible'),
  ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'disponible');

-- --- impersonar a Ana ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.bar
    where perfil_id = '11111111-1111-1111-1111-111111111111')::int,
  1, 'Ana ve su propio bar');

select is(
  (select count(*) from public.bar
    where perfil_id = '22222222-2222-2222-2222-222222222222')::int,
  0, 'Ana NO ve el bar de Beto');

-- El cliente no añade stock (lo hace comprar-bebida vía service_role)
select throws_ok(
  $$ insert into public.bar (perfil_id, bebida_id, estado)
     values ('11111111-1111-1111-1111-111111111111',
             '99999999-9999-9999-9999-999999999999', 'disponible') $$,
  '42501', null, 'Ana NO puede añadir stock a su bar directamente');

-- El cliente no consume/desbloquea su propio stock (lo hace el motor de cita)
select throws_ok(
  $$ update public.bar set estado = 'consumida'
     where perfil_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'Ana NO puede cambiar el estado de su stock');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
