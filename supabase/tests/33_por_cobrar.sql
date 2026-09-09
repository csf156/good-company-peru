-- pgTAP: la vista de dinero del amigo es una cuenta por cobrar, no un saldo
-- (Fase E.1). Vetos 18 y 19 del backlog.
--
-- `balance` era común a los dos roles y sumaba TODO el ledger. `por_cobrar`
-- suma solo lo liberado de escrow: lo que la plataforma debe, no lo que el
-- usuario "tiene". Aísla por RLS igual que la vista vieja (security_invoker).
begin;
select plan(3);

select is(
  (select count(*)::int from information_schema.views
    where table_schema = 'public' and table_name = 'balance'),
  0,
  'la vista balance ya no existe'
);

select is(
  (select count(*)::int from information_schema.views
    where table_schema = 'public' and table_name = 'por_cobrar'),
  1,
  'existe la vista por_cobrar'
);

-- Aislamiento: un usuario no ve la fila de otro. Reproduce la lectura real
-- como `authenticated`, no mira pg_policy.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000c1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'amigo-e1d@martini.test', '', now(), now(), now());
insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'amigo');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1"}';

select is(
  (select count(*)::int from public.por_cobrar
    where perfil_id <> '00000000-0000-0000-0000-0000000000c1'::uuid),
  0,
  'por_cobrar no expone la fila de otro usuario'
);

reset role;

select * from finish();
rollback;
