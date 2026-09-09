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
select plan(4);

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

-- CAMINO LEGÍTIMO: la cita finalizada. Es lo que hará la fase 5.4.
update public.citas set estado = 'finalizada'
 where id = '00000000-0000-0000-0000-0000000000a4'::uuid;

select lives_ok(
  $$insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'payout', 100,
            '00000000-0000-0000-0000-0000000000a4'::uuid, 'payout-legitimo')$$,
  'un payout por una cita finalizada si pasa'
);

select * from finish();
rollback;
