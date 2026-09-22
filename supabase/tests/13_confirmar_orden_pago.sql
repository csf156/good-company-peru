-- pgTAP: función atómica capturar_orden (Fase E.2a) — reemplaza a
-- confirmar_orden_pago (Fase 3.1). Mismo patrón de atomicidad (row lock, CAS
-- de estado, idempotencia), pero sobre el ciclo hold: preautorizada →
-- capturada | anulada, sin `bar`. El ledger escribe la MISMA terna
-- compra/fee/escrow_lock que la función vieja (spec §4), pero referenciando
-- la invitación, no la orden — la invitación es la compra.
select plan(22);

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
  -- F.1 Tarea 5 (hallazgo tardío, durante la validación con la migración
  -- aplicada — no se detectó en la medición inicial de la Tarea 5): las 5
  -- invitaciones de abajo nacían TODAS en (Ana, Beto), las 5 'preautorizando'
  -- (no-terminal) a la vez, en un solo INSERT — el índice único por par
  -- (spec §6) las rechaza. Cada una (salvo la primera) pasa a un par propio.
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'carla.f13t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'dani.f13t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated',
   'ely.f13t5@test.dev', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated',
   'fabi.f13t5@test.dev', '', now(), now(), now(), '', '', '', '');

insert into public.profiles (id, rol, alias)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias'),
  ('22222222-2222-2222-2222-222222222222', 'amigo', 'BetoAlias'),
  ('33333333-3333-3333-3333-333333333333', 'amigo', 'CarlaAlias'),
  ('44444444-4444-4444-4444-444444444444', 'amigo', 'DaniAlias'),
  ('55555555-5555-5555-5555-555555555555', 'amigo', 'ElyAlias'),
  ('66666666-6666-6666-6666-666666666666', 'amigo', 'FabiAlias');

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v)
values ('99999999-9999-9999-9999-999999999999', 'Cerveza', 'divertida', 40.00);

-- Cinco invitaciones, una por orden — el índice único parcial de E.1 permite
-- solo UNA orden "viva" (preautorizada/capturada) por invitación, así que
-- cada estado de partida necesita la suya. F.1 Tarea 5: cada una con su
-- propio receptor para no chocar con el índice de una relación activa por
-- par (ninguna aserción de este archivo depende de que compartan receptor:
-- todas se identifican por su propio id de invitación/orden, no por RLS de
-- una identidad concreta).
insert into public.invitaciones
  (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id,
   tiempo_estimado_min, zona_aproximada, estado)
select v.id, '11111111-1111-1111-1111-111111111111', v.receptor_id,
       'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 60, 'Miraflores', 'preautorizando'
from (values
  ('a0000000-0000-0000-0000-00000000000a'::uuid, '22222222-2222-2222-2222-222222222222'::uuid),
  ('a0000000-0000-0000-0000-00000000000b'::uuid, '33333333-3333-3333-3333-333333333333'::uuid),
  ('a0000000-0000-0000-0000-00000000000c'::uuid, '44444444-4444-4444-4444-444444444444'::uuid),
  ('a0000000-0000-0000-0000-00000000000d'::uuid, '55555555-5555-5555-5555-555555555555'::uuid),
  ('a0000000-0000-0000-0000-00000000000e'::uuid, '66666666-6666-6666-6666-666666666666'::uuid)
) as v(id, receptor_id);

