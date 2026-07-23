-- Fase 3.1 — Confirmación atómica de una orden de pago
-- Sub-proyecto 3. Único camino que mueve una compra a escrow. Corre en UNA
-- transacción con row lock, así:
--   * un fallo parcial no deja la orden confirmada sin su ledger/bar;
--   * un webhook duplicado (o replay) no duplica la bebida ni el ledger
--     (idempotencia por lock + chequeo de estado + unique del ledger);
--   * un pago fallido no crea stock.
--
-- La invocan los Edge Functions comprar-bebida (modo mock, inline) y
-- pago-webhook (modo Red Pontis real), ambos con service_role. El cliente NO
-- puede ejecutarla (revoke execute) — si no, se auto-confirmaría un pago sin
-- cobro real.
--
-- SECURITY DEFINER + search_path fijo: se ejecuta con privilegios del owner y
-- no es secuestrable por search_path. Aun así se restringe el EXECUTE a
-- service_role, que es quien la llama.

create or replace function public.confirmar_orden_pago(
  p_orden_id uuid,
  p_resultado estado_orden,
  p_escrow_ref text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden public.ordenes_pago;
begin
  if p_resultado not in ('confirmada', 'fallida') then
    raise exception 'resultado inválido: %', p_resultado;
  end if;

  -- Lock de la orden. Dos webhooks concurrentes se serializan aquí; el segundo
  -- ve el estado ya resuelto y sale sin reprocesar.
  select * into v_orden
    from public.ordenes_pago
   where id = p_orden_id
   for update;

  if not found then
    raise exception 'orden no encontrada: %', p_orden_id;
  end if;

  -- Idempotente: solo se procesa una orden aún pendiente.
  if v_orden.estado <> 'pendiente' then
    return 'ya_resuelta';
  end if;

  update public.ordenes_pago set estado = p_resultado where id = p_orden_id;

  if p_resultado = 'confirmada' then
    -- Ledger de compra (append-only), desde la perspectiva del balance del
    -- rentador: compra (+total), fee (−buyer_fee), escrow_lock (−V). Netean a
    -- 0 → comprar no da saldo disponible; el dinero queda en escrow (su bar).
    -- idempotency_key derivada del id de la orden (unique → defensa extra
    -- contra doble escritura).
    insert into public.ledger (perfil_id, tipo, monto, referencia_id, idempotency_key)
    values
      (v_orden.perfil_id, 'compra', v_orden.total, p_orden_id, p_orden_id::text || ':compra'),
      (v_orden.perfil_id, 'fee', -v_orden.buyer_fee, p_orden_id, p_orden_id::text || ':fee'),
      (v_orden.perfil_id, 'escrow_lock', -v_orden.valor_v, p_orden_id, p_orden_id::text || ':escrow_lock');

    -- Bebida al bar del rentador, disponible, ligada a la subcuenta de escrow.
    insert into public.bar (perfil_id, bebida_id, estado, escrow_ref)
    values (v_orden.perfil_id, v_orden.bebida_catalogo_id, 'disponible', p_escrow_ref);
  end if;

  return 'aplicada';
end;
$$;

-- Solo service_role ejecuta. El cliente jamás confirma su propio pago.
revoke execute on function public.confirmar_orden_pago(uuid, estado_orden, text) from public;
revoke execute on function public.confirmar_orden_pago(uuid, estado_orden, text) from authenticated, anon;
grant execute on function public.confirmar_orden_pago(uuid, estado_orden, text) to service_role;
