-- pgTAP: moderación anti-fuga del chat (Fase 4.4).
-- Cubre: (1) el trigger BEFORE INSERT oculta mensajes con patrones de fuga
-- (teléfono / cuenta larga / palabra clave) y deja pasar los inocuos; (2) la
-- reincidencia incrementa profiles.flags->chat_violaciones; (3) la RLS corregida
-- deja al emisor ver su propio mensaje oculto pero NO a la contraparte, y sigue
-- bloqueando a usuarios ajenos (cierra el hallazgo de 4.0).
select plan(12);

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

-- ============================================================================
-- (1) El trigger oculta lo que matchea, deja pasar lo inocuo.
-- Insertamos como postgres (el trigger corre igual, sea cual sea el rol) y
-- verificamos el valor final de `oculto` en la fila.
-- ============================================================================

-- **Test nombrado por el plan: "mensaje con teléfono es marcado".**
insert into public.chat_mensajes (id, cita_id, emisor_id, texto)
values ('d0000001-0000-0000-0000-000000000001',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '11111111-1111-1111-1111-111111111111', 'mi celular es 987654321');
select is(
  (select oculto from public.chat_mensajes where id = 'd0000001-0000-0000-0000-000000000001'),
  true, 'mensaje con teléfono es marcado');

-- Teléfono con guiones también se marca (los separadores no evaden).
insert into public.chat_mensajes (id, cita_id, emisor_id, texto)
values ('d0000002-0000-0000-0000-000000000002',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '11111111-1111-1111-1111-111111111111', 'llamame al 987-654-321');
select is(
  (select oculto from public.chat_mensajes where id = 'd0000002-0000-0000-0000-000000000002'),
  true, 'teléfono con guiones también se marca');

-- Palabra clave de pago externo (yape) se marca.
insert into public.chat_mensajes (id, cita_id, emisor_id, texto)
values ('d0000003-0000-0000-0000-000000000003',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '11111111-1111-1111-1111-111111111111', 'mejor pagame por yape');
select is(
  (select oculto from public.chat_mensajes where id = 'd0000003-0000-0000-0000-000000000003'),
  true, 'palabra clave (yape) se marca');

-- Secuencia larga tipo cuenta/CCI se marca.
insert into public.chat_mensajes (id, cita_id, emisor_id, texto)
values ('d0000004-0000-0000-0000-000000000004',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '11111111-1111-1111-1111-111111111111', 'cuenta 00212345678901234567');
select is(
  (select oculto from public.chat_mensajes where id = 'd0000004-0000-0000-0000-000000000004'),
  true, 'cuenta/CCI larga se marca');

-- Mensaje inocuo NO se oculta (sin falsos positivos: hora, casa de 3 dígitos).
insert into public.chat_mensajes (id, cita_id, emisor_id, texto)
values ('d0000005-0000-0000-0000-000000000005',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '22222222-2222-2222-2222-222222222222', 'dale, nos vemos 8pm en la casa 123');
select is(
  (select oculto from public.chat_mensajes where id = 'd0000005-0000-0000-0000-000000000005'),
  false, 'mensaje inocuo NO se oculta');

-- ============================================================================
-- (2) Reincidencia → profiles.flags->chat_violaciones.
-- Beto aún no tiene mensajes ocultos (su único mensaje es inocuo). Su PRIMERA
-- fuga se oculta pero NO marca flag; la SEGUNDA sí (chat_violaciones=1).
-- ============================================================================

-- 1ª fuga de Beto: oculta, sin flag todavía.
insert into public.chat_mensajes (id, cita_id, emisor_id, texto)
values ('d0000006-0000-0000-0000-000000000006',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '22222222-2222-2222-2222-222222222222', 'te paso mi plin');
select is(
  (select flags->>'chat_violaciones' from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'),
  null, 'primera fuga oculta pero NO marca flag de reincidencia');

-- 2ª fuga de Beto: oculta y ahora sí incrementa el flag.
insert into public.chat_mensajes (id, cita_id, emisor_id, texto)
values ('d0000007-0000-0000-0000-000000000007',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '22222222-2222-2222-2222-222222222222', 'mi numero 999888777');
select is(
  (select flags->>'chat_violaciones' from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'),
  '1', 'reincidencia incrementa chat_violaciones en el perfil');

-- ============================================================================
-- (3) RLS: el emisor ve su propio mensaje oculto; la contraparte NO; ajenos nada.
-- ============================================================================

-- --- Ana (emisora) ve su propio mensaje oculto (el teléfono que envió) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.chat_mensajes
    where id = 'd0000001-0000-0000-0000-000000000001')::int,
  1, 'el emisor SÍ ve su propio mensaje oculto (warning)');

-- --- Beto (contraparte) NO ve el mensaje oculto de Ana, pero sí el inocuo ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.chat_mensajes
    where id = 'd0000001-0000-0000-0000-000000000001')::int,
  0, 'la contraparte NO ve el mensaje oculto ajeno');

select is(
  (select count(*) from public.chat_mensajes
    where id = 'd0000005-0000-0000-0000-000000000005')::int,
  1, 'la contraparte SÍ ve los mensajes NO ocultos');

-- Beto ve su propio mensaje oculto (para enterarse de su warning).
select is(
  (select count(*) from public.chat_mensajes
    where id = 'd0000006-0000-0000-0000-000000000006')::int,
  1, 'el emisor ve su propio mensaje oculto aunque sea la contraparte de la cita');

-- --- Carla (ajena) sigue sin ver NADA del chat ---
-- **Test nombrado por el plan: "usuarios ajenos no acceden al chat".**
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.chat_mensajes
    where cita_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  0, 'usuarios ajenos no acceden al chat');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
