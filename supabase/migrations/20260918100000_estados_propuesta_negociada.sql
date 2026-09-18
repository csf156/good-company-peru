-- Fase F.1, Tarea 1 — Estados nuevos de `estado_invitacion` para la propuesta
-- negociada (spec docs/superpowers/specs/2026-09-16-propuesta-negociada-design.md).
--
-- Hasta hoy una propuesta solo podía ser aceptada, rechazada o expirar. La
-- propuesta negociada es SIMÉTRICA (spec §3.2-§3.3, §5): A es quien propuso
-- (el rentador en una invitación, el amigo en una solicitud) y B es quien
-- recibe. Los estados se describen por ese rol, no por amigo/rentador:
--
--   contrapropuesta            B (quien recibe) respondió con una
--                              contrapropuesta; ahora espera A (quien propuso).
--   contrapropuesta_rechazada  A (quien propuso) declinó la contrapropuesta;
--                              la propuesta queda esperando a B, que decide
--                              sobre la ORIGINAL.
--   retirada                   A (quien propuso) la retira en CUALQUIER espera:
--                              desde pendiente, contrapropuesta o
--                              contrapropuesta_rechazada (spec §3.3, §5.2).
--                              Terminal.
--   concluida                  Terminal. SOLO la asigna el sub-proyecto 5
--                              (encuentro realizado); nadie antes. Hasta
--                              entonces la invitación aceptada sigue
--                              `aceptada` (spec §5, §6).
--
-- Va en una migración PROPIA y SOLO con esto: Postgres no deja usar un valor de
-- enum en la misma transacción que lo crea, así que las policies y el índice
-- que los usen (F.1, tareas siguientes) y las funciones del flujo (F.2) van en
-- migraciones aparte. Aquí ningún objeto los referencia todavía.
--
-- Ampliación ADITIVA: las etiquetas viejas (pendiente, aceptada, rechazada,
-- expirada, preautorizando) siguen valiendo, en el mismo orden. `if not exists`
-- sigue la misma pauta de 20260909130000_estados_preautorizacion.sql.

alter type estado_invitacion add value if not exists 'contrapropuesta';
alter type estado_invitacion add value if not exists 'contrapropuesta_rechazada';
alter type estado_invitacion add value if not exists 'retirada';
alter type estado_invitacion add value if not exists 'concluida';
