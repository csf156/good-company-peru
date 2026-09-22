-- pgTAP: función atómica confirmar_cita (Fase 4.5).
-- El AMIGO de una cita 'pendiente' captura zona/hora/mensaje y la confirma.
-- "El amigo" se determina dinámicamente (join invitaciones + profiles.rol), NO
-- es fijo a emisor ni a receptor: cubre ambas direcciones (`invitacion` y
-- `solicitud`). Cubre los dos tests nombrados por el plan ("solo el amigo puede
-- confirmar" y "confirmar setea estado y detalles"), más idempotencia,
-- anti-suplantación, estados no confirmables y el revoke del cliente.
select plan(20);

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
   'carla@test.dev', '', now(), now(), now(), '', '', '', ''),
  -- F.1 Tarea 5: aaaa0002/3/4 tenían el mismo par (Ana, Beto) que aaaa0001 —
  -- las cuatro 'aceptada' (no-terminal) a la vez, colisión con el índice
  -- único por par (spec §6). Cada una pasa a un par propio.
  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'dora.f22t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated',
   'eva.f22t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated',
   'fito.f22t5@test.dev', '', now(), now(), now(), '', '', '', '');

-- Ana: rentador. Beto: amigo. Carla: amigo (tercero, ajeno a estas citas).
-- Dora/Eva/Fito (F.1 Tarea 5): amigos, cada uno contraparte de UNA sola cita.
insert into public.profiles (id, rol, alias)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias'),
  ('22222222-2222-2222-2222-222222222222', 'amigo', 'BetoAlias'),
  ('33333333-3333-3333-3333-333333333333', 'amigo', 'CarlaAlias'),
  ('44444444-4444-4444-4444-444444444444', 'amigo', 'DoraAlias'),
  ('55555555-5555-5555-5555-555555555555', 'amigo', 'EvaAlias'),
  ('66666666-6666-6666-6666-666666666666', 'amigo', 'FitoAlias');

-- ============================================================================
-- Dirección `invitacion` (rentador→amigo): Ana emisora, Beto receptor. El amigo
-- (Beto) es el RECEPTOR acá.
-- ============================================================================
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, estado)
values ('aaaa0001-0000-0000-0000-000000000000',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        'invitacion', 'especifica', 'aceptada');
insert into public.citas (id, invitacion_id, estado)
values ('cccc0001-0000-0000-0000-000000000000', 'aaaa0001-0000-0000-0000-000000000000', 'pendiente');

-- ============================================================================
-- Dirección `solicitud` (amigo→rentador): Dora emisora, Ana receptora. El
-- amigo (Dora) es el EMISOR acá — invierte respecto al caso anterior. (F.1
-- Tarea 5: Dora en vez de Beto — ver comentario del bloque de usuarios.)
-- ============================================================================
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, estado)
values ('aaaa0002-0000-0000-0000-000000000000',
        '44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111',
        'solicitud', 'especifica', 'aceptada');
insert into public.citas (id, invitacion_id, estado)
values ('cccc0002-0000-0000-0000-000000000000', 'aaaa0002-0000-0000-0000-000000000000', 'pendiente');

-- Una tercera cita (dirección invitacion) para probar estados no confirmables
-- e idempotencia sin interferir con las de arriba. (F.1 Tarea 5: Eva en vez
-- de Beto.)
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, estado)
values ('aaaa0003-0000-0000-0000-000000000000',
        '11111111-1111-1111-1111-111111111111',
        '55555555-5555-5555-5555-555555555555',
        'invitacion', 'especifica', 'aceptada');
insert into public.citas (id, invitacion_id, estado)
values ('cccc0003-0000-0000-0000-000000000000', 'aaaa0003-0000-0000-0000-000000000000', 'pendiente');

-- Cuarta cita ya en 'en_curso' (fase 5.x) — estado no confirmable desde acá.
-- (F.1 Tarea 5: Fito en vez de Beto.)
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, estado)
values ('aaaa0004-0000-0000-0000-000000000000',
        '11111111-1111-1111-1111-111111111111',
        '66666666-6666-6666-6666-666666666666',
        'invitacion', 'especifica', 'aceptada');
insert into public.citas (id, invitacion_id, estado)
values ('cccc0004-0000-0000-0000-000000000000', 'aaaa0004-0000-0000-0000-000000000000', 'en_curso');

-- ============================================================================
-- **Test nombrado por el plan: "solo el amigo puede confirmar"** — el rentador
-- (Ana) NO puede confirmar, en NINGUNA de las dos direcciones (el amigo cambia
-- de receptor a emisor entre ellas — Beto en cccc0001, Dora en cccc0002 desde
-- F.1 Tarea 5 — pero en ambas es Ana quien queda bloqueada).
-- ============================================================================
select throws_ok(
  $$ select public.confirmar_cita(
       '11111111-1111-1111-1111-111111111111',
       'cccc0001-0000-0000-0000-000000000000', 'Barranco', now() + interval '1 day', null) $$,
  'AY403', null, 'el rentador NO puede confirmar (dirección invitacion, amigo=receptor)');

select throws_ok(
  $$ select public.confirmar_cita(
       '11111111-1111-1111-1111-111111111111',
       'cccc0002-0000-0000-0000-000000000000', 'Barranco', now() + interval '1 day', null) $$,
  'AY403', null, 'el rentador NO puede confirmar (dirección solicitud, amigo=emisor)');

