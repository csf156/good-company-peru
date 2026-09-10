-- Fase E.2a, Tarea 2 — capturar_orden reemplaza a confirmar_orden_pago.
--
-- La Fase 3.1 movía el dinero al "comprar" (pendiente → confirmada/fallida) y
-- ponía la bebida disponible en `bar`. E.1 (spec §3.1, §4) mueve ese momento:
-- la invitación es la compra, el pago se PREAUTORIZA al invitar y se CAPTURA
-- (o se ANULA) al responder. `bar` no existe más; esta función no la
-- sustituye por nada — la bebida ya no es un objeto de stock.
--
-- Mismo patrón de atomicidad que la función vieja: row lock (una sola
-- transacción, un fallo parcial no deja la orden resuelta sin su ledger), CAS
-- de estado (idempotente ante reintento/doble invocación), SECURITY DEFINER +
-- search_path fijo, EXECUTE solo para service_role.
--
-- El CAS distingue dos casos que antes eran uno solo ("no está pendiente" =
-- ya_resuelta): si el estado actual coincide EXACTO con lo que se pide, es un
-- reintento de la misma operación → idempotente, 'ya_resuelta'. Si el estado
-- actual es distinto de 'preautorizada' Y distinto del resultado pedido, es
-- una transición ilegal (capturar algo anulado, anular algo ya capturado,
-- capturar algo que nunca tuvo hold) → excepción, no un silencio.

create or replace function public.capturar_orden(
  p_orden_id uuid,
  p_resultado estado_orden,
  p_provider_ref text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden public.ordenes_pago;
begin
  if p_resultado not in ('capturada', 'anulada', 'fallida') then
    raise exception 'resultado inválido: %', p_resultado;
  end if;

  -- Lock de la orden. Dos invocaciones concurrentes (reintento del provider,
  -- o webhook + reintento manual) se serializan aquí.
  select * into v_orden
    from public.ordenes_pago
   where id = p_orden_id
   for update;

  if not found then
    raise exception 'orden no encontrada: %', p_orden_id;
  end if;

  -- Reintento de la MISMA operación ya aplicada: idempotente, no falla.
  if v_orden.estado = p_resultado then
    return 'ya_resuelta';
  end if;

  -- Cualquier otro estado que no sea 'preautorizada' es una transición
  -- ilegal: no se captura un hold anulado, no se anula un hold ya capturado,
  -- no se captura una orden que nunca tuvo preautorización.
  if v_orden.estado <> 'preautorizada' then
    raise exception 'la orden % está en estado % y no se puede pasar a %',
      p_orden_id, v_orden.estado, p_resultado;
  end if;

  update public.ordenes_pago
     set estado = p_resultado,
         provider_ref = coalesce(p_provider_ref, provider_ref)
   where id = p_orden_id;

  if p_resultado = 'capturada' then
    -- Misma terna que la función vieja (spec §4): compra (+total), fee
    -- (−buyer_fee), escrow_lock (−valor_v) — netean a 0, capturar no da
    -- saldo disponible a nadie. Lo que cambia es referencia_id: apunta a la
    -- invitación (v_orden.invitacion_id), no a la orden — la invitación es
    -- la compra. idempotency_key sigue derivada del id de LA ORDEN, no de la
    -- invitación: si se cambiara, un reintento con una orden distinta sobre
    -- la misma invitación colisionaría contra la unique de idempotency_key.
    insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
    values
      (v_orden.perfil_id, 'compra', v_orden.total, v_orden.invitacion_id, p_orden_id::text || ':compra'),
      (v_orden.perfil_id, 'fee', -v_orden.buyer_fee, v_orden.invitacion_id, p_orden_id::text || ':fee'),
      (v_orden.perfil_id, 'escrow_lock', -v_orden.valor_v, v_orden.invitacion_id, p_orden_id::text || ':escrow_lock');
  end if;

  -- anulada / fallida: no escriben ledger. Un hold liberado o nunca cobrado
  -- no es un movimiento de dinero.

  return 'aplicada';
end;
$$;

-- La función vieja escribía en `bar`, que ya no existe: dejarla viva sería
-- dejar una puerta que falla en runtime, no una alternativa válida.
drop function public.confirmar_orden_pago(uuid, estado_orden, text);

-- Solo service_role ejecuta. El cliente jamás captura/anula su propio hold.
revoke execute on function public.capturar_orden(uuid, estado_orden, text) from public;
revoke execute on function public.capturar_orden(uuid, estado_orden, text) from authenticated, anon;
grant execute on function public.capturar_orden(uuid, estado_orden, text) to service_role;
