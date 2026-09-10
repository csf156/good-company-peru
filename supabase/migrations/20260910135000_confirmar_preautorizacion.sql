-- Fase E.2a, Tarea 3b — la pieza que faltaba entre crear_invitacion y
-- responder_invitacion.
--
-- crear_invitacion (Tarea 3) deja la invitación en `preautorizando` y su
-- orden en `pendiente`. Nada las movía de ahí: la preautorización real (el
-- fetch al proveedor) es de E.2b, pero el resultado de esa llamada tiene que
-- escribirse en DOS filas acopladas (orden + invitación) de forma atómica —
-- si se hiciera con dos updates sueltos desde el Edge Function, un fallo
-- entre medias dejaría una orden preautorizada con su invitación invisible
-- para siempre, o al revés. Por eso es SQL, de esta fase.
--
-- `abrir_cita` se extrae acá porque la necesitan DOS caminos: esta función
-- (solicitud aceptada de una) y responder_invitacion (Tarea 4, invitación
-- aceptada). Duplicar el insert habría sido garantía de que una de las dos
-- copias se quedara atrás en algún cambio futuro.

create function public.abrir_cita(p_invitacion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nace vacía (estado default 'pendiente'). Su sola existencia habilita el
  -- chat a las dos partes vía la RLS de citas/chat_mensajes (4.0).
  insert into public.citas (invitacion_id) values (p_invitacion_id);
end;
$$;

revoke execute on function public.abrir_cita(uuid) from public;
revoke execute on function public.abrir_cita(uuid) from authenticated, anon;
grant execute on function public.abrir_cita(uuid) to service_role;

-- ----------------------------------------------------------------------------

create function public.confirmar_preautorizacion(
  p_orden_id uuid,
  p_ok boolean,
  p_provider_ref text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden public.ordenes_pago;
  v_inv public.invitaciones;
  v_invitacion_id uuid;
  v_target_orden estado_orden;
begin
  -- Lectura SIN lock, solo para saber a qué invitación pertenece la orden.
  -- El lock real llega después, en el orden correcto (ver abajo).
  select invitacion_id into v_invitacion_id
    from public.ordenes_pago
   where id = p_orden_id;

  if not found then
    raise exception 'orden no encontrada: %', p_orden_id;
  end if;

  -- Lock de la INVITACIÓN primero, orden DESPUÉS — misma convención que
  -- responder_invitacion (20260724160000): invitaciones antes que
  -- ordenes_pago. Si el orden fuera al revés, dos transacciones concurrentes
  -- que tomen los mismos dos locks en sentido opuesto (un reintento de
  -- webhook solapado con una respuesta del usuario, por ejemplo) podrían
  -- deadlockear — Postgres mata una con "deadlock detected".
  select * into v_inv
    from public.invitaciones
   where id = v_invitacion_id
   for update;

  if not found then
    raise exception 'invitación no encontrada para la orden %', p_orden_id;
  end if;

  select * into v_orden
    from public.ordenes_pago
   where id = p_orden_id
   for update;

  if not found then
    raise exception 'orden no encontrada: %', p_orden_id;
  end if;

  -- El destino de la orden depende de si la preautorización respondió ok Y
  -- del tipo de invitación: una `invitacion` solo preautoriza (el amigo
  -- todavía tiene que aceptar); una `solicitud` ya tiene el acuerdo cerrado
  -- (el rentador ya aceptó), así que captura de una.
  v_target_orden := case
    when not p_ok then 'fallida'
    when v_inv.tipo = 'invitacion' then 'preautorizada'
    else 'capturada'
  end;

  -- Reintento de la MISMA operación ya aplicada: idempotente. Va ANTES de la
  -- guarda de estado de la invitación (justo abajo): un reintento legítimo
  -- sobre una invitación que YA se movió de preautorizando (a pendiente,
  -- aceptada, o de vuelta a pendiente tras un fallo de solicitud) tiene que
  -- seguir devolviendo ya_resuelta, no reventar contra esa guarda.
  if v_orden.estado = v_target_orden then
    return 'ya_resuelta';
  end if;

  -- Guarda de estado de la invitación: que orden e invitación viajen
  -- acopladas es una propiedad del código que las crea (crear_invitacion),
  -- no del esquema — este proyecto no confía en eso en ningún otro lado, y
  -- acá tampoco. Después del cortocircuito de arriba a propósito.
  if v_inv.estado <> 'preautorizando' then
    raise exception 'la invitación % está en estado % y no espera preautorización',
      v_invitacion_id, v_inv.estado;
  end if;

  -- Cualquier otro estado de la orden que no sea 'pendiente' es una
  -- transición ilegal — mismo criterio que capturar_orden (Tarea 2).
  if v_orden.estado <> 'pendiente' then
    raise exception 'la orden % está en estado % y no se puede confirmar',
      p_orden_id, v_orden.estado;
  end if;

  if not p_ok then
    update public.ordenes_pago
       set estado = 'fallida', provider_ref = coalesce(p_provider_ref, provider_ref)
     where id = p_orden_id;

    -- Una `invitacion` que nunca preautorizó expira: nunca fue visible para
    -- nadie, el rentador simplemente vuelve a invitar. Una `solicitud` NO:
    -- el amigo ya la mandó y el rentador ya la aceptó — que falle la tarjeta
    -- del rentador es un problema del rentador, no motivo para matar la
    -- petición del amigo. Vuelve a pendiente; el índice único parcial solo
    -- bloquea órdenes preautorizada/capturada vivas, así que un reintento
    -- del rentador con otra tarjeta crea su propia orden sin colisionar.
    update public.invitaciones
       set estado = (case when v_inv.tipo = 'invitacion' then 'expirada' else 'pendiente' end)::estado_invitacion
     where id = v_invitacion_id;
    return 'aplicada';
  end if;

  if v_inv.tipo = 'invitacion' then
    -- Solo se preautoriza. Recién ahora la invitación es visible para el
    -- amigo (Tarea 2b) — todavía no hay captura, eso lo hace
    -- responder_invitacion (Tarea 4) cuando el amigo acepte.
    update public.ordenes_pago
       set estado = 'preautorizada', provider_ref = coalesce(p_provider_ref, provider_ref)
     where id = p_orden_id;
    update public.invitaciones set estado = 'pendiente' where id = v_invitacion_id;
  else
    -- `solicitud`: el acuerdo ya está cerrado (el amigo pidió, el rentador
    -- aceptó al llamar a responder_invitacion en la Tarea 4) — no hay a quién
    -- esperar. Se marca preautorizada primero y se captura en el mismo acto,
    -- reusando capturar_orden (Tarea 2) en vez de duplicar su bloque de
    -- ledger — corre dentro de esta misma transacción, así que la
    -- atomicidad se mantiene igual.
    update public.ordenes_pago
       set estado = 'preautorizada', provider_ref = coalesce(p_provider_ref, provider_ref)
     where id = p_orden_id;
    perform public.capturar_orden(p_orden_id, 'capturada', p_provider_ref);
    update public.invitaciones set estado = 'aceptada' where id = v_invitacion_id;
    perform public.abrir_cita(v_invitacion_id);
  end if;

  return 'aplicada';
end;
$$;

-- Solo service_role ejecuta. El cliente jamás confirma su propia preautorización.
revoke execute on function public.confirmar_preautorizacion(uuid, boolean, text) from public;
revoke execute on function public.confirmar_preautorizacion(uuid, boolean, text) from authenticated, anon;
grant execute on function public.confirmar_preautorizacion(uuid, boolean, text) to service_role;
