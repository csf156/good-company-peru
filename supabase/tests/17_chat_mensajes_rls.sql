-- pgTAP: aislamiento RLS de `chat_mensajes` — Fase 4.0.
-- El chat es la ÚNICA tabla de la fase donde el cliente escribe directamente
-- (mensajes en tiempo real): puede INSERTAR su propio mensaje en una cita de la
-- que es parte, y LEER los mensajes de esa cita. No puede suplantar a otro
-- emisor, no puede escribir en una cita ajena, y no puede editar ni borrar
-- mensajes (la moderación de 4.4 marca/oculta vía service_role).
select plan(7);

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

insert into public.profiles (id, rol, alias)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias'),
  ('22222222-2222-2222-2222-222222222222', 'amigo', 'BetoAlias'),
  ('33333333-3333-3333-3333-333333333333', 'amigo', 'CarlaAlias');

insert into public.invitaciones
  (id, emisor_id, receptor_id, tipo, alcance, tiempo_estimado_min, estado)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'invitacion', 'especifica', 60, 'aceptada');

insert into public.citas (id, invitacion_id, estado)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'confirmada');

-- Mensaje sembrado como postgres para probar lectura por ambas partes.
insert into public.chat_mensajes (id, cita_id, emisor_id, texto)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '11111111-1111-1111-1111-111111111111', 'Hola Beto');

-- --- impersonar a Ana (parte) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

-- Ana INSERTA su propio mensaje en su cita → permitido.
select lives_ok(
  $$ insert into public.chat_mensajes (cita_id, emisor_id, texto)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
             '11111111-1111-1111-1111-111111111111', 'Nos vemos 8pm') $$,
  'Ana puede enviar su propio mensaje en su cita');

-- Ana NO puede suplantar a otro emisor.
select throws_ok(
  $$ insert into public.chat_mensajes (cita_id, emisor_id, texto)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
             '22222222-2222-2222-2222-222222222222', 'mensaje falso de Beto') $$,
  '42501', null, 'Ana NO puede enviar mensajes suplantando a Beto');

-- Ana NO puede editar ni borrar mensajes (moderación = service_role).
select throws_ok(
  $$ update public.chat_mensajes set texto = 'editado'
     where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' $$,
  '42501', null, 'Ana NO puede editar un mensaje');

select throws_ok(
  $$ delete from public.chat_mensajes
     where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' $$,
  '42501', null, 'Ana NO puede borrar un mensaje');

-- --- impersonar a Beto (parte) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.chat_mensajes
    where cita_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  2, 'Beto (parte) lee los mensajes de la cita');

-- --- impersonar a Carla (ajena) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.chat_mensajes
    where cita_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  0, 'Carla (ajena) NO lee los mensajes de la cita');

-- Carla NO puede escribir en una cita ajena (ni como ella misma).
select throws_ok(
  $$ insert into public.chat_mensajes (cita_id, emisor_id, texto)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
             '33333333-3333-3333-3333-333333333333', 'me colé') $$,
  '42501', null, 'Carla NO puede escribir en una cita de la que no es parte');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
