-- pgTAP: tabla ordenes_pago (Fase 3.1) — estructura + aislamiento RLS.
-- La orden guarda los montos calculados SERVER-SIDE (valor_v, buyer_fee, total)
-- para que el webhook confirme usando esos montos, nunca los del payload. El
-- cliente solo LEE sus propias órdenes; la escritura es del service_role.
select plan(11);

-- Estructura
select has_table('public', 'ordenes_pago', 'existe tabla ordenes_pago');
select has_column('public', 'ordenes_pago', 'perfil_id', 'ordenes_pago tiene perfil_id');
select has_column('public', 'ordenes_pago', 'bebida_catalogo_id', 'ordenes_pago tiene bebida_catalogo_id');
select has_column('public', 'ordenes_pago', 'valor_v', 'ordenes_pago tiene valor_v');
select has_column('public', 'ordenes_pago', 'buyer_fee', 'ordenes_pago tiene buyer_fee');
select has_column('public', 'ordenes_pago', 'total', 'ordenes_pago tiene total');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'estado_orden'),
  array['pendiente', 'confirmada', 'fallida'],
  'estado_orden tiene los 3 estados'
);

select is(relrowsecurity, true, 'RLS habilitado en ordenes_pago')
  from pg_class where oid = 'public.ordenes_pago'::regclass;

-- Datos: dos rentadores + catálogo + una orden de cada uno (sembradas como postgres)
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
   'beto@test.dev', '', now(), now(), now(), '', '', '', '');

insert into public.profiles (id, rol, alias)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias'),
  ('22222222-2222-2222-2222-222222222222', 'rentador', 'BetoAlias');

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v)
values ('99999999-9999-9999-9999-999999999999', 'Cerveza', 'divertida', 40.00);

insert into public.ordenes_pago
  (perfil_id, bebida_catalogo_id, valor_v, buyer_fee, total, estado, provider)
values
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999',
   40.00, 6.00, 46.00, 'pendiente', 'mock'),
  ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999',
   40.00, 6.00, 46.00, 'pendiente', 'mock');

-- --- impersonar a Ana ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select is(
  (select count(*) from public.ordenes_pago
    where perfil_id = '11111111-1111-1111-1111-111111111111')::int,
  1, 'Ana ve su propia orden');

select is(
  (select count(*) from public.ordenes_pago
    where perfil_id = '22222222-2222-2222-2222-222222222222')::int,
  0, 'Ana NO ve la orden de Beto');

-- El cliente no crea órdenes directamente (lo hace comprar-bebida vía service_role)
select throws_ok(
  $$ insert into public.ordenes_pago
       (perfil_id, bebida_catalogo_id, valor_v, buyer_fee, total, provider)
     values ('11111111-1111-1111-1111-111111111111',
             '99999999-9999-9999-9999-999999999999', 40.00, 6.00, 46.00, 'mock') $$,
  '42501', null, 'Ana NO puede insertar órdenes directamente');

-- El cliente no puede confirmar su propia orden (auto-confirmar pago sin cobro)
select throws_ok(
  $$ update public.ordenes_pago set estado = 'confirmada'
     where perfil_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'Ana NO puede cambiar el estado de su orden (auto-confirmarse)');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
