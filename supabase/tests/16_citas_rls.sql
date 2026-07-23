-- pgTAP: schema + aislamiento RLS de `citas` — Fase 4.0.
-- La cita cuelga de una invitación; la ven SOLO las dos partes de esa
-- invitación (emisor / receptor). Crear la cita y mover su estado es del
-- service_role (motor de cita / Edge Functions 4.3, 4.5, 5.x): el cliente
-- nunca inserta ni muta una cita directamente.
select plan(6);

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
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pendiente');

-- --- impersonar a Ana (parte: emisor) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.citas
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  1, 'Ana (parte) ve la cita');

-- El cliente no crea citas (lo hace responder-invitacion vía service_role)
select throws_ok(
  $$ insert into public.citas (invitacion_id, estado)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'confirmada') $$,
  '42501', null, 'Ana NO puede insertar una cita directamente');

-- El cliente no muta el estado de la cita (motor de cita = service_role)
select throws_ok(
  $$ update public.citas set estado = 'en_curso'
     where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' $$,
  '42501', null, 'Ana NO puede cambiar el estado de la cita');

-- --- impersonar a Beto (parte: receptor) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.citas
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  1, 'Beto (parte) ve la cita');

-- --- impersonar a Carla (ajena) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.citas
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  0, 'Carla (ajena) NO ve la cita');

-- --- una cita cuelga de exactamente una invitación (unique) ---
reset role;
select set_config('request.jwt.claims', null, true);

select throws_ok(
  $$ insert into public.citas (invitacion_id, estado)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pendiente') $$,
  '23505', null, 'una invitación no puede tener dos citas (unique)');

select * from finish();
