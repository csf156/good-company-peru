-- pgTAP: esquema de la propuesta negociada (Fase F.1) — spec
-- docs/superpowers/specs/2026-09-16-propuesta-negociada-design.md.
--
-- F.1 solo prepara la base de datos para el flujo de contrapropuesta, retiro y
-- expiración: estados nuevos, columnas y funciones auxiliares. NO cambia el
-- comportamiento de crear_invitacion ni responder_invitacion (eso es F.2).
--
-- Este archivo crece por tareas: cada tarea de F.1 añade su sección aquí y sube
-- el `plan(N)` en la misma cantidad. Una sección por tema, en el orden de las
-- tareas; `finish()` y el cierre quedan siempre al final.
--
-- Sección 1 (Tarea 1): los cuatro estados nuevos de `estado_invitacion`. Se
-- comprueban leyendo `pg_enum`, NO usando el valor: un valor de enum recién
-- añadido no se puede usar en la misma transacción que lo crea (y este archivo
-- corre entero dentro de una).
select plan(5);

-- ============================================================================
-- 1. Estados nuevos de estado_invitacion
-- ============================================================================
select ok(
  exists (select 1 from pg_enum
           where enumtypid = 'public.estado_invitacion'::regtype
             and enumlabel = 'contrapropuesta'),
  'estado_invitacion tiene el valor contrapropuesta');

select ok(
  exists (select 1 from pg_enum
           where enumtypid = 'public.estado_invitacion'::regtype
             and enumlabel = 'contrapropuesta_rechazada'),
  'estado_invitacion tiene el valor contrapropuesta_rechazada');

select ok(
  exists (select 1 from pg_enum
           where enumtypid = 'public.estado_invitacion'::regtype
             and enumlabel = 'retirada'),
  'estado_invitacion tiene el valor retirada');

select ok(
  exists (select 1 from pg_enum
           where enumtypid = 'public.estado_invitacion'::regtype
             and enumlabel = 'concluida'),
  'estado_invitacion tiene el valor concluida');

-- Ampliación ADITIVA: las etiquetas de antes siguen ahí. Guarda contra un
-- DROP/RENAME accidental de un valor existente (Postgres no permite quitar
-- valores de un enum, pero sí renombrarlos — y ya se renombró uno antes:
-- por_pagar → preautorizando, migración 20260910110000).
select is(
  (select count(*)::int from pg_enum
    where enumtypid = 'public.estado_invitacion'::regtype
      and enumlabel in ('pendiente', 'aceptada', 'rechazada', 'expirada',
                        'preautorizando')),
  5, 'estado_invitacion conserva sus 5 valores previos (pendiente, aceptada, rechazada, expirada, preautorizando)');

select * from finish();
rollback;
