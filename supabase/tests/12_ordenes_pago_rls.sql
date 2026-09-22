-- pgTAP: tabla ordenes_pago (Fase 3.1, adaptada en E.1) — estructura +
-- aislamiento RLS.
-- La orden guarda los montos calculados SERVER-SIDE (valor_v, buyer_fee, total)
-- para que el webhook confirme usando esos montos, nunca los del payload. El
-- cliente solo LEE sus propias órdenes; la escritura es del service_role.
--
-- E.1 (20260909120000_matar_stock.sql) le quitó bebida_catalogo_id — la bebida
-- ahora es derivable por invitacion_id, que pasa a ser NOT NULL (la invitación
-- es la compra). E.1 (20260909130000) además amplió estado_orden con los
-- estados del flujo preautorización→captura.
select plan(15);

-- Estructura
select has_table('public', 'ordenes_pago', 'existe tabla ordenes_pago');
select has_column('public', 'ordenes_pago', 'perfil_id', 'ordenes_pago tiene perfil_id');
select has_column('public', 'ordenes_pago', 'invitacion_id', 'ordenes_pago tiene invitacion_id');
select has_column('public', 'ordenes_pago', 'valor_v', 'ordenes_pago tiene valor_v');
select has_column('public', 'ordenes_pago', 'buyer_fee', 'ordenes_pago tiene buyer_fee');
select has_column('public', 'ordenes_pago', 'total', 'ordenes_pago tiene total');
select has_column('public', 'ordenes_pago', 'idempotency_key', 'ordenes_pago tiene idempotency_key');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'estado_orden'),
  array['pendiente', 'confirmada', 'fallida', 'preautorizada', 'capturada', 'anulada'],
  'estado_orden tiene los 3 estados originales + los 3 del flujo de preautorización (E.1)'
);

select is(relrowsecurity, true, 'RLS habilitado en ordenes_pago')
  from pg_class where oid = 'public.ordenes_pago'::regclass;

-- Datos: dos rentadores + catálogo + una invitación de cada uno (para que
-- ordenes_pago.invitacion_id NOT NULL tenga a qué apuntar) + una orden de cada
-- uno (sembradas como postgres).
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
  -- F.1 Tarea 5: Ana↔Beto ya tiene una invitación no-terminal (33333…, más
  -- abajo). La segunda invitación no puede volver a apuntar a Ana — mismo
  -- par, colisión con el índice único (spec §6) — así que la de Beto va a
  -- una tercera persona, Carla, ajena a lo que prueba este archivo (RLS de
  -- ordenes_pago por perfil, no por par de invitación).
  ('00000000-0000-0000-0000-000000000000',
   '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated',
   'carla.f12t5@test.dev', '', now(), now(), now(), '', '', '', '');

insert into public.profiles (id, rol, alias)
values
  ('11111111-1111-1111-1111-111111111111', 'rentador', 'AnaAlias'),
  ('22222222-2222-2222-2222-222222222222', 'rentador', 'BetoAlias'),
  ('55555555-5555-5555-5555-555555555555', 'amigo', 'CarlaAlias');

insert into public.bebidas_catalogo (id, nombre, tipo_invitacion, valor_v)
values ('99999999-9999-9999-9999-999999999999', 'Cerveza', 'divertida', 40.00);

insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, estado, bebida_catalogo_id)
values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'invitacion', 'especifica', 'pendiente',
   '99999999-9999-9999-9999-999999999999'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
   '55555555-5555-5555-5555-555555555555', 'invitacion', 'especifica', 'pendiente',
   '99999999-9999-9999-9999-999999999999');

insert into public.ordenes_pago
  (perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   40.00, 6.00, 46.00, 'pendiente', 'mock'),
  ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444',
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
       (perfil_id, invitacion_id, valor_v, buyer_fee, total, provider)
     values ('11111111-1111-1111-1111-111111111111',
             '33333333-3333-3333-3333-333333333333', 40.00, 6.00, 46.00, 'mock') $$,
  '42501', null, 'Ana NO puede insertar órdenes directamente');

-- El cliente no puede confirmar su propia orden (auto-confirmar pago sin cobro)
select throws_ok(
  $$ update public.ordenes_pago set estado = 'confirmada'
     where perfil_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'Ana NO puede cambiar el estado de su orden (auto-confirmarse)');

reset role;
select set_config('request.jwt.claims', null, true);

-- Idempotencia de creación SCOPED por perfil: la unicidad es (perfil_id,
-- idempotency_key). Un reintento del MISMO perfil con la misma key no crea una
-- segunda orden (comprar-bebida la reusa) → sigue rechazado con 23505.
insert into public.ordenes_pago
  (perfil_id, invitacion_id, valor_v, buyer_fee, total, provider, idempotency_key)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
        40.00, 6.00, 46.00, 'mock', 'idem-abc');
select throws_ok(
  $$ insert into public.ordenes_pago
       (perfil_id, invitacion_id, valor_v, buyer_fee, total, provider, idempotency_key)
     values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
             40.00, 6.00, 46.00, 'mock', 'idem-abc') $$,
  '23505', null, 'mismo perfil + misma idempotency_key es rechazada (no crea segunda orden)');

-- Scope por perfil: la MISMA idempotency_key desde OTRO perfil NO es una colisión
-- (índice compuesto). Beto puede crear su propia orden con 'idem-abc'; no choca
-- con la de Ana ni la expone (sin fuga cross-user).
select lives_ok(
  $$ insert into public.ordenes_pago
       (perfil_id, invitacion_id, valor_v, buyer_fee, total, provider, idempotency_key)
     values ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444',
             40.00, 6.00, 46.00, 'mock', 'idem-abc') $$,
  'la misma idempotency_key coexiste entre perfiles distintos (scope por perfil)');

select * from finish();