-- Un tercero ajeno (Carla, amigo pero de OTRA cita) tampoco puede confirmar.
select throws_ok(
  $$ select public.confirmar_cita(
       '33333333-3333-3333-3333-333333333333',
       'cccc0001-0000-0000-0000-000000000000', 'Barranco', now() + interval '1 day', null) $$,
  'AY403', null, 'un tercero ajeno (aunque sea rol amigo) no puede confirmar');

-- ============================================================================
-- **Test nombrado por el plan: "confirmar setea estado y detalles"**.
-- ============================================================================
select is(
  public.confirmar_cita(
    '22222222-2222-2222-2222-222222222222',
    'cccc0001-0000-0000-0000-000000000000', 'Ayahuasca Bar, Barranco', '2026-07-25 21:30:00-05', 'Nos vemos en la barra'),
  'confirmada', 'el amigo confirma la cita (dirección invitacion, amigo=receptor)');
select is(
  (select estado::text from public.citas where id = 'cccc0001-0000-0000-0000-000000000000'),
  'confirmada', 'la cita confirmada queda en estado confirmada');
select is(
  (select zona from public.citas where id = 'cccc0001-0000-0000-0000-000000000000'),
  'Ayahuasca Bar, Barranco', 'confirmar guarda la zona');
select is(
  (select hora from public.citas where id = 'cccc0001-0000-0000-0000-000000000000'),
  '2026-07-25 21:30:00-05'::timestamptz, 'confirmar guarda la hora');
select is(
  (select mensaje from public.citas where id = 'cccc0001-0000-0000-0000-000000000000'),
  'Nos vemos en la barra', 'confirmar guarda el mensaje adicional');
select isnt(
  (select confirmada_at from public.citas where id = 'cccc0001-0000-0000-0000-000000000000'),
  null, 'confirmar setea confirmada_at');

-- Dirección `solicitud`: el amigo (Dora, F.1 Tarea 5) es el EMISOR acá y
-- también puede confirmar.
select is(
  public.confirmar_cita(
    '44444444-4444-4444-4444-444444444444',
    'cccc0002-0000-0000-0000-000000000000', 'Casa de Dora', '2026-07-26 20:00:00-05', null),
  'confirmada', 'el amigo confirma la cita (dirección solicitud, amigo=emisor)');
select is(
  (select estado::text from public.citas where id = 'cccc0002-0000-0000-0000-000000000000'),
  'confirmada', 'la cita de la solicitud queda confirmada');
select is(
  (select mensaje from public.citas where id = 'cccc0002-0000-0000-0000-000000000000'),
  null, 'mensaje es opcional: null cuando no viene');

-- ============================================================================
-- Idempotente-benigno: confirmar de nuevo una cita ya confirmada no reaplica
-- (no pisa la zona/hora ya guardadas con un segundo intento con datos distintos).
-- ============================================================================
select is(
  public.confirmar_cita(
    '22222222-2222-2222-2222-222222222222',
    'cccc0001-0000-0000-0000-000000000000', 'OTRA ZONA', now(), 'otro mensaje'),
  'ya_confirmada', 'confirmar de nuevo una cita ya confirmada es benigno');
select is(
  (select zona from public.citas where id = 'cccc0001-0000-0000-0000-000000000000'),
  'Ayahuasca Bar, Barranco', 'una reconfirmación benigna NO pisa la zona ya guardada');

-- ============================================================================
-- Estado no confirmable (fase 5.x: en_curso) → conflicto.
-- ============================================================================
select throws_ok(
  $$ select public.confirmar_cita(
       '66666666-6666-6666-6666-666666666666',
       'cccc0004-0000-0000-0000-000000000000', 'Barranco', now(), null) $$,
  'AY409', null, 'una cita en_curso no es confirmable desde acá');

-- ============================================================================
-- Forma mínima: zona/hora requeridas (defensa en profundidad).
-- ============================================================================
select throws_ok(
  $$ select public.confirmar_cita(
       '55555555-5555-5555-5555-555555555555',
       'cccc0003-0000-0000-0000-000000000000', '', now(), null) $$,
  'AY400', null, 'zona vacía es forma inválida');
select throws_ok(
  $$ select public.confirmar_cita(
       '55555555-5555-5555-5555-555555555555',
       'cccc0003-0000-0000-0000-000000000000', 'Barranco', null, null) $$,
  'AY400', null, 'hora nula es forma inválida');

-- ============================================================================
-- Cita inexistente → no encontrada.
-- ============================================================================
select throws_ok(
  $$ select public.confirmar_cita(
       '22222222-2222-2222-2222-222222222222',
       '00000000-0000-0000-0000-0000000000ff', 'Barranco', now(), null) $$,
  'AY404', null, 'confirmar una cita inexistente falla como no encontrada');

-- ============================================================================
-- El cliente no puede ejecutar la función directamente (es del service_role).
-- ============================================================================
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '55555555-5555-5555-5555-555555555555', 'role', 'authenticated')::text,
  true);
set local role authenticated;
select throws_ok(
  $$ select public.confirmar_cita(
       '55555555-5555-5555-5555-555555555555',
       'cccc0003-0000-0000-0000-000000000000', 'Barranco', now(), null) $$,
  '42501', null, 'un cliente autenticado NO puede ejecutar confirmar_cita');
reset role;
select set_config('request.jwt.claims', null, true);

-- La cita usada para probar forma/inexistencia sigue pendiente (nada la tocó).
select is(
  (select estado::text from public.citas where id = 'cccc0003-0000-0000-0000-000000000000'),
  'pendiente', 'la cita usada solo para probar errores de forma sigue pendiente');

select * from finish();
