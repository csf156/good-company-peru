-- pgTAP: función de conciliación del sub-proyecto 3 (Fase 3.4).
-- detectar_discrepancias_sp3() recorre las invariantes de dinero y devuelve una
-- fila por cada rotura detectada (vacío = todo cuadra). Es el job que ops/cron
-- corre para atrapar estados imposibles (orden confirmada sin su ledger, ledger
-- de compra que no netea a 0, orden no-confirmada con movimientos, desbalance
-- escrow↔bar).
select plan(6);

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'ana@test.dev', '', now(), now(), now(), '', '', '', '');

insert into public.profiles (id, rol, alias)
values ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias');

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v)
values ('99999999-9999-9999-9999-999999999999', 'Cerveza', 'divertida', 40.00);

insert into public.ordenes_pago
  (id, perfil_id, bebida_catalogo_id, valor_v, buyer_fee, total, estado, provider)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999999', 40.00, 6.00, 46.00, 'pendiente', 'mock'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999999', 40.00, 6.00, 46.00, 'pendiente', 'mock');

-- Confirmar ambas por el camino sancionado → estado íntegro.
select public.confirmar_orden_pago('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'confirmada', 'e-a');
select public.confirmar_orden_pago('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'confirmada', 'e-b');

-- --- estado limpio: 0 discrepancias ---
select is(
  (select count(*) from public.detectar_discrepancias_sp3())::int,
  0, 'un estado construido solo por confirmar_orden_pago no tiene discrepancias');

-- --- inyectar una compra huérfana (ledger incompleto que no netea) ---
-- Simula un bug/escritura fuera de banda: una fila `compra` suelta sin su fee
-- ni escrow_lock. Referencia_id nuevo, no atado a ninguna orden.
insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
values ('11111111-1111-1111-1111-111111111111', 'compra', 46.00,
        'cccccccc-cccc-cccc-cccc-cccccccccccc', 'huerfana:compra');

select isnt(
  (select count(*) from public.detectar_discrepancias_sp3())::int,
  0, 'una compra huérfana en el ledger es detectada como discrepancia');

select is(
  (select count(*) from public.detectar_discrepancias_sp3()
    where clase = 'compra_no_netea_a_cero'
      and referencia = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  1, 'la compra huérfana se reporta como compra_no_netea_a_cero con su referencia');

-- --- orden fallida que sin embargo tiene ledger (imposible por diseño) ---
insert into public.ordenes_pago
  (id, perfil_id, bebida_catalogo_id, valor_v, buyer_fee, total, estado, provider)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999999', 40.00, 6.00, 46.00, 'fallida', 'mock');
insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
values ('11111111-1111-1111-1111-111111111111', 'compra', 46.00,
        'dddddddd-dddd-dddd-dddd-dddddddddddd', 'fallida:compra');

select is(
  (select count(*) from public.detectar_discrepancias_sp3()
    where clase = 'orden_no_confirmada_con_ledger'
      and referencia = 'dddddddd-dddd-dddd-dddd-dddddddddddd')::int,
  1, 'una orden fallida con filas de ledger es detectada');

-- --- el cliente no puede correr la conciliación (expone montos/discrepancias) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;
select throws_ok(
  $$ select * from public.detectar_discrepancias_sp3() $$,
  '42501', null, 'un cliente autenticado NO puede correr la conciliación');
reset role;
select set_config('request.jwt.claims', null, true);

-- Sanidad final: el estado íntegro original sigue detectándose aparte del ruido inyectado.
select ok(
  (select count(*) from public.detectar_discrepancias_sp3()) >= 2,
  'las discrepancias inyectadas se acumulan (compra huérfana + orden fallida)');

select * from finish();
