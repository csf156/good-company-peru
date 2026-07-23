-- pgTAP: función atómica confirmar_orden_pago (Fase 3.1).
-- Es el único camino que mueve una compra a escrow: escribe el ledger
-- (compra/fee/escrow_lock) y la bebida al bar, o marca la orden fallida sin
-- crear nada. Requisitos críticos del plan:
--   * doble confirmación (webhook duplicado) NO duplica la bebida ni el ledger;
--   * un pago fallido NO crea stock;
--   * el cliente no puede ejecutar la función (auto-confirmarse sin cobro).
select plan(15);

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

-- Orden a confirmar y orden a fallar (sembradas como postgres = service_role).
insert into public.ordenes_pago
  (id, perfil_id, bebida_catalogo_id, valor_v, buyer_fee, total, estado, provider)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999999', 40.00, 6.00, 46.00, 'pendiente', 'mock'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999999', 40.00, 6.00, 46.00, 'pendiente', 'mock');

-- --- confirmar la orden A ---
select is(
  public.confirmar_orden_pago('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'confirmada', 'escrow-xyz'),
  'aplicada', 'confirmar una orden pendiente devuelve aplicada');

select is(
  (select count(*) from public.ledger
    where referencia_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::int,
  3, 'la confirmación escribe 3 filas de ledger');

select is(
  (select monto from public.ledger
    where referencia_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and tipo = 'compra'),
  46.00::numeric, 'fila compra = +total (46)');
select is(
  (select monto from public.ledger
    where referencia_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and tipo = 'fee'),
  -6.00::numeric, 'fila fee = −buyer_fee (−6)');
select is(
  (select monto from public.ledger
    where referencia_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and tipo = 'escrow_lock'),
  -40.00::numeric, 'fila escrow_lock = −V (−40)');

-- Comprar no da saldo disponible: las 3 filas netean a 0.
select is(
  (select sum(monto) from public.ledger
    where perfil_id = '11111111-1111-1111-1111-111111111111'),
  0.00::numeric, 'la compra netea a 0 en el balance del rentador (dinero en escrow, no en wallet)');

select is(
  (select count(*) from public.bar
    where perfil_id = '11111111-1111-1111-1111-111111111111'
      and estado = 'disponible' and escrow_ref = 'escrow-xyz')::int,
  1, 'la bebida entra al bar como disponible con su escrow_ref');

select is(
  (select estado::text from public.ordenes_pago
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'confirmada', 'la orden queda confirmada');

-- --- doble confirmación: idempotente, no duplica ---
select is(
  public.confirmar_orden_pago('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'confirmada', 'escrow-xyz'),
  'ya_resuelta', 'una segunda confirmación de la misma orden devuelve ya_resuelta');

select is(
  (select count(*) from public.ledger
    where referencia_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::int,
  3, 'el webhook duplicado NO duplica las filas de ledger');
select is(
  (select count(*) from public.bar
    where perfil_id = '11111111-1111-1111-1111-111111111111')::int,
  1, 'el webhook duplicado NO duplica la bebida en el bar');

-- --- pago fallido: no crea stock ---
select is(
  public.confirmar_orden_pago('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'fallida', null),
  'aplicada', 'marcar una orden como fallida devuelve aplicada');
select is(
  (select count(*) from public.ledger
    where referencia_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::int,
  0, 'un pago fallido NO escribe ledger');
select is(
  (select count(*) from public.bar
    where perfil_id = '11111111-1111-1111-1111-111111111111')::int,
  1, 'un pago fallido NO agrega bebida al bar (sigue en 1, la de la orden A)');

-- --- el cliente no puede ejecutar la función (auto-confirmarse sin cobro) ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;
select throws_ok(
  $$ select public.confirmar_orden_pago('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'confirmada', 'x') $$,
  '42501', null, 'un cliente autenticado NO puede ejecutar confirmar_orden_pago');
reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
