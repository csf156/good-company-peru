-- Fase E.2a, Tarea 4 — aceptar captura el hold, rechazar lo anula.
--
-- Reescribe responder_invitacion sobre el esquema de E.1: ya no libera/asigna
-- bebidas del `bar` (no existe), sino que captura o anula la orden de la
-- invitación vía `capturar_orden` (Tarea 2). Conserva intacto el fix
-- post-review de 20260724160000: el gate KYC aplica SOLO a aceptar, nunca a
-- rechazar — rechazar no compromete escrow, y gatearlo dejaría un hold sin
-- camino de liberación para un receptor no verificado.
--
-- Base: 20260724160000_responder_invitacion_kyc_scope.sql, la ÚLTIMA
-- migración que define esta función hoy (no 20260724150000, la original —
-- misma trampa que en la Tarea 3: usar la primera habría perdido el fix de
-- seguridad de la segunda). Verificado por introspección antes de escribir:
-- `pg_get_function_identity_arguments` confirma
-- (p_receptor_id uuid, p_invitacion_id uuid, p_accion text, p_bebida_bar_id uuid) returns text.
--
-- Cambio de firma: SOLO el cuarto parámetro, p_bebida_bar_id -> p_bebida_catalogo_id.
-- El tipo no cambia (uuid), solo el nombre — pero Postgres exige drop igual
-- (create or replace no permite renombrar un parámetro aunque el tipo sea
-- idéntico; mordida ya conocida de la Tarea 3). El resto de la firma —orden,
-- nombres, returns text— queda intacto a propósito: menos superficie que
-- tocar en E.2b.
--
-- Camino `solicitud` simétrico al de `invitacion` (corrección de diseño del
-- plan, 2026-09-10): capturar_orden exige una orden YA preautorizada, y una
-- función SQL no puede llamar al proveedor de pagos — no hay forma de
-- preautorizar desde acá. Aceptar una solicitud solo PREPARA: crea la orden
-- en pendiente y deja la invitación en preautorizando. Quien captura y abre
-- la cita es confirmar_preautorizacion (Tarea 3b), cuando E.2b preautorice.
drop function public.responder_invitacion(uuid, uuid, text, uuid);

create function public.responder_invitacion(
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

    -- Desglose en centavos, igual que calcularDesgloseCompra en TypeScript
    -- y que crear_invitacion — deuda ya anotada en docs/backlog.md: el fee
    -- vive en dos sitios.
    v_buyer_fee := round(v_bebida.valor_v * 100 * 0.15) / 100.0;
    v_total := v_bebida.valor_v + v_buyer_fee;

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

-- Solo service_role ejecuta. El cliente jamás resuelve una invitación ni
-- captura/anula un hold por su cuenta.
revoke execute on function public.responder_invitacion(uuid, uuid, text, uuid) from public;
revoke execute on function public.responder_invitacion(uuid, uuid, text, uuid) from authenticated, anon;
grant execute on function public.responder_invitacion(uuid, uuid, text, uuid) to service_role;
