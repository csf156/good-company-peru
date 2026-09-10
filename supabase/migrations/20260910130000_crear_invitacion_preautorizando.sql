-- Fase E.2a, Tarea 3 — la invitación es la compra: crea su propia orden.
--
-- Reescribe crear_invitacion sobre el esquema de E.1: ya no bloquea una
-- bebida del `bar` (no existe), sino que calcula el desglose desde
-- `bebidas_catalogo` y crea la `orden_pago` en la misma transacción. La
-- invitación nace en `preautorizando` (spec §4, §4.1) — invisible para el
-- receptor bajo su RLS (Tarea 2b) hasta que la preautorización responda y la
-- mueva a `pendiente`, que es trabajo de E.2b.
--
-- Corrección al plan: la base de esta reescritura NO es
-- 20260724120000_crear_invitacion.sql (la versión original) sino
-- 20260724130000_invitacion_idempotency_scope.sql, la última que corre hoy.
-- Esa migración cerró un hallazgo real de seguridad (fuga cross-user: la
-- idempotencia era global, no por emisor) — partir de la original habría
-- reintroducido esa vulnerabilidad. Se conserva su fix intacto: idempotencia
-- SCOPED por (emisor_id, idempotency_key), fast-path y catch de carrera
-- filtrando por AMBOS.
--
-- Cambio de firma: p_bebida_bar_id pasa a p_bebida_catalogo_id. El tipo no
-- cambia (uuid), solo el nombre del parámetro — pero Postgres SÍ exige un
-- drop para eso: "create or replace" no permite renombrar un parámetro de
-- entrada aunque el tipo sea idéntico (falla con "cannot change name of
-- input parameter"), a diferencia de lo que decía este comentario en un
-- borrador anterior. El drop va PRIMERO (identifica la función por tipos,
-- no por nombres, así que apunta a la vieja sin ambigüedad); iría DESPUÉS
-- habría borrado la función recién creada, por tener la misma firma tipada.
drop function public.crear_invitacion(uuid, uuid, tipo_propuesta, uuid, integer, text, text);

create function public.crear_invitacion(
  p_emisor_id uuid,
  p_receptor_id uuid,
  p_tipo tipo_propuesta,
  p_bebida_catalogo_id uuid,
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
  v_bebida record;
  v_buyer_fee numeric(12, 2);
  v_total numeric(12, 2);
begin
  -- Idempotencia (fast-path) SCOPED por emisor: un reintento del mismo
  -- intento —mismo emisor + misma key— devuelve la fila ya creada, sin
  -- revalidar ni crear una segunda orden. La misma key desde OTRO emisor NO
  -- es idempotente acá: sigue por sus propios méritos (nunca se filtra la
  -- invitación de un emisor a otro).
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
  if p_tipo = 'invitacion' and p_bebida_catalogo_id is null then
    raise exception 'una invitación requiere bebida' using errcode = 'AY400';
  end if;
  if p_tipo = 'solicitud' and p_bebida_catalogo_id is not null then
    raise exception 'una solicitud no lleva bebida' using errcode = 'AY400';
  end if;

  -- Reclama la idempotencia creando la fila PRIMERO (antes de tocar el
  -- catálogo/crear la orden) — mismo patrón que la versión anterior. Ante un
  -- doble disparo concurrente con el mismo emisor+key, el segundo pierde en
  -- el unique index (unique_violation → devuelve la fila ya creada), no en
  -- ningún chequeo posterior.
  begin
    insert into public.invitaciones
      (emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id,
       tiempo_estimado_min, zona_aproximada, estado, idempotency_key)
    values
      (p_emisor_id, p_receptor_id, p_tipo, 'especifica', p_bebida_catalogo_id,
       p_tiempo_estimado_min, p_zona_aproximada, 'preautorizando', p_idempotency_key)
    returning * into v_inv;
  exception
    when unique_violation then
      select * into v_inv
        from public.invitaciones
       where emisor_id = p_emisor_id
         and idempotency_key = p_idempotency_key;
      return v_inv;
    when foreign_key_violation then
      raise exception 'bebida no encontrada en el catálogo' using errcode = 'AY409';
  end;

  -- Con la invitación ya reclamada, calculamos el desglose y creamos la
  -- orden. Cualquier excepción de acá en adelante aborta toda la
  -- transacción → revierte el insert de arriba (atomicidad: invitación y
  -- orden van juntas o no van).
  if p_tipo = 'invitacion' then
    select valor_v, activo into v_bebida
      from public.bebidas_catalogo
     where id = p_bebida_catalogo_id
     for update;

    if not found or v_bebida.activo is distinct from true then
      raise exception 'la bebida no está disponible' using errcode = 'AY409';
    end if;

    -- Desglose en centavos, igual que calcularDesgloseCompra en TypeScript
    -- (supabase/functions/_shared/pagos.ts) — deuda anotada en
    -- docs/backlog.md: el fee vive en dos sitios, se unifica cuando los
    -- niveles (SP6) lo hagan variable.
    v_buyer_fee := round(v_bebida.valor_v * 100 * 0.15) / 100.0;
    v_total := v_bebida.valor_v + v_buyer_fee;

    insert into public.ordenes_pago
      (perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
    values
      (p_emisor_id, v_inv.id, v_bebida.valor_v, v_buyer_fee, v_total, 'pendiente', 'mock');
  end if;

  return v_inv;
end;
$$;

-- Solo service_role ejecuta. El cliente jamás crea/paga por su cuenta.
revoke execute on function public.crear_invitacion(uuid, uuid, tipo_propuesta, uuid, integer, text, text) from public;
revoke execute on function public.crear_invitacion(uuid, uuid, tipo_propuesta, uuid, integer, text, text) from authenticated, anon;
grant execute on function public.crear_invitacion(uuid, uuid, tipo_propuesta, uuid, integer, text, text) to service_role;
