-- Revoca TRUNCATE de anon/authenticated en todo `public`, presente y futuro.
-- Hallazgo del security-review de cierre del Bloque 3 (D.3, backlog): TRUNCATE
-- no lo gobierna RLS y no dispara triggers de fila — los triggers
-- ledger_no_delete/ledger_no_update (BEFORE DELETE/UPDATE FOR EACH ROW) no lo
-- interceptan, así que ese privilegio podía vaciar el ledger append-only sin
-- que saltara la invariante contable central del proyecto. Explotabilidad
-- hoy: baja (PostgREST no expone TRUNCATE, nadie tiene contraseña de
-- Postgres para anon/authenticated) — es defensa en profundidad.
--
-- El privilegio no lo otorgó ninguna migración de este repo: viene del
-- default privilege que Supabase deja configurado en el rol `postgres` para
-- el schema `public` (confirmado por introspección de pg_default_acl —
-- `postgres=arwdDxtm/postgres` sobre relaciones, donde la `D` es TRUNCATE).
-- Como todas las migraciones de este repo corren como `postgres`
-- (tests/db/apply-migrations.mjs), toda tabla nueva lo hereda automáticamente
-- al crearse. Por eso el arreglo tiene dos partes: revocar lo ya concedido
-- (presente) y cambiar el default de ESE rol (futuro) — revocar solo lo
-- primero dejaría a la siguiente tabla nueva con el mismo problema.
revoke truncate on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;
