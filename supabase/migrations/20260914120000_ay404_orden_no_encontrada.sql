-- Fase E.2b, Tarea 4b — AY404 en "orden no encontrada".
--
-- capturar_orden (E.2a Tarea 2) y confirmar_preautorizacion (E.2a Tarea 3b)
-- lanzaban 'orden no encontrada: %' sin errcode propio (P0001, el genérico
-- de plpgsql) — pago-webhook (E.2b Tarea 4) distinguía 404 (no reintentar)
-- de 500 (sí reintentar) leyendo el TEXTO del mensaje
-- (`error.message.startsWith('orden no encontrada')`), porque era lo único
-- disponible. Riesgo real (BRAIN, revisando la Tarea 4): si una migración
-- futura retoca la redacción del mensaje —traducirlo, agregar un prefijo,
-- cambiar "orden" por "orden de pago"— el webhook empieza a devolver 500
-- donde debía devolver 404, y ningún test lo nota: la lógica de mapeo está
-- cubierta en pagos.test.ts, pero esa comparación de string concreta no la
-- ejecuta nadie.
--
-- Este repo ya resolvió exactamente este problema en otro lado:
-- crear_invitacion/responder_invitacion/confirmar_cita emiten AY400/AY403/
-- AY404/AY409 desde el día que se escribieron, y sus Edge Functions mapean
-- por `error.code`, nunca por texto. capturar_orden/confirmar_preautorizacion
-- (E.2a, antes de que ese criterio se afianzara) quedaron como la excepción.
-- Se alinean acá: mismo AY404 que usan las demás, mismo criterio.
--
-- create or replace basta — ninguna firma cambia (mismos parámetros, mismo
-- tipo de retorno), solo se le agrega `using errcode = 'AY404'` a cada
-- `raise exception 'orden no encontrada: %'` (tres en total: uno en
-- capturar_orden, dos en confirmar_preautorizacion — la lectura temprana sin
-- lock y la re-lectura defensiva después del lock). NO se toca el tercer
-- `raise` de confirmar_preautorizacion ('invitación no encontrada para la
-- orden %') — es un caso distinto (integridad de datos, no alcanzable en la
-- práctica: ordenes_pago.invitacion_id tiene FK a invitaciones, Postgres ya
-- impide borrar la invitación mientras la orden exista) y no es lo que
-- pago-webhook necesita distinguir.

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
    raise exception 'orden no encontrada: %', p_orden_id using errcode = 'AY404';
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

-- ----------------------------------------------------------------------------

create or replace function public.confirmar_preautorizacion(
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
    raise exception 'orden no encontrada: %', p_orden_id using errcode = 'AY404';
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
    raise exception 'orden no encontrada: %', p_orden_id using errcode = 'AY404';
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
