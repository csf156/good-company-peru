-- pgTAP: función de conciliación del sub-proyecto 3 (Fase 3.4) — mínimo tras E.1.
--
-- Su invariante #4 compara el conteo de `escrow_lock` del ledger contra el
-- conteo de filas de `bar`, que E.1 eliminó — invocarla hoy fallaría con
-- "relation bar does not exist". La lógica de conciliación se reescribe en el
-- bloque E.2 sobre el esquema nuevo (spec §7). Hasta entonces este archivo
-- solo verifica que la función sigue existiendo; la cobertura de
-- comportamiento completa (discrepancias inyectadas, RLS) vuelve en E.2.
select plan(1);

select has_function('public', 'detectar_discrepancias_sp3',
  'existe detectar_discrepancias_sp3 (se reescribe en E.2 — hoy referencia `bar`, ya eliminada)');

select * from finish();
