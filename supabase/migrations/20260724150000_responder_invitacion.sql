-- Fase 4.3 — Responder una propuesta (aceptar / rechazar) → abre chat
-- Sub-proyecto 4 (Invitaciones/chat). Único camino que resuelve una invitación
-- pendiente desde el lado del receptor. Corre en UNA transacción con row lock,
-- así (mismo patrón que crear_invitacion / confirmar_orden_pago):
--   * solo el RECEPTOR de la invitación responde (ni el emisor ni un tercero) —
--     los actores están fijados por la fila, no vienen del body (anti-suplantación);
--   * el receptor debe estar KYC-verificado: aceptar una `solicitud` compromete
--     una bebida en escrow de su bar (mismo nivel de sensibilidad que crear_invitacion),
--     así que se exige verificación para responder (fuente de verdad testeable acá);
--   * RECHAZAR: invitación → 'rechazada'; si era una `invitacion` de rentador
--     (bebida ya bloqueada desde 4.2), libera esa bebida `bloqueada`→`disponible`.
--     Una `solicitud` de amigo nunca tuvo bebida: no hay nada que liberar;
--   * ACEPTAR: invitación → 'aceptada' y crea la fila `citas` (con su estado
--     default 'pendiente' — la cita nace vacía; los detalles zona/hora/mensaje y
--     la transición a 'confirmada' son la fase 4.5). Si es una `solicitud`, el
--     receptor-rentador DEBE asignar una bebida disponible de SU bar, que se
--     bloquea `disponible`→`bloqueada` (mismo bloqueo atómico que crear_invitacion);
--   * idempotente-benigno: si la invitación ya no está `pendiente` (doble tap /
--     reintento), devuelve 'ya_resuelta' sin re-aplicar — mismo criterio que
--     confirmar_orden_pago ('ya_resuelta'), NO un `idempotency_key` (esta función
--     MUTA una fila existente por su id; el reintento seguro es el chequeo de estado).
--
-- La invoca el Edge Function responder-invitacion (service_role). El cliente NO
-- puede ejecutarla (revoke execute): mover el estado de invitaciones/citas/bar es
-- server-side, igual que ledger/bar/ordenes_pago. SECURITY DEFINER + search_path
-- fijo: privilegios del owner, no secuestrable por search_path, EXECUTE solo a
-- service_role.
--
-- Devuelve un texto de resultado: 'aceptada' | 'rechazada' | 'ya_resuelta'.
-- Errcodes: AY400 forma/coherencia · AY403 no-receptor / no-verificado ·
-- AY404 invitación inexistente · AY409 conflicto de bebida.

