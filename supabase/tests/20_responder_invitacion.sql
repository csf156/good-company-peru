-- pgTAP: función atómica responder_invitacion (Fase 4.3).
-- El receptor de una invitación pendiente la acepta o la rechaza. Corre en UNA
-- transacción con row lock, así:
--   * solo el receptor responde (ni el emisor ni un tercero);
--   * ACEPTAR exige que el receptor esté KYC-verificado (gate de negocio, fuente
--     de verdad acá). RECHAZAR NO: rechazar solo libera la bebida del emisor, no
--     compromete escrow, así que un receptor no verificado igual puede rechazar
--     (si no, la bebida del emisor quedaría bloqueada para siempre sin salida);
--   * RECHAZAR: invitación → 'rechazada' y, si era una `invitacion` de rentador
--     (bebida ya bloqueada en 4.2), libera la bebida `bloqueada`→`disponible`;
--   * ACEPTAR: invitación → 'aceptada' y crea la `cita` (estado default
--     'pendiente'); si es una `solicitud` de amigo, el receptor-rentador DEBE
--     asignar una bebida de su bar, que se bloquea `disponible`→`bloqueada`;
--   * idempotente-benigno: responder una invitación ya resuelta devuelve
--     'ya_resuelta' sin segundo efecto (mismo criterio que confirmar_orden_pago);
--   * el cliente no puede ejecutar la función (responder es del service_role).
select plan(30);

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
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'dani@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated',
   'elmo@test.dev', '', now(), now(), now(), '', '', '', '');

-- Ana (rentador) y Beto (amigo) verificados; Dani (tercero) verificado; Elmo
-- (amigo) SIN verificar (receptor no verificado).
insert into public.profiles (id, rol, alias, kyc_estado)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias', 'verificado'),
  ('22222222-2222-2222-2222-222222222222', 'amigo', 'BetoAlias', 'verificado'),
  ('44444444-4444-4444-4444-444444444444', 'amigo', 'DaniAlias', 'verificado'),
  ('55555555-5555-5555-5555-555555555555', 'amigo', 'ElmoAlias', 'pendiente');

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v)
values ('99999999-9999-9999-9999-999999999999', 'Pisco Sour', 'divertida', 30.00);

