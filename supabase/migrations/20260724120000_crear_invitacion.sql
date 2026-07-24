-- Fase 4.2 — Emitir propuesta + bloquear la bebida (crear_invitacion)
-- Sub-proyecto 4 (Invitaciones/chat). Único camino que crea una invitación /
-- solicitud y, en el caso de invitación de rentador, bloquea su bebida del bar.
--
-- Corre en UNA transacción con row lock (mismo patrón que confirmar_orden_pago):
--   * un fallo parcial no deja la invitación creada sin la bebida bloqueada, ni
--     la bebida bloqueada sin invitación;
--   * el emisor debe estar KYC-verificado (gate de negocio testeable acá, no solo
--     en el Edge Function — es la fuente de verdad);
--   * la bebida debe existir en el bar DEL EMISOR y estar `disponible`; pasa a
--     `bloqueada` (los fondos ya están en escrow desde la compra 3.1);
--   * idempotente por `idempotency_key`: un reintento del mismo intento devuelve
--     la fila ya creada SIN re-validar ni re-bloquear la bebida.
--
-- La invoca el Edge Function crear-invitacion (service_role). El cliente NO puede
-- ejecutarla (revoke execute): crear/mover invitaciones es server-side, igual que
-- ledger/bar/ordenes_pago. SECURITY DEFINER + search_path fijo: privilegios del
-- owner, no secuestrable por search_path, EXECUTE restringido a service_role.

-- ----------------------------------------------------------------------------
-- Idempotencia: clave por intento (la genera el cliente, la reusa en reintentos).
-- La fase 4.0 no la agregó porque aún no existía el Edge Function que la necesita.
-- Nullable: las filas legadas (si las hubiera) quedan sin key; Postgres permite
-- múltiples NULL en un unique. Las invitaciones nuevas siempre traen key.
-- ----------------------------------------------------------------------------
alter table public.invitaciones
  add column idempotency_key text;

create unique index invitaciones_idempotency_key_uq
  on public.invitaciones (idempotency_key);

-- ----------------------------------------------------------------------------
-- Función atómica.
-- ----------------------------------------------------------------------------
create or replace function public.crear_invitacion(
  p_emisor_id uuid,
  p_receptor_id uuid,
  p_tipo tipo_propuesta,
  p_bebida_bar_id uuid,
  p_tiempo_estimado_min integer,
  p_zona_aproximada text,
  p_idempotency_key text
)
returns public.invitaciones
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
  -- Idempotencia (fast-path): un reintento del mismo intento — cuando el primero
  -- ya se creó y committeó — devuelve la fila ya creada, sin volver a validar ni
  -- re-bloquear la bebida (que el primer intento ya dejó `bloqueada`).
  select * into v_inv
    from public.invitaciones
   where idempotency_key = p_idempotency_key;
  if found then
    return v_inv;
  end if;

  -- Gate de negocio: solo un emisor KYC-verificado puede emitir propuestas.
  select kyc_estado::text into v_kyc
    from public.profiles where id = p_emisor_id;
  if v_kyc is distinct from 'verificado' then
    raise exception 'emisor no verificado' using errcode = 'AY403';
  end if;

  -- Nadie se invita a sí mismo.
  if p_receptor_id = p_emisor_id then
    raise exception 'el receptor no puede ser el emisor' using errcode = 'AY400';
  end if;

  -- Coherencia por tipo (defensa en profundidad; el Edge Function ya la valida).
  if p_tipo = 'invitacion' and p_bebida_bar_id is null then
    raise exception 'una invitación requiere bebida' using errcode = 'AY400';
  end if;
  if p_tipo = 'solicitud' and p_bebida_bar_id is not null then
    raise exception 'una solicitud no lleva bebida' using errcode = 'AY400';
  end if;

  -- Reclama la idempotencia creando la fila PRIMERO (antes de bloquear la
  -- bebida). Así, ante un doble disparo concurrente con la misma key, el segundo
  -- pierde en el unique index (unique_violation → devuelve la fila ya creada), NO
  -- en el chequeo de disponibilidad de la bebida (que daría un falso "ya
  -- bloqueada"). La FK de bebida_bar_id se traduce a un 409 legible.
  begin
    insert into public.invitaciones
      (emisor_id, receptor_id, tipo, alcance, bebida_bar_id,
       tiempo_estimado_min, zona_aproximada, estado, idempotency_key)
    values
      (p_emisor_id, p_receptor_id, p_tipo, 'especifica', p_bebida_bar_id,
       p_tiempo_estimado_min, p_zona_aproximada, 'pendiente', p_idempotency_key)
    returning * into v_inv;
  exception
    when unique_violation then
      -- Carrera: otro request con la misma idempotency_key ganó. Devolvemos la
      -- fila ya creada; este intento no tocó la bebida.
      select * into v_inv
        from public.invitaciones
       where idempotency_key = p_idempotency_key;
      return v_inv;
    when foreign_key_violation then
      raise exception 'bebida no encontrada en tu bar' using errcode = 'AY409';
  end;

  -- Con la invitación ya reclamada, validamos y bloqueamos la bebida. Cualquier
  -- excepción de acá en adelante aborta toda la transacción → revierte el insert
  -- de arriba (atomicidad: invitación y bloqueo van juntos o no van).
  if p_tipo = 'invitacion' then
    -- Lock de la fila del bar: dos invitaciones concurrentes con la misma bebida
    -- se serializan; la segunda ve el estado ya resuelto y sale.
    select estado, perfil_id into v_bar_estado, v_bar_perfil
      from public.bar
     where id = p_bebida_bar_id
     for update;

    if v_bar_perfil is distinct from p_emisor_id then
      raise exception 'la bebida no es de tu bar' using errcode = 'AY409';
    end if;
    if v_bar_estado <> 'disponible' then
      raise exception 'la bebida no está disponible' using errcode = 'AY409';
    end if;

    update public.bar set estado = 'bloqueada' where id = p_bebida_bar_id;
  end if;

  return v_inv;
end;
$$;

-- Solo service_role ejecuta. El cliente jamás crea/bloquea por su cuenta.
revoke execute on function public.crear_invitacion(uuid, uuid, tipo_propuesta, uuid, integer, text, text) from public;
revoke execute on function public.crear_invitacion(uuid, uuid, tipo_propuesta, uuid, integer, text, text) from authenticated, anon;
grant execute on function public.crear_invitacion(uuid, uuid, tipo_propuesta, uuid, integer, text, text) to service_role;
