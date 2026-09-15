-- Fase E.3, Tarea 2 — calcular_desglose: el desglose de una compra, de solo
-- lectura, para que el cliente pueda mostrar el total ANTES de confirmar sin
-- calcularlo él mismo (regla de oro del proyecto — "el cliente nunca calcula
-- ni mueve saldo"). `valor_v` está en el catálogo y ya es visible; `buyer_fee`
-- se calculaba solo server-side y nada lo exponía — sin esta función, la
-- pantalla de proponer no podía enseñar el precio total antes de contratar.
--
-- Reduce deuda de paso: la fórmula del fee vivía en DOS sitios (TypeScript en
-- _shared/pagos.ts, SQL inline dentro de crear_invitacion y
-- responder_invitacion — docs/backlog.md, detectado en code-review de E.2a).
-- Esta función pasa a ser la ÚNICA copia en SQL; crear_invitacion y
-- responder_invitacion la llaman en vez de repetir el cálculo. TypeScript
-- sigue con su propia copia (calcularDesgloseCompra en _shared/pagos.ts) —
-- unificarla del todo es cuando los niveles (SP6) hagan el fee variable.
--
-- `stable` (no escribe nada, mismo resultado dentro de la misma transacción),
-- `security definer` para poder leer bebidas_catalogo sin depender de su
-- propia RLS, y EXECUTE concedido a `authenticated` — a diferencia de todo lo
-- demás en el flujo de dinero, esta la llama el cliente DIRECTO, no un Edge
-- Function: es de solo lectura, no toca dinero de nadie, no necesita
-- service_role.

create function public.calcular_desglose(p_bebida_catalogo_id uuid)
returns table (valor_v numeric(12, 2), buyer_fee numeric(12, 2), total numeric(12, 2))
language sql
stable
security definer
set search_path = public
as $$
  select
    b.valor_v,
    round(b.valor_v * 100 * 0.15) / 100.0 as buyer_fee,
    b.valor_v + round(b.valor_v * 100 * 0.15) / 100.0 as total
  from public.bebidas_catalogo b
  where b.id = p_bebida_catalogo_id
    and b.activo;
$$;

revoke execute on function public.calcular_desglose(uuid) from public;
revoke execute on function public.calcular_desglose(uuid) from anon;
grant execute on function public.calcular_desglose(uuid) to authenticated;

-- ----------------------------------------------------------------------------

create or replace function public.crear_invitacion(
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
  --
  -- El estado inicial ahora es condicional por tipo: una `invitacion` SÍ
  -- crea un hold (nace preautorizando, ver el bloque de abajo); una
  -- `solicitud` no tiene nada que preautorizar hasta que el rentador acepte,
  -- así que nace directo en pendiente — visible para su receptor de una.
  begin
    insert into public.invitaciones
      (emisor_id, receptor_id, tipo, alcance, bebida_catalogo_id,
       tiempo_estimado_min, zona_aproximada, estado, idempotency_key)
    values
      (p_emisor_id, p_receptor_id, p_tipo, 'especifica', p_bebida_catalogo_id,
       p_tiempo_estimado_min, p_zona_aproximada,
       (case when p_tipo = 'invitacion' then 'preautorizando' else 'pendiente' end)::estado_invitacion,
       p_idempotency_key)
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

    -- Desglose (E.3 Tarea 2): la fórmula vive ahora en calcular_desglose, la
    -- ÚNICA copia en SQL — antes se repetía inline acá y en
    -- responder_invitacion. calcular_desglose es `stable`, así que llamarla
    -- de nuevo tras el `for update` de arriba no reintroduce una carrera: ve
    -- la misma fila que acabamos de bloquear, dentro de la misma transacción.
    select buyer_fee, total into v_buyer_fee, v_total
      from public.calcular_desglose(p_bebida_catalogo_id);

    insert into public.ordenes_pago
      (perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
    values
      (p_emisor_id, v_inv.id, v_bebida.valor_v, v_buyer_fee, v_total, 'pendiente', 'mock');
  end if;

  return v_inv;
end;
$$;

-- ----------------------------------------------------------------------------

create or replace function public.responder_invitacion(
  p_receptor_id uuid,
  p_invitacion_id uuid,
  p_accion text,
  p_bebida_catalogo_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitaciones;
  v_kyc text;
  v_orden public.ordenes_pago;
  v_orden_found boolean;
  v_bebida record;
  v_buyer_fee numeric(12, 2);
  v_total numeric(12, 2);
begin
  -- Forma: acción válida (chequeo temprano, no necesita la fila).
  if p_accion not in ('aceptar', 'rechazar') then
    raise exception 'acción inválida' using errcode = 'AY400';
  end if;

  -- Lock de la INVITACIÓN primero (convención fijada en la Tarea 3b para
  -- toda la serie E: invitaciones antes que ordenes_pago, evita deadlock
  -- entre transacciones concurrentes que tomen los mismos dos locks en
  -- sentido opuesto). Dos respuestas concurrentes se serializan acá; la
  -- segunda ve el estado ya resuelto y sale por el camino idempotente.
  select * into v_inv
    from public.invitaciones
   where id = p_invitacion_id
   for update;

  if not found then
    raise exception 'invitación no encontrada' using errcode = 'AY404';
  end if;

  -- Solo el receptor responde. Fijado por la fila, no por el body.
  if v_inv.receptor_id is distinct from p_receptor_id then
    raise exception 'solo el receptor puede responder' using errcode = 'AY403';
  end if;

  -- Idempotente-benigno: una invitación ya resuelta no se re-aplica ni
  -- re-captura. Antes del gate KYC (mismo criterio que 20260724160000): un
  -- reintento sobre algo ya cerrado es benigno pase lo que pase con el
  -- estado KYC del receptor.
  if v_inv.estado <> 'pendiente' then
    return 'ya_resuelta';
  end if;

  -- ------------------------------------------------------------------ RECHAZAR
  -- No exige KYC: rechazar solo libera el hold, no compromete escrow.
  if p_accion = 'rechazar' then
    if p_bebida_catalogo_id is not null then
      raise exception 'rechazar no lleva bebida' using errcode = 'AY400';
    end if;

    -- Lock de la orden DESPUÉS de la invitación (mismo orden que arriba). Si
    -- ya está capturada, no se rechaza algo ya cobrado — falla en vez de
    -- silenciarlo: rechazar no puede deshacer un cargo real.
    --
    -- FOUND se guarda en v_orden_found de una: es una variable GLOBAL de
    -- plpgsql que CUALQUIER sentencia posterior (el update de abajo
    -- incluido) vuelve a pisar. Comprobarla después de ese update habría
    -- leído si el update afectó filas (siempre sí), no si esta select
    -- encontró la orden — exactamente el bug que atrapó el dry-run
    -- combinado antes de mandar esto a revisión: sin este fix, una
    -- solicitud (sin orden) intentaba anular un orden_id NULL.
    select * into v_orden
      from public.ordenes_pago
     where invitacion_id = p_invitacion_id
       and estado in ('preautorizada', 'capturada')
     for update;
    v_orden_found := found;

    if v_orden_found and v_orden.estado = 'capturada' then
      raise exception 'no se puede rechazar: la orden ya fue cobrada' using errcode = 'AY409';
    end if;

    update public.invitaciones set estado = 'rechazada' where id = p_invitacion_id;

    -- Si había un hold preautorizado (invitacion de rentador), se anula:
    -- libera sin escribir ledger. Una solicitud nunca tuvo orden hasta
    -- aceptarse → no encuentra nada, no hay nada que anular.
    if v_orden_found then
      perform public.capturar_orden(v_orden.id, 'anulada', null);
    end if;

    return 'rechazada';
  end if;

  -- ------------------------------------------------------------------- ACEPTAR
  -- Gate de negocio: solo un receptor KYC-verificado puede ACEPTAR (compromete
  -- escrow). Aplica a ambos tipos — invitacion y solicitud — porque las dos
  -- comprometen dinero al aceptar.
  select kyc_estado::text into v_kyc
    from public.profiles where id = p_receptor_id;
  if v_kyc is distinct from 'verificado' then
    raise exception 'receptor no verificado' using errcode = 'AY403';
  end if;

  if v_inv.tipo = 'invitacion' then
    -- El rentador ya eligió su bebida al crear la invitación (Tarea 3). No se
    -- asigna otra acá.
    if p_bebida_catalogo_id is not null then
      raise exception 'esta invitación ya tiene su bebida' using errcode = 'AY400';
    end if;

    -- El hold ya existe: lo dejó preautorizado confirmar_preautorizacion
    -- (Tarea 3b) antes de que esta invitación fuera visible para el
    -- receptor (Tarea 2b). Si no hay un hold vivo, no hay nada que capturar
    -- — un fallo real, no un caso silencioso. capturar_orden corre en la
    -- MISMA transacción: si lanza, aborta todo (invitación sigue pendiente,
    -- no se abre chat).
    select * into v_orden
      from public.ordenes_pago
     where invitacion_id = p_invitacion_id
       and estado = 'preautorizada'
     for update;

    if not found then
      raise exception 'la invitación no tiene un hold preautorizado' using errcode = 'AY409';
    end if;

    perform public.capturar_orden(v_orden.id, 'capturada', null);

    update public.invitaciones set estado = 'aceptada' where id = p_invitacion_id;

    -- Nace la cita (vacía, estado default 'pendiente'). Su sola existencia
    -- habilita el chat a las dos partes vía la RLS de citas/chat_mensajes (4.0).
    perform public.abrir_cita(p_invitacion_id);

    return 'aceptada';
  else
    -- `solicitud`: el receptor (rentador) DEBE asignar una bebida activa del
    -- catálogo. No hubo preautorización previa (Tarea 3c: una solicitud
    -- nace en pendiente, sin orden) — el dinero recién se compromete acá.
    -- Simétrico a crear_invitacion: SOLO prepara. La orden nace pendiente,
    -- la invitación pasa a preautorizando. Nada de captura, ledger ni cita
    -- todavía — eso lo hace confirmar_preautorizacion (Tarea 3b) cuando
    -- E.2b preautorice de verdad.
    if p_bebida_catalogo_id is null then
      raise exception 'debes asignar una bebida del catálogo' using errcode = 'AY400';
    end if;

    select valor_v, activo into v_bebida
      from public.bebidas_catalogo
     where id = p_bebida_catalogo_id
     for update;

    if not found or v_bebida.activo is distinct from true then
      raise exception 'la bebida no está disponible' using errcode = 'AY409';
    end if;

    -- Desglose (E.3 Tarea 2): misma fórmula, misma función que
    -- crear_invitacion — calcular_desglose es la ÚNICA copia en SQL.
    select buyer_fee, total into v_buyer_fee, v_total
      from public.calcular_desglose(p_bebida_catalogo_id);

    insert into public.ordenes_pago
      (perfil_id, invitacion_id, valor_v, buyer_fee, total, estado, provider)
    values
      (p_receptor_id, p_invitacion_id, v_bebida.valor_v, v_buyer_fee, v_total, 'pendiente', 'mock');

    update public.invitaciones
       set bebida_catalogo_id = p_bebida_catalogo_id, estado = 'preautorizando'
     where id = p_invitacion_id;

    return 'preautorizando';
  end if;
end;
$$;
