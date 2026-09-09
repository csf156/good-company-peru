-- pgTAP: función atómica responder_invitacion (Fase 4.3) — mínimo tras E.1.
--
-- El CUERPO de esta función bloquea/libera la bebida vía filas de `bar`, que
-- E.1 (20260909120000_matar_stock.sql) eliminó — invocarla hoy fallaría con
-- "relation bar does not exist". Se reescribe en el bloque E.2 sobre el flujo
-- preautorización→captura (spec §7). Hasta entonces este archivo solo
-- verifica que la función sigue existiendo; la cobertura de comportamiento
-- completa (KYC, bloqueo/liberación, idempotencia, RLS) vuelve en E.2.
select plan(1);

select has_function('public', 'responder_invitacion',
  'existe responder_invitacion (se reescribe en E.2 — hoy referencia `bar`, ya eliminada)');

select * from finish();
