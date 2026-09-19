-- pgTAP: schema + aislamiento RLS de `invitaciones` — Fase 4.0.
-- Una invitación (rentador→amigo) o solicitud (amigo→rentador) la ven SOLO sus
-- dos partes (emisor / receptor). La creación y las transiciones de estado son
-- exclusivas del service_role (Edge Functions `crear-invitacion` / `responder-
-- invitacion`, fases 4.2/4.3): el cliente jamás inserta ni muta una invitación.
select plan(23);

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

-- Ana (rentador) invita a Beto (amigo) con una bebida del catálogo — E.1 quitó
-- el bar: la bebida ya no se bloquea de un stock, es un atributo directo de
-- la invitación (bebida_catalogo_id).
insert into public.invitaciones
  (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id,
   tiempo_estimado_min, zona_aproximada, estado)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999',
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

-- El cliente tampoco borra (misma revocación que insert/update, migración
-- 20260723180000, nunca antes probada — hueco encontrado al arreglar el
-- runner de pgTAP para que valide `plan(N)` contra lo ejecutado: este
-- archivo declaraba plan(9) con solo 8 asserts desde el commit original
-- de la Fase 4.0, 927ccc1).
select throws_ok(
  $$ delete from public.invitaciones
     where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  '42501', null, 'Ana NO puede borrar su invitación');

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

-- --- Tarea 2b: la visibilidad depende del estado, no solo de identidad ---
-- Segunda invitación, en preautorizando — mientras la preautorización no
-- responde, no existe todavía para el amigo (si el hold falla, nunca existió).
insert into public.invitaciones
  (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id,
   tiempo_estimado_min, zona_aproximada, estado)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999',
   60, 'Miraflores', 'preautorizando');

-- --- impersonar a Beto (receptor) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.invitaciones
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  0, 'Beto (receptor) NO ve la invitación mientras está en preautorizando');

-- --- impersonar a Ana (emisor) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.invitaciones
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  1, 'Ana (emisor) SÍ ve su invitación en preautorizando — es suya y está en curso');

-- La preautorización respondió (postgres, simula al service_role): la
-- invitación pasa a pendiente — ahora sí visible para el receptor. La lista
-- blanca no debe romper el camino normal.
reset role;
select set_config('request.jwt.claims', null, true);
update public.invitaciones set estado = 'pendiente'
 where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.invitaciones
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  1, 'Beto (receptor) SÍ ve la invitación una vez en pendiente');

reset role;
select set_config('request.jwt.claims', null, true);

-- --- F.1 Tarea 3: visibilidad de los estados de la propuesta negociada ---
-- La lista blanca de E.2a hace que todo estado nuevo nazca invisible para
-- quien recibe (spec §5.1). Se abre a propósito para los cuatro que son parte
-- de una conversación entre las dos partes — `contrapropuesta`,
-- `contrapropuesta_rechazada`, `retirada`, `concluida` — y `preautorizando`
-- sigue oculto para el receptor.
--
-- Fixtures propios (ids exclusivos de este bloque, como postgres: simula al
-- service_role y bypassa RLS). Usuarios nuevos en lugar de Ana/Beto/Carla:
-- la Tarea 5 creará un índice único de UNA relación activa por par (sin
-- ordenar) que ignora `rechazada`, `expirada`, `retirada` y `concluida`, pero
-- NO `contrapropuesta`, `contrapropuesta_rechazada` ni `preautorizando`. Por
-- eso esas tres filas van en pares distintos (d1→d2, d1→d3, d1→d4, ninguno
-- es el par Ana↔Beto que ya ocupan los fixtures de arriba). `retirada` y
-- `concluida` sí pueden compartir par con una activa porque el índice las
-- ignora. Carla (33333333…) hace de ajena: no es parte de ninguna fila nueva.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000',
   'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'authenticated', 'authenticated',
   'dora.f13@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'authenticated', 'authenticated',
   'dario.f13@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', 'authenticated', 'authenticated',
   'diana.f13@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', 'authenticated', 'authenticated',
   'dino.f13@test.dev', '', now(), now(), now(), '', '', '', '');

