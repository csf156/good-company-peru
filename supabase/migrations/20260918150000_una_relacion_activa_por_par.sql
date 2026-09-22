-- F.1 Tarea 5 — una relación activa por par (spec
-- docs/superpowers/specs/2026-09-16-propuesta-negociada-design.md §6).
--
-- Entre dos personas solo puede haber una relación activa a la vez, sin
-- importar quién propuso ni en qué sentido: si Rodri invita a Vale y Vale le
-- manda una solicitud a Rodri, la segunda se bloquea (spec §3.1). Un índice
-- único parcial sobre el par SIN ORDENAR — `least`/`greatest` hace que
-- Rodri→Vale y Vale→Rodri ocupen la misma clave — cubre los dos sentidos a
-- la vez. Va como ÍNDICE y no como consulta dentro de una función: una
-- consulta sufre carreras entre transacciones concurrentes (lección de E.2a
-- Tarea 3b), el índice no.
--
-- Depende de la Tarea 4 (20260918140000_resolver_propuestas_duplicadas.sql,
-- ya aplicada): con duplicados vivos por par, este índice no se puede crear.
--
-- `where receptor_id is not null` (corregido 2026-09-22, BRAIN). `receptor_id`
-- es nullable y `alcance_invitacion` tiene el valor `global`: una invitación
-- sin receptor es un caso previsto del diseño. Sin este filtro, `least`/
-- `greatest` ignoran el NULL y la clave colapsa a `(emisor, emisor)` — dos
-- invitaciones globales del mismo emisor chocarían entre sí, y lo mismo
-- pasaría con cualquier fila cuyo `emisor_id = receptor_id` (ver
-- 14_conciliacion_sp3.sql, F.1 Tarea 5: fixture con ese patrón, corregido en
-- el commit de fixtures previo a esta migración). Nada de `coalesce`: la
-- regla es una relación activa POR PAR, y sin receptor no hay par — dos
-- invitaciones `global` del mismo emisor conviven, y una `global` activa NO
-- bloquea una `especifica` activa de ese mismo emisor a otra persona (los
-- dos casos están probados en 36_propuesta_negociada_esquema.sql, Sección 4).
--
-- `estado not in (...)`: los cuatro estados terminales (rechazada, expirada,
-- retirada, concluida) quedan fuera del índice — una vez que la relación
-- terminó, el par vuelve a estar libre. Por eso existe `concluida`: la regla
-- abarca la propuesta Y su encuentro, pero un índice no puede mirar la tabla
-- `citas`; la invitación queda `aceptada` mientras el encuentro esté vivo, y
-- el sub-proyecto 5 la pasará a `concluida` al terminar (hasta entonces, un
-- par que acepta queda bloqueado — consecuencia aceptada por el usuario,
-- spec §3.1).
create unique index invitaciones_una_relacion_activa_por_par
  on public.invitaciones (least(emisor_id, receptor_id), greatest(emisor_id, receptor_id))
  where receptor_id is not null
    and estado not in ('rechazada', 'expirada', 'retirada', 'concluida');
