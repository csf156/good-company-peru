-- Fase D.3 bloque 2 — embudo de onboarding.
select plan(6);

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'ana-onboarding@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'beto-onboarding@test.dev', '', now(), now(), now(), '', '', '', '');

-- Forma de la tabla
select has_table('public', 'onboarding_eventos', 'existe la tabla de eventos de onboarding');
select columns_are(
  'public', 'onboarding_eventos',
  array['id', 'perfil_id', 'paso', 'evento', 'created_at'],
  'onboarding_eventos tiene exactamente las columnas esperadas'
);

-- Impersonar a Ana e insertar un evento propio
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select lives_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('33333333-3333-3333-3333-333333333333', 2, 'paso_visto')$$,
  'Ana puede insertar un evento propio'
);

-- Anti-suplantación: Ana no puede insertar eventos a nombre de Beto
select throws_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('44444444-4444-4444-4444-444444444444', 3, 'paso_visto')$$,
  '42501',
  null,
  'Ana no puede insertar un evento con el perfil_id de Beto'
);

reset role;
select set_config('request.jwt.claims', null, true);

-- Insertar un evento de Beto (con service_role, sin pasar por RLS) para
-- probar el aislamiento de lectura.
insert into public.onboarding_eventos (perfil_id, paso, evento)
values ('44444444-4444-4444-4444-444444444444', 1, 'paso_visto');

-- Aislamiento: Ana no puede leer los eventos de Beto — el embudo de otra
-- persona no es asunto suyo. Es el test que más importa de este archivo.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*)::int from public.onboarding_eventos where perfil_id = '44444444-4444-4444-4444-444444444444'),
  0,
  'Ana no puede leer los eventos de onboarding de Beto'
);

reset role;
select set_config('request.jwt.claims', null, true);

-- Append-only: ni UPDATE ni DELETE para authenticated, igual que el ledger.
select throws_ok(
  $$update public.onboarding_eventos set paso = 5 where perfil_id = '33333333-3333-3333-3333-333333333333'$$,
  '42501',
  null,
  'authenticated no puede actualizar onboarding_eventos (append-only)'
);

select * from finish();
