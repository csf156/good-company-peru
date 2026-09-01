-- pgTAP: vista de perfil público (Fase 1.5).
-- Alice debe poder leer los campos seguros del perfil de Bob (cosa que
-- profiles_select_own le prohíbe sobre la tabla base), y la vista NO debe
-- tener columnas sensibles en absoluto (no es cuestión de permisos, es que
-- la columna no existe ahí).
select plan(5);

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

insert into public.profiles (id, rol, nombre, alias, fecha_nacimiento, genero, profesion, kyc_estado)
values
  ('11111111-1111-1111-1111-111111111111', 'amigo', 'Alice Real', 'AliceAlias', current_date - interval '25 years', 'femenino', 'Diseñadora', 'verificado'),
  ('22222222-2222-2222-2222-222222222222', 'rentador', 'Roberto Real', 'BobAlias', current_date - interval '30 years', 'masculino', 'Ingeniero', 'verificado');

-- impersonar a Alice
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

-- Alice puede leer el alias de Bob vía la vista (bloqueado en la tabla base)
select is(
  (select alias from public.perfiles_publicos where id = '22222222-2222-2222-2222-222222222222'),
  'BobAlias',
  'Alice puede leer el alias público de Bob vía la vista');

select is(
  (select kyc_estado::text from public.perfiles_publicos where id = '22222222-2222-2222-2222-222222222222'),
  'verificado',
  'Alice puede ver el badge de verificado de Bob');

-- La tabla base sigue bloqueada para Alice sobre la fila de Bob
select is(
  (select count(*)::int from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  0,
  'La tabla profiles sigue bloqueando a Alice sobre la fila de Bob (RLS intacto)');

-- La vista no tiene columna `nombre` (nombre real, no es el alias público)
select throws_ok(
  $$ select nombre from public.perfiles_publicos limit 1 $$,
  '42703', null, 'La vista perfiles_publicos NO expone la columna nombre');

-- La vista no tiene columnas de dinero/nivel
select throws_ok(
  $$ select recaudacion_acumulada from public.perfiles_publicos limit 1 $$,
  '42703', null, 'La vista perfiles_publicos NO expone recaudacion_acumulada');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