-- Stock. Las `bloqueada` simulan el estado post-4.2 (crear_invitacion ya bloqueó
-- la bebida de una `invitacion`). Las `disponible` son bebidas del bar del
-- rentador libres para asignar al aceptar una `solicitud`.
insert into public.bar (id, perfil_id, bebida_id, estado)
values
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'bloqueada'),  -- INV1 reject → libera
  ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'bloqueada'),  -- INV2 accept → sigue bloqueada
  ('b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'disponible'), -- SOL_ACC: Ana asigna
  ('b4b4b4b4-b4b4-b4b4-b4b4-b4b4b4b4b4b4', '44444444-4444-4444-4444-444444444444', '99999999-9999-9999-9999-999999999999', 'disponible'), -- de Dani: wrong-bar
  ('b5b5b5b5-b5b5-b5b5-b5b5-b5b5b5b5b5b5', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'bloqueada'),  -- INV_UNVER
  ('b6b6b6b6-b6b6-b6b6-b6b6-b6b6b6b6b6b6', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'bloqueada'),  -- INV_YARES
  ('b7b7b7b7-b7b7-b7b7-b7b7-b7b7b7b7b7b7', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'bloqueada'),  -- INV_ACCBEB
  ('b8b8b8b8-b8b8-b8b8-b8b8-b8b8b8b8b8b8', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'bloqueada'),  -- INV_REJBEB
  ('b9b9b9b9-b9b9-b9b9-b9b9-b9b9b9b9b9b9', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'bloqueada'),  -- INV_EMIS
  ('babababa-baba-baba-baba-babababababa', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'bloqueada');  -- INV_UNVER_ACC

-- Invitaciones pendientes sembradas directamente (postgres bypassa RLS), simulando
-- el estado tras crear_invitacion (4.2). `invitacion` = rentador→amigo con bebida;
-- `solicitud` = amigo→rentador sin bebida.
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, bebida_bar_id, estado)
values
  ('11110001-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'pendiente'), -- INV1
  ('11110002-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'pendiente'), -- INV2
  ('11110005-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'invitacion', 'b5b5b5b5-b5b5-b5b5-b5b5-b5b5b5b5b5b5', 'pendiente'), -- INV_UNVER
  ('11110006-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'b6b6b6b6-b6b6-b6b6-b6b6-b6b6b6b6b6b6', 'pendiente'), -- INV_YARES
  ('11110007-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'b7b7b7b7-b7b7-b7b7-b7b7-b7b7b7b7b7b7', 'pendiente'), -- INV_ACCBEB
  ('11110008-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'b8b8b8b8-b8b8-b8b8-b8b8-b8b8b8b8b8b8', 'pendiente'), -- INV_REJBEB
  ('11110009-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'invitacion', 'b9b9b9b9-b9b9-b9b9-b9b9-b9b9b9b9b9b9', 'pendiente'), -- INV_EMIS
  ('22220001-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'solicitud', null, 'pendiente'), -- SOL_ACC
  ('22220002-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'solicitud', null, 'pendiente'), -- SOL_WRONG
  ('22220003-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'solicitud', null, 'pendiente'), -- SOL_REJ
  ('22220004-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'solicitud', null, 'pendiente'), -- SOL_NOBEB
  ('11110010-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'invitacion', 'babababa-baba-baba-baba-babababababa', 'pendiente'); -- INV_UNVER_ACC

-- ============================================================================
-- RECHAZO de una `invitacion` devuelve la bebida a `disponible` (test del plan).
-- ============================================================================
select is(
  public.responder_invitacion(
    '22222222-2222-2222-2222-222222222222',
    '11110001-0000-0000-0000-000000000000', 'rechazar', null),
  'rechazada', 'rechazar una invitación devuelve el estado rechazada');
select is(
  (select estado::text from public.invitaciones where id = '11110001-0000-0000-0000-000000000000'),
  'rechazada', 'la invitación rechazada queda en estado rechazada');
select is(
  (select estado::text from public.bar where id = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1'),
  'disponible', 'rechazo devuelve la bebida a disponible');

-- ============================================================================
-- RECHAZO de una `solicitud` (sin bebida) no falla y no toca ninguna bebida.
-- ============================================================================
select is(
  public.responder_invitacion(
    '11111111-1111-1111-1111-111111111111',
    '22220003-0000-0000-0000-000000000000', 'rechazar', null),
  'rechazada', 'rechazar una solicitud sin bebida no falla');
select is(
  (select estado::text from public.invitaciones where id = '22220003-0000-0000-0000-000000000000'),
  'rechazada', 'la solicitud rechazada queda en estado rechazada');

-- ============================================================================
-- ACEPTAR una `invitacion`: crea la cita; no pide ni toca bebida adicional.
-- ============================================================================
select is(
  public.responder_invitacion(
    '22222222-2222-2222-2222-222222222222',
    '11110002-0000-0000-0000-000000000000', 'aceptar', null),
  'aceptada', 'aceptar una invitación devuelve el estado aceptada');
select is(
  (select estado::text from public.invitaciones where id = '11110002-0000-0000-0000-000000000000'),
  'aceptada', 'la invitación aceptada queda en estado aceptada');
select is(
  (select estado::text from public.bar where id = 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2'),
  'bloqueada', 'aceptar una invitación no toca su bebida ya bloqueada');
select is(
  (select count(*) from public.citas where invitacion_id = '11110002-0000-0000-0000-000000000000')::int,
  1, 'aceptar una invitación crea exactamente una cita');

-- ============================================================================
-- ACEPTAR una `solicitud`: el receptor-rentador asigna y bloquea su bebida; cita.
-- ============================================================================
select is(
  public.responder_invitacion(
    '11111111-1111-1111-1111-111111111111',
    '22220001-0000-0000-0000-000000000000', 'aceptar', 'b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3'),
  'aceptada', 'aceptar una solicitud con bebida propia devuelve aceptada');
select is(
  (select estado::text from public.bar where id = 'b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3'),
  'bloqueada', 'aceptar una solicitud bloquea la bebida asignada por el receptor');
select is(
  (select bebida_bar_id from public.invitaciones where id = '22220001-0000-0000-0000-000000000000'),
  'b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3'::uuid, 'la solicitud aceptada guarda la bebida asignada');
select is(
  (select count(*) from public.citas where invitacion_id = '22220001-0000-0000-0000-000000000000')::int,
  1, 'aceptar una solicitud crea exactamente una cita');

-- ============================================================================
-- Tras aceptar, la cita la ven SOLO las dos partes (test del plan: "aceptar
-- habilita chat solo a las dos partes"). Se prueba vía la RLS de `citas`, que
-- gobierna también quién puede insertar en `chat_mensajes` (4.0). Se usa la cita
-- de INV2 (aceptada arriba): emisor Ana y receptor Beto; Dani es tercero.
-- ============================================================================
set local role authenticated;

select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
select is(
  (select count(*) from public.citas where invitacion_id = '11110002-0000-0000-0000-000000000000')::int,
  1, 'el emisor (parte) ve la cita');

select set_config('request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
select is(
  (select count(*) from public.citas where invitacion_id = '11110002-0000-0000-0000-000000000000')::int,
  1, 'el receptor (parte) ve la cita');

select set_config('request.jwt.claims',
  json_build_object('sub', '44444444-4444-4444-4444-444444444444', 'role', 'authenticated')::text, true);
select is(
  (select count(*) from public.citas where invitacion_id = '11110002-0000-0000-0000-000000000000')::int,
  0, 'un tercero ajeno NO ve la cita');

select set_config('request.jwt.claims', null, true);
reset role;

-- ============================================================================
-- Solo el receptor responde: el emisor NO puede responder su propia invitación.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '11110009-0000-0000-0000-000000000000', 'rechazar', null) $$,
  'AY403', null, 'el emisor no puede responder su propia invitación');

-- ============================================================================
-- KYC solo gatea ACEPTAR, no RECHAZAR. Un receptor no verificado (Elmo) PUEDE
-- rechazar una invitación (y su bebida se libera igual), porque rechazar no
-- compromete escrow; si el gate lo bloqueara, la bebida del emisor quedaría
-- `bloqueada` para siempre sin camino de liberación. Pero NO puede aceptar.
-- ============================================================================
-- Rechazar sin verificar: OK, y libera la bebida (era una `invitacion` con bebida).
select is(
  public.responder_invitacion(
    '55555555-5555-5555-5555-555555555555',
    '11110005-0000-0000-0000-000000000000', 'rechazar', null),
  'rechazada', 'un receptor no verificado (KYC) SÍ puede rechazar');
select is(
  (select estado::text from public.bar where id = 'b5b5b5b5-b5b5-b5b5-b5b5-b5b5b5b5b5b5'),
  'disponible', 'rechazar sin verificar igual libera la bebida del emisor');
-- Aceptar sin verificar: sigue bloqueado con AY403 (aceptar compromete escrow).
select throws_ok(
  $$ select public.responder_invitacion(
       '55555555-5555-5555-5555-555555555555',
       '11110010-0000-0000-0000-000000000000', 'aceptar', null) $$,
  'AY403', null, 'un receptor no verificado (KYC) NO puede aceptar');

-- ============================================================================
-- Idempotente-benigno: responder una invitación ya resuelta devuelve
-- 'ya_resuelta' sin un segundo efecto (no crea una segunda cita).
-- ============================================================================
select is(
  public.responder_invitacion(
    '22222222-2222-2222-2222-222222222222',
    '11110006-0000-0000-0000-000000000000', 'aceptar', null),
  'aceptada', 'primera aceptación de INV_YARES aplica');
select is(
  public.responder_invitacion(
    '22222222-2222-2222-2222-222222222222',
    '11110006-0000-0000-0000-000000000000', 'aceptar', null),
  'ya_resuelta', 'responder de nuevo una invitación ya resuelta es benigno');
select is(
  (select count(*) from public.citas where invitacion_id = '11110006-0000-0000-0000-000000000000')::int,
  1, 'una invitación ya resuelta no crea una segunda cita');

-- ============================================================================
-- Bebida de OTRO bar al aceptar una solicitud → conflicto.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22220002-0000-0000-0000-000000000000', 'aceptar', 'b4b4b4b4-b4b4-b4b4-b4b4-b4b4b4b4b4b4') $$,
  'AY409', null, 'no se puede aceptar una solicitud con una bebida que no es de tu bar');

-- ============================================================================
-- Aceptar una solicitud SIN asignar bebida → forma inválida.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion(
       '11111111-1111-1111-1111-111111111111',
       '22220004-0000-0000-0000-000000000000', 'aceptar', null) $$,
  'AY400', null, 'aceptar una solicitud exige asignar una bebida');

-- ============================================================================
-- Aceptar una `invitacion` mandando bebida (ya tiene la suya) → forma inválida.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion(
       '22222222-2222-2222-2222-222222222222',
       '11110007-0000-0000-0000-000000000000', 'aceptar', 'b4b4b4b4-b4b4-b4b4-b4b4-b4b4b4b4b4b4') $$,
  'AY400', null, 'aceptar una invitación no admite mandar otra bebida');

-- ============================================================================
-- Rechazar mandando bebida (rechazar no toma bebida) → forma inválida.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion(
       '22222222-2222-2222-2222-222222222222',
       '11110008-0000-0000-0000-000000000000', 'rechazar', 'b4b4b4b4-b4b4-b4b4-b4b4-b4b4b4b4b4b4') $$,
  'AY400', null, 'rechazar no admite mandar una bebida');

-- ============================================================================
-- Invitación inexistente → no encontrada.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion(
       '22222222-2222-2222-2222-222222222222',
       '00000000-0000-0000-0000-0000000000ff', 'rechazar', null) $$,
  'AY404', null, 'responder una invitación inexistente falla como no encontrada');

-- ============================================================================
-- Acción inválida (ni aceptar ni rechazar) → forma inválida.
-- ============================================================================
select throws_ok(
  $$ select public.responder_invitacion(
       '22222222-2222-2222-2222-222222222222',
       '11110007-0000-0000-0000-000000000000', 'saltar', null) $$,
  'AY400', null, 'una acción que no es aceptar ni rechazar es inválida');

-- ============================================================================
-- El cliente no puede ejecutar la función directamente (es del service_role).
-- ============================================================================
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
set local role authenticated;
select throws_ok(
  $$ select public.responder_invitacion(
       '22222222-2222-2222-2222-222222222222',
       '11110007-0000-0000-0000-000000000000', 'rechazar', null) $$,
  '42501', null, 'un cliente autenticado NO puede ejecutar responder_invitacion');
reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
