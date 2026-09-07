-- Corrige el tercer arreglo de 20260906140000, que no surtio efecto.
--
-- Aquella migracion intento blindar la fecha con:
--
--   revoke insert (id, aceptado_at) on public.tos_aceptaciones from authenticated;
--
-- En PostgreSQL un revoke POR COLUMNA no puede anular un grant hecho a NIVEL
-- DE TABLA. La migracion 20260906130000 habia concedido `grant select, insert
-- on public.tos_aceptaciones to authenticated`, y el ACL quedo asi:
--
--   authenticated=arxtm/postgres
--                 ^ la 'a' es INSERT sobre la tabla entera
--
-- Esa 'a' sigue concediendo insert sobre TODAS las columnas, asi que el revoke
-- por columna fue un no-op silencioso: ni error, ni efecto. El pgTAP
-- 28_tos_endurecimiento.sql lo detecto porque REPRODUCE el ataque como
-- `authenticated` en vez de leer information_schema — un test que solo mirara
-- el catalogo habria visto el revoke registrado y pasado en verde con el
-- agujero abierto.
--
-- La forma correcta es quitar el privilegio de tabla y volver a concederlo
-- unicamente sobre las dos columnas que el cliente tiene derecho a fijar.
-- `id` es `generated always as identity` (inescribible de todos modos) y
-- `aceptado_at` queda solo con su `default now()`: la fecha la pone el
-- servidor, que es lo que hace que esta fila valga como evidencia para la
-- fase 7.5 en vez de ser un dato auto-reportado.
revoke insert on public.tos_aceptaciones from authenticated;

grant insert (perfil_id, version) on public.tos_aceptaciones to authenticated;
