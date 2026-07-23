-- Fase 3.4 — Conciliación del sub-proyecto 3 (dinero)
-- Job de detección de discrepancias: recorre las invariantes de plata y devuelve
-- una fila por cada rotura (vacío = todo cuadra). Ops/cron lo corre
-- periódicamente; si devuelve filas, algo escribió el ledger/bar/ordenes fuera
-- del camino sancionado (confirmar_orden_pago) y hay que investigar.
--
-- Invariantes verificadas (alcance SP3 — compra → escrow):
--   1. Toda orden `confirmada` tiene exactamente 3 filas de ledger
--      (compra/fee/escrow_lock).
--   2. Ninguna orden `pendiente`/`fallida` tiene filas de ledger (un pago no
--      confirmado no mueve plata).
--   3. Cada grupo de ledger de una compra netea a 0 (compra +total, fee
--      −buyer_fee, escrow_lock −V): comprar no genera saldo disponible.
--   4. El conteo de `escrow_lock` en el ledger iguala el conteo de bebidas en
--      `bar` (cada compra confirmada = 1 bloqueo de escrow + 1 bebida).
--
-- Conciliación balance↔partner (Red Pontis): cuando el partner sea real, se
-- suma el escrow neto del ledger (escrow_lock − escrow_release) y se compara
-- contra el saldo que Red Pontis reporta para las subcuentas de escrow. Hoy el
-- provider es mock (sin ledger de partner), así que esa comparación es una
-- costura documentada, no implementada — se activa junto con el payout real
-- (Fase 5.4).
--
-- SECURITY DEFINER + search_path fijo; EXECUTE solo para service_role: los
-- resultados exponen montos y referencias de todas las órdenes.

create or replace function public.detectar_discrepancias_sp3()
returns table (clase text, referencia uuid, detalle text)
language sql
security definer
set search_path = public
as $$
  -- 1. Orden confirmada sin exactamente 3 filas de ledger.
  select
    'orden_confirmada_ledger_incompleto'::text,
    o.id,
    'orden confirmada con ' || count(l.id) || ' filas de ledger (esperado 3)'
  from public.ordenes_pago o
  left join public.ledger l on l.referencia_id = o.id
  where o.estado = 'confirmada'
  group by o.id
  having count(l.id) <> 3

  union all

  -- 2. Orden pendiente/fallida que aun así tiene filas de ledger.
  select
    'orden_no_confirmada_con_ledger'::text,
    o.id,
    o.estado::text || ' pero tiene ' || count(l.id) || ' filas de ledger'
  from public.ordenes_pago o
  join public.ledger l on l.referencia_id = o.id
  where o.estado <> 'confirmada'
  group by o.id, o.estado

  union all

  -- 3. Grupo de ledger de una compra que no netea a 0.
  select
    'compra_no_netea_a_cero'::text,
    l.referencia_id,
    'la suma del ledger de la compra = ' || sum(l.monto)::text || ' (esperado 0)'
  from public.ledger l
  where l.referencia_id is not null
    and exists (
      select 1 from public.ledger l2
      where l2.referencia_id = l.referencia_id and l2.tipo = 'compra'
    )
  group by l.referencia_id
  having sum(l.monto) <> 0

  union all

  -- 4. Desbalance global entre bloqueos de escrow y bebidas en el bar.
  select
    'escrow_bar_conteo_desbalance'::text,
    null::uuid,
    'escrow_lock=' || (select count(*) from public.ledger where tipo = 'escrow_lock')
      || ' vs bar=' || (select count(*) from public.bar)
  where (select count(*) from public.ledger where tipo = 'escrow_lock')
     <> (select count(*) from public.bar);
$$;

revoke execute on function public.detectar_discrepancias_sp3() from public;
revoke execute on function public.detectar_discrepancias_sp3() from authenticated, anon;
grant execute on function public.detectar_discrepancias_sp3() to service_role;
