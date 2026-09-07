-- Endurecimiento de tos_aceptaciones, salido de la revision del SQL de la
-- Tarea 1 de D.4. La tabla nacio con RLS correcta pero con el INSERT abierto
-- a TODAS sus columnas, y eso rompia las dos unicas garantias que esta tabla
-- existe para dar. Ambos agujeros se reprodujeron de verdad, insertando como
-- `authenticated` en una transaccion revertida, antes de escribir esto:
--
--   insert ... (perfil_id, version, aceptado_at)
--     values (<uid propio>, 'v99-inventada', '2001-01-01')   -->  ACEPTADO
--
-- (1) La FECHA era falsificable. El `default now()` solo se aplica si el
--     cliente no manda valor, y nada se lo impedia. Una fila cuya razon de ser
--     es servir de evidencia a la fase 7.5 no puede llevar una fecha que la
--     pone el propio interesado.
--
-- (2) La VERSION era libre. Alguien podia insertar hoy `v2` y, al subir
--     TOS_VERSION para re-pedir consentimiento, no se le volveria a pedir
--     nunca. Eso vacia de sentido el mecanismo de versionado, que es la razon
--     por la que esta tabla guarda `version` en vez de un booleano.
--
-- (3) Ademas no habia unicidad: un doble toque en el boton creaba dos filas, y
--     un cliente malicioso podia escribir ilimitadas en su propio subarbol.

-- Una aceptacion por persona y version. Re-aceptar la MISMA version no
-- significa nada; el historico entre versiones distintas se conserva igual.
create unique index tos_aceptaciones_perfil_version_idx
  on public.tos_aceptaciones (perfil_id, version);

-- La fecha la pone el servidor. Sin INSERT sobre la columna, el `default
-- now()` es la unica via posible. Mismo criterio de grants por columna que la
-- fase 1.1 aplico a las columnas sensibles de `profiles`: la RLS decide QUE
-- filas, los grants por columna deciden QUE campos.
-- `id` va en el mismo revoke por higiene: es `generated always as identity`,
-- asi que ya era inescribible, pero dejarlo concedido invita a confusion.
revoke insert (id, aceptado_at) on public.tos_aceptaciones from authenticated;

-- Solo se aceptan versiones que existen. Anadir una version del ToS es un acto
-- deliberado y merece su propia migracion; el coste de esa friccion es lo que
-- compra la imposibilidad de pre-aceptar una version futura.
--
-- OJO AL SUBIR LA VERSION: cambiar TOS_VERSION en lib/tos.ts sin anadir el
-- valor nuevo a este check hace que NADIE pueda aceptar, y la app deja a todo
-- el mundo atrapado en la pantalla de terminos. Las dos cosas van juntas.
alter table public.tos_aceptaciones
  add constraint tos_aceptaciones_version_check check (version in ('v1'));