-- Órdenes: A preautorizada (a capturar), B preautorizada (a anular),
-- C ya anulada, D pendiente (sin hold), E ya capturada.
insert into public.ordenes_pago
  (id, perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-00000000000a', 40.00, 6.00, 46.00, 'preautorizada', 'mock'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-00000000000b', 40.00, 6.00, 46.00, 'preautorizada', 'mock'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-00000000000c', 40.00, 6.00, 46.00, 'anulada', 'mock'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-00000000000d', 40.00, 6.00, 46.00, 'pendiente', 'mock'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-00000000000e', 40.00, 6.00, 46.00, 'capturada', 'mock');

-- --- 1. capturar una orden preautorizada la deja capturada ---
select is(
  public.capturar_orden('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'capturada', 'hold-xyz'),
  'aplicada', 'capturar una orden preautorizada devuelve aplicada');

select is(
  (select estado::text from public.ordenes_pago where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'capturada', 'la orden queda capturada');

-- --- 2. escribe exactamente 3 filas de ledger ---
select is(
  (select count(*) from public.ledger
    where referencia_id = 'a0000000-0000-0000-0000-00000000000a'::uuid)::int,
  3, 'la captura escribe 3 filas de ledger');

select is(
  (select monto from public.ledger
    where referencia_id = 'a0000000-0000-0000-0000-00000000000a'::uuid and tipo = 'compra'),
  46.00::numeric, 'fila compra = +total (46)');
select is(
  (select monto from public.ledger
    where referencia_id = 'a0000000-0000-0000-0000-00000000000a'::uuid and tipo = 'fee'),
  -6.00::numeric, 'fila fee = −buyer_fee (−6)');
select is(
  (select monto from public.ledger
    where referencia_id = 'a0000000-0000-0000-0000-00000000000a'::uuid and tipo = 'escrow_lock'),
  -40.00::numeric, 'fila escrow_lock = −valor_v (−40)');

-- --- 3. las tres netean a cero ---
select is(
  (select sum(monto) from public.ledger
    where referencia_id = 'a0000000-0000-0000-0000-00000000000a'::uuid),
  0.00::numeric, 'las 3 filas netean a 0 — capturar no da saldo disponible a nadie');

-- --- 4. referencia_id apunta a la invitación, no a la orden ---
select is(
  (select count(distinct referencia_id) from public.ledger
    where referencia_id = 'a0000000-0000-0000-0000-00000000000a'::uuid)::int,
  1, 'referencia_id de las 3 filas es la invitación (no la orden)');

-- --- 5. no crea nada fuera de ledger/ordenes_pago (no hay stock) ---
-- Escopado a la invitación del fixture, no a la tabla entera (BRAIN, code-
-- review de la Tarea 4b de E.2b): antes contaba `citas` global y solo pasaba
-- porque la tabla estaba vacía — en cuanto seed-demo.mjs revivió la siembra
-- de citas (E.2b Tarea 6), este assert se caía aunque capturar_orden siguiera
-- sin crear ninguna. Mismo defecto, mismo arreglo que la conciliación (14):
-- filtrar por referencia concreta, no por conteo global de tabla.
select is(
  (select count(*) from public.citas
    where invitacion_id = 'a0000000-0000-0000-0000-00000000000a')::int,
  0, 'capturar_orden no crea ninguna fila en citas ni en ninguna tabla de stock');

-- --- 6/7. segunda llamada: idempotente, ve el estado ya resuelto ---
select is(
  public.capturar_orden('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'capturada', 'hold-xyz'),
  'ya_resuelta', 'una segunda captura de la misma orden devuelve ya_resuelta (mismo row lock que serializaría llamadas concurrentes)');

select is(
  (select count(*) from public.ledger
    where referencia_id = 'a0000000-0000-0000-0000-00000000000a'::uuid)::int,
  3, 'la segunda captura NO duplica el ledger');

-- --- 8. capturar una orden ya anulada falla ---
select throws_ok(
  $$ select public.capturar_orden('cccccccc-cccc-cccc-cccc-cccccccccccc', 'capturada', null) $$,
  'P0001', null, 'capturar una orden ya anulada falla (no se resucita un hold liberado)');

-- --- 9. capturar una orden en pendiente (sin hold) falla ---
select throws_ok(
  $$ select public.capturar_orden('dddddddd-dddd-dddd-dddd-dddddddddddd', 'capturada', null) $$,
  'P0001', null, 'capturar una orden sin hold (pendiente) falla');

-- --- 10. p_resultado fuera del set válido lanza excepción ---
select throws_ok(
  $$ select public.capturar_orden('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pendiente', null) $$,
  'P0001', null, 'p_resultado fuera de (capturada, anulada, fallida) lanza excepción');

-- --- 11/12. el cliente no puede ejecutar la función ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;
select throws_ok(
  $$ select public.capturar_orden('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'capturada', null) $$,
  '42501', null, 'un cliente autenticado NO puede ejecutar capturar_orden');
reset role;
select set_config('request.jwt.claims', null, true);

set local role anon;
select throws_ok(
  $$ select public.capturar_orden('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'capturada', null) $$,
  '42501', null, 'anon tampoco puede ejecutar capturar_orden');
reset role;

-- --- 13. los montos salen de la orden persistida, no de parámetros ---
-- (la firma no acepta monto: si el ledger coincide con ordenes_pago, no hay
-- forma de que un llamador haya inyectado otro importe)
select is(
  (select l.monto from public.ledger l where l.referencia_id = 'a0000000-0000-0000-0000-00000000000a'::uuid and l.tipo = 'compra'),
  (select o.total from public.ordenes_pago o where o.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'el monto de compra en el ledger coincide con el total persistido en la orden');

-- --- 14. anular una orden preautorizada la deja anulada, sin ledger ---
select is(
  public.capturar_orden('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'anulada', null),
  'aplicada', 'anular una orden preautorizada devuelve aplicada');
select is(
  (select estado::text from public.ordenes_pago where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'anulada', 'la orden queda anulada');
select is(
  (select count(*) from public.ledger
    where referencia_id = 'a0000000-0000-0000-0000-00000000000b'::uuid)::int,
  0, 'anular NO escribe ledger — un hold no es un movimiento');

-- --- 15. anular una orden ya capturada falla ---
select throws_ok(
  $$ select public.capturar_orden('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'anulada', null) $$,
  'P0001', null, 'anular una orden ya capturada falla (no se libera un cobro ya hecho)');

-- --- 16. orden inexistente falla como no encontrada (AY404, no genérico) ---
-- E.2b Tarea 4b: antes salía sin errcode propio (P0001) — el único diferenciador
-- era el TEXTO del mensaje ('orden no encontrada: %'), del que dependía
-- pago-webhook para distinguir 404 (no reintentar) de 500 (sí reintentar). Un
-- futuro retoque de redacción rompería esa lectura en silencio, sin que
-- ningún test lo notara (BRAIN, revisando la Tarea 4). Mismo criterio AY4xx
-- que crear_invitacion/responder_invitacion/confirmar_cita/
-- confirmar_preautorizacion.
select throws_ok(
  $$ select public.capturar_orden('ffffffff-ffff-ffff-ffff-ffffffffffff', 'capturada', null) $$,
  'AY404', null, 'capturar una orden inexistente falla con AY404, no con un error genérico');

select * from finish();
