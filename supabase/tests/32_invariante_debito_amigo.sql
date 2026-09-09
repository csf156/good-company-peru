-- pgTAP: el importe pendiente del amigo no se puede gastar dentro de la app
-- (Fase E.1). Vetos 10, 11 y 12 del backlog.
--
-- La única salida legítima es la liquidación bancaria, que es la fase 6.3 y no
-- existe todavía: por eso hoy esta invariante rechaza TODO débito sobre un
-- amigo. Cuando 6.3 llegue, añadirá su tipo de movimiento y su comprobación de
-- titularidad; no puede simplemente quitar el trigger.
begin;
select plan(3);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000b1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'amigo-e1c@martini.test', '', now(), now(), now());

insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000b1'::uuid, 'amigo');

-- ATAQUE 1 (veto 9, el más peligroso de la lista): el amigo usa lo que ganó
-- para invitar a alguien. Tomaría la forma de una compra debitada de su cuenta.
select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000b1'::uuid, 'compra', -50, 'ataque-debito-invitar')$$,
  'AY452',
  null,
  'un amigo no puede gastar su pendiente para invitar'
);

-- ATAQUE 2 (veto 11): pagar la suscripción premium con el importe pendiente.
-- Suena razonable y compensable, y es efecto cancelatorio dentro de la
-- plataforma.
select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000b1'::uuid, 'fee', -39, 'ataque-debito-suscripcion')$$,
  'AY452',
  null,
  'un amigo no puede pagar la suscripcion con su pendiente'
);

-- ATAQUE 3 (veto 10): propina descontada del pendiente.
select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000b1'::uuid, 'escrow_lock', -10, 'ataque-debito-propina')$$,
  'AY452',
  null,
  'un amigo no puede debitar su pendiente por ningun otro concepto'
);

select * from finish();
rollback;
