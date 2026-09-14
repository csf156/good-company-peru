-- pgTAP: detectar_discrepancias_sp3 (Fase E.2a, Tarea 5) — la conciliación
-- redefinida. Comparaba el ledger contra el stock del bar (invariante 4,
-- muerta); sin bar, esa pregunta ya no significa nada. Se reemplaza por
-- cuatro invariantes que el modelo hold→captura SÍ puede violar.
--
-- Las invariantes 1/2/6/7 (sobrevivientes de 20260723160000, adaptadas)
-- atribuyen el ledger a SU ORDEN por `idempotency_key like '<orden_id>:%'`,
-- no por `referencia_id = invitacion_id`. Un join por invitación tenía un
-- falso positivo real: una invitación puede tener VARIAS órdenes en el
-- tiempo (el índice único parcial solo bloquea las vivas; fallida/anulada
-- se acumulan — es el camino de reintento de la Tarea 3b). Si la orden A de
-- una invitación queda fallida y el rentador reintenta con la orden B que sí
-- se captura, un join por invitación le atribuye a A el ledger de B. Probado
-- explícito más abajo, no solo corregido de oídas.
select plan(11);

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'ana@test.dev', '', now(), now(), now(), '', '', '', '');

insert into public.profiles (id, rol, alias, kyc_estado)
values ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias', 'verificado');

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v)
values ('99999999-9999-9999-9999-999999999999', 'Pisco Sour', 'divertida', 30.00);

