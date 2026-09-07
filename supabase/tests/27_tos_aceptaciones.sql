begin;
select plan(8);

-- Dos perfiles para probar el aislamiento entre usuarios.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'tos-a@ayni.test', '', now(), now(), now()),
       ('00000000-0000-0000-0000-0000000000a2'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'tos-b@ayni.test', '', now(), now(), now());

insert into public.profiles (id, rol) values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'amigo'),
  ('00000000-0000-0000-0000-0000000000a2'::uuid, 'rentador');

select has_table('public', 'tos_aceptaciones', 'existe la tabla tos_aceptaciones');
select has_column('public', 'profiles', 'referido_por', 'profiles tiene la columna referido_por');

-- El cliente no puede mutar ni borrar: la aceptacion es evidencia, no estado.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'tos_aceptaciones'
      and grantee = 'authenticated' and privilege_type in ('UPDATE', 'DELETE')),
  0,
  'authenticated no tiene UPDATE ni DELETE sobre tos_aceptaciones'
);
-- SELECT sigue siendo de tabla entera; INSERT dejo de serlo en la migracion
-- 20260906150000, que lo redujo a las dos columnas que el cliente tiene
-- derecho a fijar. `aceptado_at` quedo fuera a proposito: la fecha la pone el
-- servidor con su default, y por eso esta fila sirve de evidencia en vez de
-- ser un dato auto-reportado. Ver 28_tos_endurecimiento.sql, que reproduce el
-- ataque en lugar de mirar el catalogo.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'tos_aceptaciones'
      and grantee = 'authenticated' and privilege_type = 'SELECT'),
  1,
  'authenticated conserva SELECT sobre la tabla'
);
select is(
  (select string_agg(column_name, ',' order by column_name)
     from information_schema.column_privileges
    where table_name = 'tos_aceptaciones'
      and grantee = 'authenticated' and privilege_type = 'INSERT'),
  'perfil_id,version',
  'authenticated solo puede insertar perfil_id y version'
);

-- RLS encendida y con una policy por operacion permitida.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tos_aceptaciones'::regclass),
  'tos_aceptaciones tiene RLS habilitada'
);
select is(
  (select count(*)::int from pg_policy where polrelid = 'public.tos_aceptaciones'::regclass),
  2,
  'tos_aceptaciones tiene exactamente dos policies (select propio, insert propio)'
);

-- Aislamiento real: A no ve la aceptacion de B.
insert into public.tos_aceptaciones (perfil_id, version)
values ('00000000-0000-0000-0000-0000000000a2'::uuid, 'v1');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
select is(
  (select count(*)::int from public.tos_aceptaciones),
  0,
  'un usuario no ve la aceptacion de otro'
);
reset role;

select * from finish();
rollback;
