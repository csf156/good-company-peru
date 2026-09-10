-- pgTAP: no existe ninguna forma de crear valor sin destinatario (Fase E.1).
--
-- Reproduce los ataques de los vetos 1, 2 y 3 del backlog: comprar sin
-- destinatario, acumular stock, reasignar una bebida ya comprada. No basta con
-- mirar el catálogo — un test que solo comprobara que `bar` no existe pasaría
-- igual si quedara otra vía para insertar una orden huérfana.
begin;
select plan(7);

-- La tabla de stock ya no existe.
select is(
  (select count(*)::int from information_schema.tables
    where table_schema = 'public' and table_name = 'bar'),
  0,
  'la tabla bar ya no existe'
);

-- Ni su enum.
select is(
  (select count(*)::int from pg_type where typname = 'estado_bar'),
  0,
  'el enum estado_bar ya no existe'
);

-- ATAQUE 1 (vetos 1 y 2): una orden de pago sin invitación es la definición de
-- comprar sin destinatario. Debe fallar por NOT NULL, como service_role — es
-- decir, ni siquiera el rol que bypassa RLS puede hacerlo.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000e1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'rentador-e1@martini.test', '', now(), now(), now());

insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000e1'::uuid, 'rentador');

select throws_ok(
  $$insert into public.ordenes_pago (perfil_id, valor_v, buyer_fee, total, provider)
    values ('00000000-0000-0000-0000-0000000000e1'::uuid, 50, 7.5, 57.5, 'mock')$$,
  '23502',
  null,
  'no se puede crear una orden de pago sin invitación (compra sin destinatario)'
);

-- ATAQUE 2 (veto 3): la invitación referencia el CATÁLOGO, no una fila de stock
-- reasignable. La columna vieja tiene que haber desaparecido.
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'invitaciones'
      and column_name = 'bebida_bar_id'),
  0,
  'invitaciones.bebida_bar_id ya no existe: no hay bebida reasignable'
);

-- Los estados del flujo hold → captura existen (ampliación aditiva).
select is(
  (select count(*)::int from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'estado_invitacion' and e.enumlabel = 'preautorizando'),
  1,
  'estado_invitacion tiene preautorizando'
);

select is(
  (select count(*)::int from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'estado_orden'
      and e.enumlabel in ('preautorizada', 'capturada', 'anulada')),
  3,
  'estado_orden tiene preautorizada, capturada y anulada'
);

-- ATAQUE (veto 22, ciclo comprar-cancelar): dos holds vivos sobre la misma
-- invitación. Se permiten reintentos tras un fallo, jamás dos autorizaciones
-- vivas — si no, el mismo encuentro retiene dos veces la tarjeta.
insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, estado)
values ('00000000-0000-0000-0000-0000000000e9'::uuid,
        '00000000-0000-0000-0000-0000000000e1'::uuid,
        '00000000-0000-0000-0000-0000000000e1'::uuid,
        'invitacion', 'especifica', 'preautorizando');

insert into public.ordenes_pago (perfil_id, invitacion_id, valor_v, buyer_fee, total, provider, estado)
values ('00000000-0000-0000-0000-0000000000e1'::uuid,
        '00000000-0000-0000-0000-0000000000e9'::uuid, 50, 7.5, 57.5, 'mock', 'preautorizada');

select throws_ok(
  $$insert into public.ordenes_pago (perfil_id, invitacion_id, valor_v, buyer_fee, total, provider, estado)
    values ('00000000-0000-0000-0000-0000000000e1'::uuid,
            '00000000-0000-0000-0000-0000000000e9'::uuid, 50, 7.5, 57.5, 'mock', 'preautorizada')$$,
  '23505',
  null,
  'no puede haber dos ordenes vivas sobre la misma invitacion'
);

select * from finish();
rollback;
