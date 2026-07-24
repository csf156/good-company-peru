-- Fase 4.2 (endurecimiento post-review) — idempotencia SCOPED por emisor
-- Cierra el hallazgo del code-review de seguridad: `idempotency_key` en
-- `invitaciones` era globalmente única y el fast-path de `crear_invitacion`
-- devolvía la fila completa (receptor_id, bebida_bar_id, zona, tiempo) ANTES de
-- los chequeos de KYC/auto-invitación y SIN verificar que el `emisor_id` de la
-- fila coincidiera con el `p_emisor_id` del llamante. Consecuencia: el usuario B
-- (aun sin KYC) que reusara la key del usuario A recibía la invitación de A →
-- fuga cross-user.
--
-- Fix: la idempotencia es por-INTENTO y el intento pertenece a UN emisor. Se
-- reescopa a (emisor_id, idempotency_key):
--   * el índice único pasa de (idempotency_key) a (emisor_id, idempotency_key);
--   * el fast-path filtra por AMBOS → una key de otro emisor NO es idempotente,
--     cae al insert real (que ahora no choca, la clave compuesta difiere) o a la
--     verdadera carrera del mismo emisor+key.
--
-- Aditivo (convención del repo): NO edita 20260724120000 in-place; dropea el
-- índice viejo, crea el compuesto y hace create-or-replace del cuerpo.

-- ----------------------------------------------------------------------------
-- Índice único: de global a compuesto por emisor.
-- (Postgres permite múltiples NULL en un unique, incluido el compuesto: las
-- filas legadas sin key siguen sin colisionar.)
-- ----------------------------------------------------------------------------
drop index if exists public.invitaciones_idempotency_key_uq;

create unique index invitaciones_emisor_idempotency_key_uq
  on public.invitaciones (emisor_id, idempotency_key);

-- ----------------------------------------------------------------------------
-- Función atómica: fast-path y catch de carrera ahora scoped por (emisor, key).
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
  -- Idempotencia (fast-path) SCOPED por emisor: un reintento del mismo intento
  -- —mismo emisor + misma key, cuando el primero ya se creó y committeó— devuelve
  -- la fila ya creada, sin revalidar ni re-bloquear la bebida. La misma key desde
  -- OTRO emisor NO es idempotente: no matchea acá y sigue por sus propios méritos
  -- (así nunca se filtra la invitación de un emisor a otro).
  select * into v_inv
    from public.invitaciones
   where emisor_id = p_emisor_id
     and idempotency_key = p_idempotency_key;
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
  -- bebida). Así, ante un doble disparo concurrente con el mismo emisor+key, el
  -- segundo pierde en el unique index (unique_violation → devuelve la fila ya
  -- creada), NO en el chequeo de disponibilidad de la bebida (que daría un falso
  -- "ya bloqueada"). La FK de bebida_bar_id se traduce a un 409 legible.
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
      -- Carrera: otro request con el mismo emisor+idempotency_key ganó. Devolvemos
      -- la fila ya creada; este intento no tocó la bebida.
      select * into v_inv
        from public.invitaciones
       where emisor_id = p_emisor_id
         and idempotency_key = p_idempotency_key;
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