insert into public.profiles (id, rol, alias)
values
  ('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'rentador', 'F13Dora'),
  ('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'amigo', 'F13Dario'),
  ('d3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', 'amigo', 'F13Diana'),
  ('d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', 'amigo', 'F13Dino');

-- Dora (d1, quien propone) → Dario (d2), Diana (d3), Dino (d4).
insert into public.invitaciones
  (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id,
   tiempo_estimado_min, zona_aproximada, estado, contra_tiempo_estimado_min)
values
  -- contrapropuesta: Dario contrapropuso un tiempo distinto (60 → 90).
  ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
   'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1',
   'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2',
   'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999',
   60, 'Miraflores', 'contrapropuesta', 90),
  -- contrapropuesta_rechazada: par propio (d1→d3), el índice de la Tarea 5 no
  -- la ignora.
  ('e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2',
   'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1',
   'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3',
   'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999',
   60, 'Miraflores', 'contrapropuesta_rechazada', null),
  -- retirada: terminal, comparte par con la contrapropuesta (d1→d2).
  ('e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3',
   'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1',
   'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2',
   'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999',
   60, 'Miraflores', 'retirada', null),
  -- concluida: terminal, comparte par con la contrapropuesta_rechazada (d1→d3).
  ('e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4',
   'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1',
   'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3',
   'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999',
   60, 'Miraflores', 'concluida', null),
  -- preautorizando: par propio (d1→d4); debe seguir oculta para Dino.
  ('e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5',
   'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1',
   'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4',
   'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999',
   60, 'Miraflores', 'preautorizando', null);

-- --- impersonar a Dario (d2, receptor de la contrapropuesta y de la retirada) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.invitaciones
    where id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1')::int,
  1, 'el receptor SÍ ve una invitación en contrapropuesta');

select is(
  (select count(*) from public.invitaciones
    where id = 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3')::int,
  1, 'el receptor SÍ ve una invitación en retirada');

-- --- impersonar a Diana (d3, receptora de la contrapropuesta_rechazada y de la concluida) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.invitaciones
    where id = 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2')::int,
  1, 'el receptor SÍ ve una invitación en contrapropuesta_rechazada');

select is(
  (select count(*) from public.invitaciones
    where id = 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4')::int,
  1, 'el receptor SÍ ve una invitación en concluida');

-- --- impersonar a Dino (d4, receptor de la preautorizando) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', 'role', 'authenticated')::text,
  true);
set local role authenticated;

-- Regresión: abrir los cuatro estados nuevos no abre `preautorizando`.
select is(
  (select count(*) from public.invitaciones
    where id = 'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5')::int,
  0, 'el receptor sigue SIN ver una invitación en preautorizando');

-- --- impersonar a Dora (d1, emisora de las cinco) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.invitaciones
    where id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1')::int,
  1, 'el emisor ve su invitación en contrapropuesta');

select is(
  (select count(*) from public.invitaciones
    where id = 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2')::int,
  1, 'el emisor ve su invitación en contrapropuesta_rechazada');

select is(
  (select count(*) from public.invitaciones
    where id = 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3')::int,
  1, 'el emisor ve su invitación en retirada');

select is(
  (select count(*) from public.invitaciones
    where id = 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4')::int,
  1, 'el emisor ve su invitación en concluida');

-- --- impersonar a Carla (33333333…, ajena a las cinco filas) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.invitaciones
    where id in ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
                 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2',
                 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3',
                 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4'))::int,
  0, 'una ajena NO ve ninguna de las cuatro en los estados nuevos');

reset role;
select set_config('request.jwt.claims', null, true);

-- Guarda estructural: la política sigue siendo una LISTA BLANCA con
-- exactamente estas ocho etiquetas. Hoy (con los nueve valores del enum) una
-- lista blanca de ocho y una lista negra de `preautorizando` se comportan
-- igual, así que ninguna aserción de comportamiento distingue una de la otra;
-- solo dejan de ser equivalentes con el primer valor nuevo del enum. Por eso
-- se fijan las etiquetas literales de la política: una lista negra
-- (`estado <> 'preautorizando'`, `not in (…)`) extraería solo
-- 'preautorizando' (o nada) y esta aserción fallaría. Si un valor futuro del
-- enum debe abrirse al receptor, este arreglo se actualiza a propósito junto
-- con la política.
select is(
  (select array_agg(lbl[1] order by lbl[1] collate "C")
     from pg_policy p,
          regexp_matches(pg_get_expr(p.polqual, p.polrelid),
                         '''([a-z_]+)''::estado_invitacion', 'g') as lbl
    where p.polrelid = 'public.invitaciones'::regclass
      and p.polname = 'invitaciones_select_parte'),
  array['aceptada', 'concluida', 'contrapropuesta',
        'contrapropuesta_rechazada', 'expirada', 'pendiente',
        'rechazada', 'retirada'],
  'la política del receptor es una lista blanca de exactamente 8 estados (sin preautorizando)');

select * from finish();
