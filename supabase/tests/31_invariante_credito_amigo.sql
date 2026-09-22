-- pgTAP: un amigo solo puede ser acreditado por una liberación de escrow
-- referida a un encuentro finalizado (Fase E.1).
--
-- Vetos 8, 9 y 14 del backlog. Reproduce los ataques COMO service_role: el rol
-- que bypassa RLS y que usan las Edge Functions. Si la regla viviera en
-- TypeScript, todos estos inserts pasarían.
--
-- Hoy esta invariante rechaza el 100% de los créditos, porque la fase 5.4 (que
-- lleva una cita a 'finalizada' por la vía del motor de cita) no existe. Eso es
-- lo correcto: la única puerta futura queda tapiada antes de que nadie la abra.
begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'amigo-e1@martini.test', '', now(), now(), now());

insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'amigo');

-- ATAQUE 1 (veto 14): acreditarle con un tipo que no es payout — el disfraz de
-- un cashback, un bono o una "compensación de soporte".
select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'compra', 100, 'ataque-credito-tipo')$$,
  'AY451',
  'credito a un amigo solo por payout (recibido: compra)',
  'no se puede acreditar a un amigo con un tipo que no es payout'
);

-- ATAQUE 2 (veto 9): payout sin referencia a ninguna cita — la forma que
-- tomaría un endpoint de crédito "solo para pruebas".
select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'payout', 100, 'ataque-credito-sin-cita')$$,
  'AY451',
  'un payout necesita referencia a la cita',
  'no se puede acreditar a un amigo sin referencia a una cita'
);

-- ATAQUE 3 (veto 9): payout referido a una cita que NO está finalizada. Es el
-- ataque más realista: la cita existe, pero el encuentro no se verificó.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a2'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'rentador-e1b@martini.test', '', now(), now(), now());
insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000a2'::uuid, 'rentador');

insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, estado)
values ('00000000-0000-0000-0000-0000000000a3'::uuid,
        '00000000-0000-0000-0000-0000000000a2'::uuid,
        '00000000-0000-0000-0000-0000000000a1'::uuid,
        'invitacion', 'especifica', 'aceptada');

insert into public.citas (id, invitacion_id, estado)
values ('00000000-0000-0000-0000-0000000000a4'::uuid,
        '00000000-0000-0000-0000-0000000000a3'::uuid,
        'confirmada');

select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'payout', 100,
            '00000000-0000-0000-0000-0000000000a4'::uuid, 'ataque-credito-cita-viva')$$,
  'AY451',
  'payout solo por cita finalizada (cita: 00000000-0000-0000-0000-0000000000a4, estado: confirmada)',
  'no se puede acreditar a un amigo por una cita que no esta finalizada'
);

-- CAMINO LEGÍTIMO: la cita finalizada, CON una orden capturada detrás (Tarea
-- 3b: sin esto el "camino legítimo" era en realidad un cuarto hueco — un
-- payout sin ninguna captura que lo respalde).
update public.citas set estado = 'finalizada'
 where id = '00000000-0000-0000-0000-0000000000a4'::uuid;

insert into public.ordenes_pago (perfil_id, invitacion_id, valor_v, buyer_fee, total, provider, estado)
values ('00000000-0000-0000-0000-0000000000a2'::uuid,
        '00000000-0000-0000-0000-0000000000a3'::uuid, 100, 15, 115, 'mock', 'capturada');

select lives_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'payout', 100,
            '00000000-0000-0000-0000-0000000000a4'::uuid, 'payout-legitimo')$$,
  'un payout por una cita finalizada si pasa'
);

-- ATAQUE 4 (Tarea 3b, hueco 1): acreditar a un amigo AJENO a la cita. La cita
-- ...a4 es entre el rentador ...a2 y el amigo ...a1; ...b9 no pinta nada ahí.
-- Es la forma que toma un endpoint de compensación: referencia un encuentro
-- real cualquiera.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000b9'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'amigo-ajeno@martini.test', '', now(), now(), now());
insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000b9'::uuid, 'amigo');

select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000b9'::uuid, 'payout', 100,
            '00000000-0000-0000-0000-0000000000a4'::uuid, 'ataque-cita-ajena')$$,
  'AY451',
  'el amigo no es parte de la cita 00000000-0000-0000-0000-0000000000a4',
  'no se puede acreditar a un amigo ajeno a la cita'
);

-- ATAQUE 5 (hueco 3): la misma cita respaldando un segundo payout. La clave de
-- idempotencia es distinta, así que el unique del ledger no lo detiene.
select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'payout', 100,
            '00000000-0000-0000-0000-0000000000a4'::uuid, 'ataque-doble-payout')$$,
  '23505',
  null,
  'una cita no puede respaldar dos payouts al mismo amigo'
);

-- ATAQUE 6 (hueco 2): payout por encima de lo que se capturó para ese
-- encuentro. Se usa una segunda cita finalizada, porque la ...a4 ya gastó su
-- payout.
--
-- F.1 Tarea 5: esta invitación (...a5) NO puede compartir emisor con ...a3 —
-- las dos son 'aceptada' (no-terminal) y ambas tendrían el par (a1, a2), lo
-- que colisiona con el índice único por par (spec §6). El receptor se queda
-- en a1 (es a quien se le intenta acreditar el payout — cambiarlo rompería
-- el ataque, que depende de que a1 SÍ sea parte de la cita). El emisor pasa
-- a un rentador nuevo (...a7), y la orden que respalda la captura lo sigue
-- (es quien paga).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a7'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'rentador-e1c@martini.test', '', now(), now(), now());
insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000a7'::uuid, 'rentador');

insert into public.invitaciones (id, emisor_id, receptor_id, tipo, alcance, estado)
values ('00000000-0000-0000-0000-0000000000a5'::uuid,
        '00000000-0000-0000-0000-0000000000a7'::uuid,
        '00000000-0000-0000-0000-0000000000a1'::uuid,
        'invitacion', 'especifica', 'aceptada');
insert into public.citas (id, invitacion_id, estado)
values ('00000000-0000-0000-0000-0000000000a6'::uuid,
        '00000000-0000-0000-0000-0000000000a5'::uuid, 'finalizada');
insert into public.ordenes_pago (perfil_id, invitacion_id, valor_v, buyer_fee, total, provider, estado)
values ('00000000-0000-0000-0000-0000000000a7'::uuid,
        '00000000-0000-0000-0000-0000000000a5'::uuid, 50, 7.5, 57.5, 'mock', 'capturada');

select throws_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'payout', 999999,
            '00000000-0000-0000-0000-0000000000a6'::uuid, 'ataque-monto')$$,
  'AY451',
  'payout 999999.00 excede lo capturado para la cita (50.00)',
  'no se puede acreditar mas de lo capturado para ese encuentro'
);

select * from finish();
rollback;
