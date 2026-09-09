-- pgTAP: función confirmar_orden_pago (Fase 3.1) — mínimo tras E.1.
--
-- E.1 (20260909120000_matar_stock.sql) eliminó la tabla `bar`, que el CUERPO
-- de esta función todavía inserta — invocarla hoy fallaría con "relation
-- bar does not exist". Se reescribe en el bloque E.2 (spec §7, Task 5 del
-- plan de E.1: "déjalos en el mínimo que compile, su cobertura real vuelve
-- en E.2"). Hasta entonces este archivo solo verifica que la función sigue
-- existiendo; la cobertura de comportamiento completa (idempotencia, doble
-- confirmación, pago fallido, RLS) vuelve en E.2.
select plan(1);

select has_function('public', 'confirmar_orden_pago',
  'existe confirmar_orden_pago (se reescribe en E.2 — hoy referencia `bar`, ya eliminada)');

select * from finish();
