-- Fase E.2a, Tarea 5 — la conciliación compara ledger contra capturas, no
-- contra stock.
--
-- detectar_discrepancias_sp3 comparaba el ledger contra el stock del bar
-- (invariante 4, "escrow_bar_conteo_desbalance"); sin `bar`, esa pregunta ya
-- no significa nada (spec §10.1). No es hacerla compilar: hay que decidir
-- qué concilia ahora. Se reemplaza por tres invariantes que el modelo nuevo
-- (hold al invitar, captura al aceptar) SÍ puede violar — no existían en el
-- modelo viejo:
--
--   * escrow_captura_desbalance: el número de filas escrow_lock del ledger
--     tiene que igualar el número de órdenes capturadas. Una captura sin
--     ledger, o ledger sin captura, es una discrepancia.
--   * hold_huerfano: una orden preautorizada cuya invitación ya está
--     aceptada/rechazada/expirada — un hold que nadie capturó ni anuló,
--     dinero retenido en la tarjeta de alguien sin motivo. La discrepancia
--     más cara para el usuario final.
--   * anulada_con_ledger: una orden anulada con cualquier fila de ledger —
--     sería un cobro por algo que se rechazó.
--   * ledger_sin_orden: una fila de ledger de compra/fee/escrow_lock cuya
--     idempotency_key no corresponde a ninguna orden existente — cazaría a
--     alguien escribiendo ledger de compra a mano.
--
-- Base: 20260723160000_conciliacion_montos.sql, la ÚLTIMA migración que
-- define esta función — no 20260723150000, la original (misma trampa que
-- crear_invitacion/responder_invitacion: la segunda migración agregó una 5ª
-- invariante de montos que la primera no tiene).
--
-- Las invariantes 1/2/5 de esa base "sobreviven" según el plan, pero
-- sobrevivir no significaba copiarlas tal cual — tenían DOS defectos que
-- las habrían dejado muertas en silencio, encontrados leyéndolas antes de
-- escribir:
--   (a) comparaban `estado = 'confirmada'`, un estado que NINGUNA función
--       produce ya (captura exitosa es 'capturada' desde la Tarea 2);
--   (b) el join `l.referencia_id = o.id` comparaba contra el id de la
--       ORDEN, pero desde la Tarea 2 `referencia_id` apunta a la
--       INVITACIÓN ("la invitación es la compra").
--
-- Corrección adicional, encontrada en revisión antes del ALTO (no por mí):
-- unir por `o.invitacion_id` en vez de por `o.id` arregla el join pero abre
-- un FALSO POSITIVO real, no hipotético — es justo el camino de reintento
-- que la Tarea 3b diseñó a propósito: una invitación puede tener VARIAS
-- órdenes en el tiempo (el índice único parcial solo bloquea las vivas,
-- preautorizada/capturada; fallida/anulada se acumulan). Si la orden A de
-- una invitación queda `fallida` (tarjeta rechazada) y el rentador reintenta
-- con la orden B que sí se captura, un join por invitación le atribuye a A
-- el ledger de B — "A está fallida pero tiene 3 filas de ledger", una
-- discrepancia falsa sobre un flujo sano. Una conciliación que grita en el
-- camino normal se apaga sola: a la tercera alerta falsa nadie la mira.
--
-- El ledger SÍ se puede atribuir a su orden concreta: capturar_orden
-- escribe idempotency_key como `<orden_id>:compra` / `:fee` /
-- `:escrow_lock` — es el único vínculo que queda tras mover referencia_id a
-- la invitación. Las invariantes 1, 2, 6 y 7 (todo lo que pregunta "¿el
-- ledger DE ESTA ORDEN cuadra?") se atan por ese prefijo, no por
-- referencia_id. La invariante 3 (netea a 0 por grupo) y la nueva
-- ledger_sin_orden siguen razonando sobre referencia_id/idempotency_key
-- directo, sin pasar por ordenes_pago.

create or replace function public.detectar_discrepancias_sp3()
returns table (clase text, referencia uuid, detalle text)
language sql
security definer
set search_path = public
as $$
  -- 1. Orden capturada sin exactamente 3 filas de ledger (atribuidas por
  --    idempotency_key, no por invitación — ver nota de cabecera).
  select
    'orden_capturada_ledger_incompleto'::text,
    o.id,
    'orden capturada con ' || count(l.id) || ' filas de ledger (esperado 3)'
  from public.ordenes_pago o
  left join public.ledger l on l.idempotency_key like o.id::text || ':%'
  where o.estado = 'capturada'
  group by o.id
  having count(l.id) <> 3

  union all

  -- 2. Orden que no está capturada pero aun así tiene SU PROPIO ledger.
  select
    'orden_no_capturada_con_ledger'::text,
    o.id,
    o.estado::text || ' pero tiene ' || count(l.id) || ' filas de ledger'
  from public.ordenes_pago o
  join public.ledger l on l.idempotency_key like o.id::text || ':%'
  where o.estado <> 'capturada'
  group by o.id, o.estado

  union all

  -- 3. Grupo de ledger de una compra que no netea a 0. Agrupa por
  --    referencia_id (la invitación) sin pasar por ordenes_pago — no le
  --    afecta el reintento de varias órdenes por invitación.
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

  -- 4. Número de escrow_lock del ledger vs. número de órdenes capturadas —
  --    un desbalance global significa una captura sin su ledger, o ledger
  --    sin una captura real detrás.
  select
    'escrow_captura_desbalance'::text,
    null::uuid,
    'escrow_lock=' || (select count(*) from public.ledger where tipo = 'escrow_lock')
      || ' vs ordenes capturadas=' || (select count(*) from public.ordenes_pago where estado = 'capturada')
  where (select count(*) from public.ledger where tipo = 'escrow_lock')
     <> (select count(*) from public.ordenes_pago where estado = 'capturada')

  union all

  -- 5. Hold huérfano: orden preautorizada cuya invitación ya se resolvió.
  --    Nadie capturó ni anuló ese hold — dinero retenido sin motivo.
  select
    'hold_huerfano'::text,
    o.id,
    'orden preautorizada pero su invitación ya está ' || i.estado::text
  from public.ordenes_pago o
  join public.invitaciones i on i.id = o.invitacion_id
  where o.estado = 'preautorizada'
    and i.estado in ('aceptada', 'rechazada', 'expirada')

  union all

  -- 6. Orden anulada con SU PROPIO ledger (por idempotency_key, no por
  --    invitación): sería un cobro por algo que se rechazó. Un hold anulado
  --    no es un movimiento (spec §4).
  select
    'anulada_con_ledger'::text,
    o.id,
    'orden anulada pero tiene ' || count(l.id) || ' filas de ledger (esperado 0)'
  from public.ordenes_pago o
  join public.ledger l on l.idempotency_key like o.id::text || ':%'
  where o.estado = 'anulada'
  group by o.id

  union all

  -- 7. Ledger DE ESTA ORDEN (por idempotency_key) cuyos montos no coinciden
  --    con los congelados en ella. Caza grupos balanceados-pero-mal-
  --    preciados que la invariante 3 (netea a 0) dejaría pasar.
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
  join public.ledger l on l.idempotency_key like o.id::text || ':%'
  where o.estado = 'capturada'
  group by o.id, o.total, o.buyer_fee, o.valor_v
  having coalesce(sum(l.monto) filter (where l.tipo = 'compra'), 0) <> o.total
      or coalesce(sum(l.monto) filter (where l.tipo = 'fee'), 0) <> -o.buyer_fee
      or coalesce(sum(l.monto) filter (where l.tipo = 'escrow_lock'), 0) <> -o.valor_v

  union all

  -- 8. Ledger de compra/fee/escrow_lock cuya idempotency_key no corresponde
  --    a NINGUNA orden — se abrió al atribuir por orden en vez de por
  --    invitación (1/2/6/7): antes caía dentro de algún join por invitación
  --    y quedaba cubierto sin querer; ahora queda fuera de todo si no se
  --    prueba aparte. Cazaría a alguien escribiendo ledger de compra a mano.
  select
    'ledger_sin_orden'::text,
    l.referencia_id,
    'fila de ledger cuya idempotency_key no corresponde a ninguna orden: ' || l.idempotency_key
  from public.ledger l
  where l.tipo in ('compra', 'fee', 'escrow_lock')
    and not exists (
      select 1 from public.ordenes_pago o
      where l.idempotency_key like o.id::text || ':%'
    );
$$;

revoke execute on function public.detectar_discrepancias_sp3() from public;
revoke execute on function public.detectar_discrepancias_sp3() from authenticated, anon;
grant execute on function public.detectar_discrepancias_sp3() to service_role;
