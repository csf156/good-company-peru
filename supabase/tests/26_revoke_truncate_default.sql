-- pgTAP: revocar TRUNCATE de anon/authenticated en todo public, presente Y
-- futuro (hallazgo del security-review de cierre del Bloque 3 D.3, backlog).
--
-- TRUNCATE no lo gobierna RLS y no dispara triggers de fila — los triggers
-- ledger_no_delete/ledger_no_update (BEFORE DELETE/UPDATE FOR EACH ROW) NO
-- lo interceptan, así que hoy cualquier rol con ese privilegio podría vaciar
-- el ledger append-only sin que salte la invariante contable central del
-- proyecto. Explotabilidad hoy: baja (PostgREST no expone TRUNCATE, nadie
-- tiene contraseña de Postgres para anon/authenticated) — es defensa en
-- profundidad, no una puerta abierta.
--
-- El "cero" de la aserción 1 lleva asterisco: `postgres` (el rol con el que
-- corren las migraciones) NO es superusuario en este proyecto
-- (pg_roles.rolsuper = false; el único superusuario es `supabase_admin`), así
-- que no tiene autoridad para revocar privilegios sobre objetos que no le
-- pertenecen. Dos vistas de la extensión `pgtap` (`tap_funky`,
-- `pg_all_foreign_keys`), propiedad de `supabase_admin`, conservan TRUNCATE
-- pase lo que pase con esta migración — son andamiaje interno de pgtap para
-- introspección durante los tests, no datos de la app, y PostgREST no las
-- expone. Por eso la aserción 1 excluye relaciones que pertenecen a una
-- extensión (`pg_depend.deptype = 'e'`), y la aserción 2 fija esa excepción
-- por NOMBRE — así que si mañana cualquier OTRA tabla real recupera
-- TRUNCATE, o si el conjunto de excepciones cambia, el test sigue fallando.
begin;
select plan(6);

-- 1. Hoy son 28 (16 tablas/vistas × 2 roles, menos las 2 vistas de pgtap ×
--    2 roles que no se pueden revocar); tras la migración, cero.
select is(
  (select count(*)::int
     from information_schema.role_table_grants g
     join pg_class c on c.relname = g.table_name
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = g.table_schema
    where g.table_schema = 'public'
      and g.privilege_type = 'TRUNCATE'
      and g.grantee in ('anon', 'authenticated')
      and not exists (
        select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e'
      )),
  0,
  'ningún TRUNCATE para anon/authenticated en las tablas/vistas propias del proyecto (excluye objetos de extensión)'
);

-- 2. La única excepción conocida (pgtap, propiedad de supabase_admin) queda
--    fija por NOMBRE, no por conteo — un `is(count, 2)` pasaría igual si
--    mañana aparece una vista de extensión distinta en vez de estas dos.
select is(
  (select array_agg(distinct c.relname order by c.relname)
     from information_schema.role_table_grants g
     join pg_class c on c.relname = g.table_name
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = g.table_schema
    where g.table_schema = 'public'
      and g.privilege_type = 'TRUNCATE'
      and g.grantee in ('anon', 'authenticated')
      and exists (
        select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e'
      )),
  array['pg_all_foreign_keys', 'tap_funky']::name[],
  'las únicas relaciones con TRUNCATE que sobreviven son exactamente estas dos vistas de pgtap (supabase_admin, fuera del alcance de postgres)'
);

-- 3. Una tabla creada DESPUÉS de la migración tampoco debe heredarlo — esta
--    es la prueba real de que `alter default privileges` quedó bien (revocar
--    solo lo existente arreglaría el presente, no el futuro). Vive y muere
--    dentro de esta transacción: el `rollback` de abajo la deshace.
create table public._prueba_default_privileges_truncate (id int);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = '_prueba_default_privileges_truncate'
      and privilege_type = 'TRUNCATE'
      and grantee in ('anon', 'authenticated')),
  0,
  'una tabla nueva tampoco hereda TRUNCATE por default'
);

-- 4. Lo que debía seguir funcionando sigue: SELECT+INSERT donde ya los había.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'onboarding_eventos'
      and grantee = 'authenticated'
      and privilege_type in ('SELECT', 'INSERT')),
  2,
  'onboarding_eventos conserva SELECT+INSERT para authenticated'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'chat_mensajes'
      and grantee = 'authenticated'
      and privilege_type in ('SELECT', 'INSERT')),
  2,
  'chat_mensajes conserva SELECT+INSERT para authenticated'
);

-- 5. El ledger sigue siendo select-only para el cliente (sin insert/update/delete).
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'ledger'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'ledger sigue siendo select-only para authenticated (sin insert/update/delete)'
);

select * from finish();
rollback;
