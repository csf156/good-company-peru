-- Fase 3.4 (endurecimiento post-review) — conciliación por MONTOS
-- Refuerza detectar_discrepancias_sp3 con una 5ª invariante: los montos del
-- ledger de una orden confirmada deben coincidir con los valores CONGELADOS en
-- la orden (total / buyer_fee / valor_v). La invariante #3 (netea a 0) no basta:
-- un grupo compra +50 / fee −10 / escrow_lock −40 netea a 0 pero no corresponde
-- a una orden de total 46 / fee 6 / valor 40. Como todo el propósito de
-- `ordenes_pago` es ser la fuente de verdad de los precios, la conciliación debe
-- verificar igualdad de montos contra ella, no solo la forma.
--
-- CREATE OR REPLACE: reemplaza la función de 20260723150000 conservando
-- privilegios (execute solo service_role). Se re-declaran los revokes/grant por
-- claridad e idempotencia del deploy.

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
     <> (select count(*) from public.bar)

  union all

  -- 5. Ledger de una orden confirmada cuyos montos no coinciden con los
  --    congelados en la orden. Caza grupos balanceados-pero-mal-preciados que
  --    la invariante #3 (netea a 0) dejaría pasar.
  select
    'ledger_monto_no_coincide_con_orden'::text,
    o.id,
    'ledger no coincide con la orden — compra '
      || coalesce(sum(l.monto) filter (where l.tipo = 'compra'), 0)::text
      || ' (esperado ' || o.total::text || '), fee '
      || coalesce(sum(l.monto) filter (where l.tipo = 'fee'), 0)::text
      || ' (esperado ' || (-o.buyer_fee)::text || '), escrow_lock '
      || coalesce(sum(l.monto) filter (where l.tipo = 'escrow_lock'), 0)::text
      || ' (esperado ' || (-o.valor_v)::text || ')'
  from public.ordenes_pago o
  join public.ledger l on l.referencia_id = o.id
  where o.estado = 'confirmada'
  group by o.id, o.total, o.buyer_fee, o.valor_v
  having coalesce(sum(l.monto) filter (where l.tipo = 'compra'), 0) <> o.total
      or coalesce(sum(l.monto) filter (where l.tipo = 'fee'), 0) <> -o.buyer_fee
      or coalesce(sum(l.monto) filter (where l.tipo = 'escrow_lock'), 0) <> -o.valor_v;
$$;

revoke execute on function public.detectar_discrepancias_sp3() from public;
revoke execute on function public.detectar_discrepancias_sp3() from authenticated, anon;
grant execute on function public.detectar_discrepancias_sp3() to service_role;
