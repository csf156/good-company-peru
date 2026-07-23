-- pgTAP: schema + aislamiento RLS de `invitaciones` — Fase 4.0.
-- Una invitación (rentador→amigo) o solicitud (amigo→rentador) la ven SOLO sus
-- dos partes (emisor / receptor). La creación y las transiciones de estado son
-- exclusivas del service_role (Edge Functions `crear-invitacion` / `responder-
-- invitacion`, fases 4.2/4.3): el cliente jamás inserta ni muta una invitación.
select plan(9);

-- --- enums nuevos existen con los valores del plan ---
select has_type('public', 'tipo_propuesta', 'tipo_propuesta existe');
select has_type('public', 'alcance_invitacion', 'alcance_invitacion existe');
select has_type('public', 'estado_invitacion', 'estado_invitacion existe');

-- --- seed (como postgres, bypassa RLS: simula al service_role) ---
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

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v)
values ('99999999-9999-9999-9999-999999999999', 'Pisco Sour', 'divertida', 30.00);

insert into public.bar (id, perfil_id, bebida_id, estado)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999999', 'bloqueada');

-- Ana (rentador) invita a Beto (amigo) con una bebida de su bar.
insert into public.invitaciones
  (id, emisor_id, receptor_id, tipo, alcance, bebida_bar_id,
   tiempo_estimado_min, zona_aproximada, estado)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'invitacion', 'especifica', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   60, 'Miraflores', 'pendiente');

-- --- impersonar a Ana (emisor) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.invitaciones
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::int,
  1, 'Ana (emisor) ve su invitación');

-- El cliente no crea invitaciones (lo hace crear-invitacion vía service_role)
select throws_ok(
  $$ insert into public.invitaciones
       (emisor_id, receptor_id, tipo, alcance, tiempo_estimado_min, estado)
     values ('11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222',
             'invitacion', 'especifica', 30, 'pendiente') $$,
  '42501', null, 'Ana NO puede insertar una invitación directamente');

-- El cliente no muta el estado (aceptar/rechazar es del service_role)
select throws_ok(
  $$ update public.invitaciones set estado = 'aceptada'
     where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  '42501', null, 'Ana NO puede cambiar el estado de su invitación');

-- --- impersonar a Beto (receptor) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.invitaciones
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::int,
  1, 'Beto (receptor) ve la invitación');

-- --- impersonar a Carla (ajena) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.invitaciones
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::int,
  0, 'Carla (ajena) NO ve la invitación');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
