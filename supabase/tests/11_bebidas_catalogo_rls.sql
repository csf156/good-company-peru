-- pgTAP: RLS del catálogo de bebidas (config del operador) — Fase 3.0.
-- El catálogo lo administra el operador (service_role). El cliente solo LEE
-- bebidas activas; nunca escribe precios ni ve bebidas desactivadas.
select plan(4);

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'ana@test.dev', '', now(), now(), now(), '', '', '', '');

insert into public.profiles (id, rol, alias)
values ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias');

-- Catálogo sembrado como postgres: una activa, una desactivada.
insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v, activo) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pisco Sour', 'divertida', 30.00, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bebida Retirada', 'autor', 999.00, false);

-- --- impersonar a Ana ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select nombre from public.bebidas_catalogo
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Pisco Sour', 'Ana ve una bebida activa del catálogo');

select is(
  (select count(*) from public.bebidas_catalogo
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::int,
  0, 'Ana NO ve una bebida desactivada (activo = false)');

-- El cliente no altera el catálogo (precio/valor lo fija el operador)
select throws_ok(
  $$ insert into public.bebidas_catalogo (nombre, tipo_invitacion, valor_v)
     values ('Bebida Pirata', 'divertida', 0.01) $$,
  '42501', null, 'Ana NO puede insertar bebidas en el catálogo');

select throws_ok(
  $$ update public.bebidas_catalogo set valor_v = 0.01
     where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  '42501', null, 'Ana NO puede alterar el precio de una bebida');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
