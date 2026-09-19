-- Cantidad y columnas de la contrapropuesta (Fase F.1, Tarea 2b) — spec
-- 2026-09-16-propuesta-negociada-design.md §8b.
--
-- Tres columnas nuevas en `invitaciones`, tres checks y un backfill. Nacen de
-- dos decisiones del usuario del 2026-09-18, y una de ellas tapa un hueco del
-- plan original de F.1: definía los estados de la contrapropuesta pero no
-- DÓNDE se guarda lo que la contrapropuesta propone.
--
-- 1. `cantidad integer` — cuántas bebidas invita quien paga. Es UN solo cobro
--    (una retención, una captura, un encuentro), nunca valor almacenado.
--    * NULL a propósito: en una solicitud el amigo no fija cantidad; la fija el
--      rentador cuando actúa (F.2). El check se escribe `cantidad is null or
--      cantidad >= 1` para que esa intención se lea; un CHECK ya dejaría pasar
--      NULL por sí solo (solo rechaza FALSE), así que `cantidad >= 1` a secas
--      sería equivalente.
--    * SIN tope de negocio (decisión del usuario; solo `>= 1`). Sí hay un
--      límite TÉCNICO —el importe vive en `numeric(12,2)` y `valor × cantidad`
--      puede no caber—, pero NO se resuelve poniendo un tope aquí (sería colar
--      por la puerta de atrás el tope que el usuario rechazó): lo resuelve F.2,
--      donde `calcular_desglose` rechazará con un error claro un total que no
--      quepa.
--    * NO existe `contra_cantidad`: la cantidad no es contraproponible. Es la
--      única variable que mueve el importe sin mover la intención, y quien
--      paga es quien la fija.
--
-- 2. `contra_bebida_catalogo_id uuid` (FK al catálogo) y
--    `contra_tiempo_estimado_min integer` — lo que propone la contrapropuesta.
--    Van como COLUMNAS y no como tabla aparte porque solo hay UNA
--    contrapropuesta por propuesta: la forma del esquema garantiza la
--    unicidad, sin índice. Las dos son NULL hasta que hay contrapropuesta.
--    Semántica: "hay contrapropuesta" = al menos UNA de las dos columnas no
--    es NULL; una columna contra NULL significa "ese campo no se
--    contrapropone" (se queda como en la original). Se puede contraproponer
--    la bebida, la duración o las dos; NO la cantidad, el momento ni el lugar.
--
--    Check `invitaciones_contrapropuesta_cambia_algo`: una contrapropuesta
--    tiene que cambiar algo. La fila es válida si (a) no hay contrapropuesta,
--    o (b) hay contra_bebida y difiere de `bebida_catalogo_id`, o (c) hay
--    contra_tiempo y difiere de `tiempo_estimado_min`. Los `is not null` van
--    explícitos a propósito (misma lección que `bebidas_catalogo_intencion_
--    coherente`, migración 20260918110000): un CHECK deja pasar NULL, y una
--    expresión como `contra_bebida <> bebida_catalogo_id` daría NULL —y por
--    tanto aceptaría— la contrapropuesta que trae UNA sola columna e igual a
--    la original. `is distinct from` (no `<>`) porque la original puede ser
--    NULL (las solicitudes de hoy no traen bebida): contraproponer una bebida
--    frente a "ninguna" SÍ es un cambio. Consecuencia aceptada: una columna
--    contra puesta con el valor original no invalida la fila mientras la otra
--    sí cambie (el cliente puede mandar las dos aunque solo una cambie).
--
--    Check `invitaciones_contra_tiempo_estimado_min_check`: espejo del que ya
--    tiene `tiempo_estimado_min` desde la fase 4.2 (`is null or > 0`). No hay
--    tope superior en ninguno de los dos.
--
-- 3. `tiempo_estimado_min` NO se toca. Ya existe desde la fase 4.2 y queda en
--    minutos libres (decisión del usuario; no hay rangos con nombre).
--
-- Backfill: TODA fila de `invitaciones` que ya tiene una orden asociada
-- (`ordenes_pago.invitacion_id`, NOT NULL, FK a `invitaciones`) se rellena a
-- `cantidad = 1`, sea invitación o solicitud y en cualquier estado de la
-- orden (preautorizada, capturada, anulada…). Toda orden que existe hoy se
-- creó por `valor_v × 1` —la cantidad no existía—, así que `cantidad = 1` es
-- un DATO, no una suposición; sin rellenarla, F.2 se encontraría órdenes cuyo
-- importe no coincide con `valor × cantidad`. En una solicitud la orden solo
-- nace cuando el rentador actúa (la acepta) y ese es justo el momento en que
-- la cantidad deja de ser NULL según el spec §8b, así que rellenar las
-- solicitudes con orden es aplicar esa misma regla a los datos anteriores.
-- Quedan en NULL las filas SIN orden: las solicitudes pendientes o cerradas
-- sin que el rentador llegara a pagar, y cualquier invitación sin orden. El
-- trigger `invitaciones_set_updated_at` sube `updated_at` de las filas
-- rellenadas: es un efecto colateral menor, sin consumidor (ninguna función
-- lee `updated_at` de `invitaciones`).
--
-- Permisos, sin cambios: `authenticated` lee `invitaciones` con SELECT a nivel
-- de TABLA (ninguna columna tiene ACL propia) y la política
-- `invitaciones_select_parte` ya existe, así que las tres columnas nuevas
-- heredan la lectura para las dos partes; no tiene INSERT/UPDATE/DELETE (fase
-- 4.0) y esta migración no se lo concede. No se toca RLS, ni el ledger, ni
-- `crear_invitacion` / `responder_invitacion` (eso es F.2).
--
-- Se escribe para aplicarse UNA sola vez (sin `if not exists`). Al añadir los
-- checks Postgres valida las filas existentes: todas tienen las columnas
-- contra en NULL, así que pasan.

alter table public.invitaciones
  add column cantidad integer,
  add column contra_bebida_catalogo_id uuid
    references public.bebidas_catalogo(id),
  add column contra_tiempo_estimado_min integer,
  add constraint invitaciones_cantidad_check
    check (cantidad is null or cantidad >= 1),
  add constraint invitaciones_contra_tiempo_estimado_min_check
    check (contra_tiempo_estimado_min is null or contra_tiempo_estimado_min > 0),
  add constraint invitaciones_contrapropuesta_cambia_algo check (
    (contra_bebida_catalogo_id is null and contra_tiempo_estimado_min is null)
    or (contra_bebida_catalogo_id is not null
        and contra_bebida_catalogo_id is distinct from bebida_catalogo_id)
    or (contra_tiempo_estimado_min is not null
        and contra_tiempo_estimado_min is distinct from tiempo_estimado_min)
  );

-- Backfill: cantidad 1 de hecho en toda fila que ya tiene orden.
update public.invitaciones i
   set cantidad = 1
 where exists (select 1
                 from public.ordenes_pago o
                where o.invitacion_id = i.id);