create or replace function public.responder_invitacion(
  p_receptor_id uuid,
  p_invitacion_id uuid,
  p_accion text,
  p_bebida_bar_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitaciones;
  v_kyc text;
  v_bar_estado estado_bar;
  v_bar_perfil uuid;
begin
  -- Forma: acción válida (chequeo temprano, no necesita la fila).
  if p_accion not in ('aceptar', 'rechazar') then
    raise exception 'acción inválida' using errcode = 'AY400';
  end if;

  -- Lock de la invitación: dos respuestas concurrentes se serializan; la segunda
  -- ve el estado ya resuelto y sale por el camino idempotente-benigno.
  select * into v_inv
    from public.invitaciones
   where id = p_invitacion_id
   for update;

  if not found then
    raise exception 'invitación no encontrada' using errcode = 'AY404';
  end if;

  -- Solo el receptor responde. Fijado por la fila (no por el body): el emisor no
  -- puede aceptar/rechazar su propia propuesta, y un tercero tampoco. (Una
  -- invitación `global` de SP2 tiene receptor_id null → nadie la responde aún.)
  if v_inv.receptor_id is distinct from p_receptor_id then
    raise exception 'solo el receptor puede responder' using errcode = 'AY403';
  end if;

  -- Idempotente-benigno: una invitación ya resuelta no se re-aplica. Va ANTES del
  -- gate KYC: un reintento sobre una invitación ya cerrada es benigno pase lo que
  -- pase con el estado KYC del receptor.
  if v_inv.estado <> 'pendiente' then
    return 'ya_resuelta';
  end if;

  -- Gate de negocio: solo un receptor KYC-verificado puede responder (aceptar
  -- compromete escrow de su bar). Fuente de verdad acá, no solo en el Edge Function.
  select kyc_estado::text into v_kyc
    from public.profiles where id = p_receptor_id;
  if v_kyc is distinct from 'verificado' then
    raise exception 'receptor no verificado' using errcode = 'AY403';
  end if;

  -- ------------------------------------------------------------------ RECHAZAR
  if p_accion = 'rechazar' then
    -- Rechazar no toma bebida (defensa en profundidad; el Edge Function ya lo valida).
    if p_bebida_bar_id is not null then
      raise exception 'rechazar no lleva bebida' using errcode = 'AY400';
    end if;

    update public.invitaciones set estado = 'rechazada' where id = p_invitacion_id;

    -- Si era una `invitacion` de rentador, su bebida quedó `bloqueada` en 4.2:
    -- se libera. Una `solicitud` nunca tuvo bebida (bebida_bar_id null) → nada
    -- que liberar. Lock de la fila del bar por consistencia con crear_invitacion.
    if v_inv.bebida_bar_id is not null then
      select estado into v_bar_estado
        from public.bar
       where id = v_inv.bebida_bar_id
       for update;
      if v_bar_estado = 'bloqueada' then
        update public.bar set estado = 'disponible' where id = v_inv.bebida_bar_id;
      end if;
    end if;

    return 'rechazada';
  end if;

  -- ------------------------------------------------------------------- ACEPTAR
  if v_inv.tipo = 'invitacion' then
    -- El rentador ya eligió y bloqueó su bebida en 4.2. No se asigna otra.
    if p_bebida_bar_id is not null then
      raise exception 'esta invitación ya tiene su bebida' using errcode = 'AY400';
    end if;
  else
    -- `solicitud`: el receptor (rentador) DEBE asignar una bebida disponible de
    -- SU bar; se bloquea. Mismo bloqueo atómico que crear_invitacion (lock, valida
    -- dueño + disponible, actualiza estado). Si un paso falla, la transacción
    -- entera revierte (aceptar + bloqueo + cita van juntos o no van).
    if p_bebida_bar_id is null then
      raise exception 'debes asignar una bebida de tu bar' using errcode = 'AY400';
    end if;

    select estado, perfil_id into v_bar_estado, v_bar_perfil
      from public.bar
     where id = p_bebida_bar_id
     for update;

    if v_bar_perfil is distinct from p_receptor_id then
      raise exception 'la bebida no es de tu bar' using errcode = 'AY409';
    end if;
    if v_bar_estado <> 'disponible' then
      raise exception 'la bebida no está disponible' using errcode = 'AY409';
    end if;

    update public.bar set estado = 'bloqueada' where id = p_bebida_bar_id;
    update public.invitaciones set bebida_bar_id = p_bebida_bar_id where id = p_invitacion_id;
  end if;

  update public.invitaciones set estado = 'aceptada' where id = p_invitacion_id;

  -- Nace la cita (vacía, estado default 'pendiente'). Su sola existencia habilita
  -- el chat a las dos partes vía la RLS de `citas`/`chat_mensajes` (4.0).
  insert into public.citas (invitacion_id) values (p_invitacion_id);

  -- TODO(push): notificar a la contraparte — ver docs/backlog.md

  return 'aceptada';
end;
$$;

-- Solo service_role ejecuta. El cliente jamás resuelve una invitación por su cuenta.
revoke execute on function public.responder_invitacion(uuid, uuid, text, uuid) from public;
revoke execute on function public.responder_invitacion(uuid, uuid, text, uuid) from authenticated, anon;
grant execute on function public.responder_invitacion(uuid, uuid, text, uuid) to service_role;