-- ============================================================================
-- SANO: una invitación con su orden capturada y ledger correcto, atribuido
-- por idempotency_key igual que capturar_orden (Tarea 2) lo escribe de
-- verdad: `<orden_id>:compra` / `:fee` / `:escrow_lock`. Se comprueba cero
-- discrepancias ANTES de fabricar nada roto — el ledger es append-only
-- (ni postgres puede DELETE/UPDATE), así que no hay forma de deshacer un
-- fixture: cada escenario usa su propia invitación/orden/ledger desde cero.
-- ============================================================================
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id, estado)
values ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'aceptada');
insert into public.ordenes_pago (id, perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values ('b0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', 30.00, 4.50, 34.50, 'capturada', 'mock');
insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
values
  ('11111111-1111-1111-1111-111111111111', 'compra', 34.50, 'a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000a:compra'),
  ('11111111-1111-1111-1111-111111111111', 'fee', -4.50, 'a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000a:fee'),
  ('11111111-1111-1111-1111-111111111111', 'escrow_lock', -30.00, 'a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000a:escrow_lock');

select is(
  (select count(*)::int from public.detectar_discrepancias_sp3()),
  0, 'datos sanos: cero discrepancias');

-- ============================================================================
-- REINTENTO SANO (el falso positivo que se corrigió): invitación g, orden g1
-- fallida (sin ledger, tarjeta rechazada), reintento orden g2 capturada con
-- ledger correcto atribuido a SU PROPIO id. Un join por invitación le habría
-- atribuido el ledger de g2 a g1 y reportado "fallida pero con ledger".
-- ============================================================================
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id, estado)
values ('a0000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'aceptada');
insert into public.ordenes_pago (id, perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values
  ('b0000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000011', 30.00, 4.50, 34.50, 'fallida', 'mock'),
  ('b0000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000011', 30.00, 4.50, 34.50, 'capturada', 'mock');
insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
values
  ('11111111-1111-1111-1111-111111111111', 'compra', 34.50, 'a0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000013:compra'),
  ('11111111-1111-1111-1111-111111111111', 'fee', -4.50, 'a0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000013:fee'),
  ('11111111-1111-1111-1111-111111111111', 'escrow_lock', -30.00, 'a0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000013:escrow_lock');

select is(
  (select count(*)::int from public.detectar_discrepancias_sp3()
    where clase = 'orden_no_capturada_con_ledger' and referencia = 'b0000000-0000-0000-0000-000000000012'::uuid),
  0, 'la orden fallida del reintento NO carga el ledger de la orden capturada de la misma invitación');
select is(
  (select count(*)::int from public.detectar_discrepancias_sp3() where referencia = 'b0000000-0000-0000-0000-000000000013'::uuid),
  0, 'la orden capturada del reintento, con su propio ledger correcto, no reporta ninguna discrepancia');

-- ============================================================================
-- escrow_captura_desbalance + ledger_sin_orden: una fila de escrow_lock
-- cuya idempotency_key no corresponde a NINGUNA orden — el escenario que
-- ambas invariantes cazan a la vez (alguien escribiendo ledger a mano).
-- ============================================================================
insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
values ('11111111-1111-1111-1111-111111111111', 'escrow_lock', -99.00, null, 'sin-orden:escrow_suelto');

select is(
  (select count(*)::int from public.detectar_discrepancias_sp3() where clase = 'escrow_captura_desbalance'),
  1, 'escrow_lock sin orden capturada detrás rompe el balance global');
select is(
  (select count(*)::int from public.detectar_discrepancias_sp3() where clase = 'ledger_sin_orden'),
  1, 'ledger cuya idempotency_key no corresponde a ninguna orden es una discrepancia');

-- ============================================================================
-- hold_huerfano: una orden preautorizada cuya invitación ya se resolvió —
-- dinero retenido sin motivo. La discrepancia más cara para el usuario.
-- ============================================================================
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id, estado)
values ('a0000000-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'rechazada');
insert into public.ordenes_pago (id, perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values ('b0000000-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000d', 30.00, 4.50, 34.50, 'preautorizada', 'mock');

select is(
  (select count(*)::int from public.detectar_discrepancias_sp3() where clase = 'hold_huerfano'),
  1, 'orden preautorizada cuya invitación ya está rechazada es un hold huérfano');

-- ============================================================================
-- anulada_con_ledger: una orden anulada no debería tener NINGUNA fila de
-- ledger propia — sería un cobro por algo que se rechazó. Overlap legítimo
-- con orden_no_capturada_con_ledger (anulada también es "no capturada").
-- ============================================================================
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id, estado)
values ('a0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'rechazada');
insert into public.ordenes_pago (id, perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values ('b0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000b', 30.00, 4.50, 34.50, 'anulada', 'mock');
insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
values ('11111111-1111-1111-1111-111111111111', 'compra', 34.50, 'a0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b:compra');

select is(
  (select count(*)::int from public.detectar_discrepancias_sp3()
    where clase = 'anulada_con_ledger' and referencia = 'b0000000-0000-0000-0000-00000000000b'::uuid),
  1, 'una orden anulada con su propio ledger es una discrepancia — sería un cobro por algo rechazado');

-- ============================================================================
-- orden_no_capturada_con_ledger (limpio, sin el overlap de arriba): orden
-- preautorizada con ledger que no debería tener todavía.
-- ============================================================================
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id, estado)
values ('a0000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'pendiente');
insert into public.ordenes_pago (id, perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values ('b0000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000c', 30.00, 4.50, 34.50, 'preautorizada', 'mock');
insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
values ('11111111-1111-1111-1111-111111111111', 'compra', 34.50, 'a0000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-00000000000c:compra');

select is(
  (select count(*)::int from public.detectar_discrepancias_sp3()
    where clase = 'orden_no_capturada_con_ledger' and referencia = 'b0000000-0000-0000-0000-00000000000c'::uuid),
  1, 'una orden que no está capturada pero tiene su propio ledger es una discrepancia');

-- ============================================================================
-- orden_capturada_ledger_incompleto: capturada con solo 2 filas de ledger
-- propio (falta escrow_lock).
-- ============================================================================
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id, estado)
values ('a0000000-0000-0000-0000-00000000000e', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'aceptada');
insert into public.ordenes_pago (id, perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values ('b0000000-0000-0000-0000-00000000000e', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000e', 30.00, 4.50, 34.50, 'capturada', 'mock');
insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
values
  ('11111111-1111-1111-1111-111111111111', 'compra', 34.50, 'a0000000-0000-0000-0000-00000000000e', 'b0000000-0000-0000-0000-00000000000e:compra'),
  ('11111111-1111-1111-1111-111111111111', 'fee', -4.50, 'a0000000-0000-0000-0000-00000000000e', 'b0000000-0000-0000-0000-00000000000e:fee');

select is(
  (select count(*)::int from public.detectar_discrepancias_sp3()
    where clase = 'orden_capturada_ledger_incompleto' and referencia = 'b0000000-0000-0000-0000-00000000000e'::uuid),
  1, 'una orden capturada con solo 2 filas de ledger (falta escrow_lock) es una discrepancia');

-- ============================================================================
-- compra_no_netea_a_cero: ledger que no suma cero (40 - 10 - 25 = 5).
-- ============================================================================
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id, estado)
values ('a0000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'aceptada');
insert into public.ordenes_pago (id, perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values ('b0000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000f', 30.00, 4.50, 34.50, 'capturada', 'mock');
insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
values
  ('11111111-1111-1111-1111-111111111111', 'compra', 40.00, 'a0000000-0000-0000-0000-00000000000f', 'b0000000-0000-0000-0000-00000000000f:compra'),
  ('11111111-1111-1111-1111-111111111111', 'fee', -10.00, 'a0000000-0000-0000-0000-00000000000f', 'b0000000-0000-0000-0000-00000000000f:fee'),
  ('11111111-1111-1111-1111-111111111111', 'escrow_lock', -25.00, 'a0000000-0000-0000-0000-00000000000f', 'b0000000-0000-0000-0000-00000000000f:escrow_lock');

select is(
  (select count(*)::int from public.detectar_discrepancias_sp3()
    where clase = 'compra_no_netea_a_cero' and referencia = 'a0000000-0000-0000-0000-00000000000f'::uuid),
  1, 'un grupo de ledger que no suma cero es una discrepancia');

-- ============================================================================
-- ledger_monto_no_coincide_con_orden: balanceado (netea a 0) pero mal
-- preciado — lo que la invariante de arriba, sola, dejaría pasar.
-- ============================================================================
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id, estado)
values ('a0000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'invitacion', 'especifica', '99999999-9999-9999-9999-999999999999', 'aceptada');
insert into public.ordenes_pago (id, perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values ('b0000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000010', 30.00, 4.50, 34.50, 'capturada', 'mock');
insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
values
  ('11111111-1111-1111-1111-111111111111', 'compra', 40.00, 'a0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000010:compra'),
  ('11111111-1111-1111-1111-111111111111', 'fee', -10.00, 'a0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000010:fee'),
  ('11111111-1111-1111-1111-111111111111', 'escrow_lock', -30.00, 'a0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000010:escrow_lock');

select is(
  (select count(*)::int from public.detectar_discrepancias_sp3()
    where clase = 'ledger_monto_no_coincide_con_orden' and referencia = 'b0000000-0000-0000-0000-000000000010'::uuid),
  1, 'ledger balanceado pero con montos distintos a los congelados en la orden es una discrepancia');

select * from finish();
