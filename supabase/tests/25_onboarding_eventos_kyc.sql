begin;
select plan(6);

-- Un perfil de prueba propio para no depender de datos ajenos.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000c1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'kyc-paso@ayni.test', '',
        now(), now(), now());

insert into public.profiles (id, rol) values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'amigo');

-- Los pasos del wizard de perfil siguen siendo válidos.
select lives_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('00000000-0000-0000-0000-0000000000c1'::uuid, 7, 'completado')$$,
  'el paso 7 (fin del alta de perfil) sigue aceptandose'
);

-- Los cuatro pasos de KYC son los que esta migracion habilita.
select lives_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('00000000-0000-0000-0000-0000000000c1'::uuid, 8, 'paso_visto')$$,
  'el paso 8 (intro de KYC) se acepta'
);
select lives_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('00000000-0000-0000-0000-0000000000c1'::uuid, 11, 'completado')$$,
  'el paso 11 (KYC completado) se acepta'
);

-- El rango sigue acotado por los dos extremos.
select throws_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('00000000-0000-0000-0000-0000000000c1'::uuid, 12, 'paso_visto')$$,
  '23514',
  null,
  'el paso 12 se rechaza: el rango sigue acotado por arriba'
);
select throws_ok(
  $$insert into public.onboarding_eventos (perfil_id, paso, evento)
    values ('00000000-0000-0000-0000-0000000000c1'::uuid, 0, 'paso_visto')$$,
  '23514',
  null,
  'el paso 0 se rechaza: el rango sigue acotado por abajo'
);

-- El ensanchado no debe haber tocado el aislamiento.
select ok(
  (select count(*) from pg_policy
    where polrelid = 'public.onboarding_eventos'::regclass) = 2,
  'las dos policies de RLS (select_own, insert_own) siguen en pie'
);

select * from finish();
rollback;
