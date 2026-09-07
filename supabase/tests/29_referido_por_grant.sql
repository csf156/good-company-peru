-- pgTAP: grant de escritura sobre profiles.referido_por (Fase D.4, Tarea 6).
--
-- La columna nació en la Tarea 1 (20260906130000_tos_y_referido.sql) pero sin
-- su grant de columna — este proyecto usa grants por columna explícitos
-- desde la fase 1.1 (security-review: "RLS es por fila, no por columna"),
-- así que una columna nueva no hereda escritura de nada; hay que concedérsela
-- a mano o el cliente nunca puede escribirla, aunque exista.
--
-- Reproduce el camino real (UPDATE como `authenticated`), no solo mira el
-- catálogo — mismo criterio que 28_tos_endurecimiento.sql: un test que solo
-- comprobara information_schema pasaría igual si el grant apuntara a la
-- columna equivocada.
begin;
select plan(3);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000f1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'referido@ayni.test', '', now(), now(), now());

insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000f1'::uuid, 'amigo');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1"}';

-- El propio usuario puede escribir su código de referido en el alta.
select lives_ok(
  $$update public.profiles set referido_por = 'ANA2026'
    where id = '00000000-0000-0000-0000-0000000000f1'::uuid$$,
  'authenticated puede escribir su propio referido_por'
);

reset role;

select is(
  (select referido_por from public.profiles
    where id = '00000000-0000-0000-0000-0000000000f1'::uuid),
  'ANA2026',
  'referido_por quedó guardado de verdad'
);

-- El grant nuevo no debe abrir de más: kyc_estado sigue vetada para el cliente.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1"}';
select throws_ok(
  $$update public.profiles set kyc_estado = 'verificado'
    where id = '00000000-0000-0000-0000-0000000000f1'::uuid$$,
  '42501',
  null,
  'el grant nuevo no abre otras columnas: kyc_estado sigue vetada'
);
reset role;

select * from finish();
rollback;
