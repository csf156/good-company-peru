-- pgTAP: función atómica crear_invitacion (Fase 4.2) — mínimo tras E.1.
--
-- El CUERPO de esta función bloquea la bebida vía una fila de `bar`, que E.1
-- (20260909120000_matar_stock.sql) eliminó — invocarla hoy fallaría con
-- "relation bar does not exist". La firma misma cambia en E.2 (spec §7: "la
-- invitación es la compra", ya no recibe `bebida_bar_id`). Hasta entonces
-- este archivo solo verifica que la función sigue existiendo; la cobertura de
-- comportamiento completa (KYC, bloqueo/liberación, idempotencia, RLS) vuelve
-- en E.2 sobre la firma nueva.
select plan(1);

select has_function('public', 'crear_invitacion',
  'existe crear_invitacion (se reescribe en E.2 — hoy referencia `bar`, ya eliminada)');

select * from finish();
