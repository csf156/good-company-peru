-- Fase F.1, Tarea 1 — Estados nuevos de `estado_invitacion` para la propuesta
-- negociada (spec docs/superpowers/specs/2026-09-16-propuesta-negociada-design.md).
--
-- Hasta hoy una invitación solo podía ser aceptada, rechazada o expirar. La
-- propuesta negociada añade tres salidas más: el amigo puede responder con una
-- contrapropuesta (`contrapropuesta`), el rentador puede declinarla
-- (`contrapropuesta_rechazada`) o abandonar su propia propuesta antes de que
-- nadie responda (`retirada`), y la cita ya realizada se cierra en `concluida`.
--
-- Va en una migración PROPIA y SOLO con esto: Postgres no deja usar un valor de
-- enum en la misma transacción que lo crea, así que las funciones y policies
-- que los usen (F.1 tareas siguientes, F.2) van en migraciones aparte. Aquí
-- ningún objeto los referencia todavía.
--
-- Ampliación ADITIVA: las etiquetas viejas (pendiente, aceptada, rechazada,
-- expirada, preautorizando) siguen valiendo, en el mismo orden. `if not exists`
-- sigue la misma pauta de 20260909130000_estados_preautorizacion.sql.

alter type estado_invitacion add value if not exists 'contrapropuesta';
alter type estado_invitacion add value if not exists 'contrapropuesta_rechazada';
alter type estado_invitacion add value if not exists 'retirada';
alter type estado_invitacion add value if not exists 'concluida';
