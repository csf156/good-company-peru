-- Fase 4.5 — Confirmar cita (dentro del chat)
-- Sub-proyecto 4 (Invitaciones/chat). Cierra la última transición pendiente de
-- `citas` antes del motor de cita (5.x): el AMIGO captura zona/hora/mensaje y la
-- cita pasa de 'pendiente' a 'confirmada'. Esta fase NO mueve bebidas ni escrow
-- (a diferencia de crear_invitacion/responder_invitacion) — solo transiciona una
-- fila de `citas`, así que la función es deliberadamente más simple: sin bloqueo
-- de `bar`, un solo `for update` sobre `citas`.
--
-- "El amigo" (quién puede confirmar) NO es fijo a emisor ni a receptor: depende
-- de la dirección de la invitación original (fase 4.0/4.2):
--   * tipo='invitacion' (rentador→amigo): el amigo es el RECEPTOR.
--   * tipo='solicitud'  (amigo→rentador): el amigo es el EMISOR.
-- Se determina dinámicamente con un join a `invitaciones` + `profiles.rol`,
-- nunca asumiendo una dirección fija (ver responder_invitacion 4.3, mismo
-- criterio para "quién responde").
--
-- Orden de chequeos (mismo criterio que responder_invitacion): primero el
-- actor ("solo el amigo puede confirmar", AY403) — así una invitación ya
-- confirmada por otra persona ajena sigue rechazando la suplantación aunque el
-- estado ya no sea 'pendiente' — y DESPUÉS la idempotencia benigna.
--
-- Idempotente-benigno: si la cita ya está 'confirmada', devuelve 'ya_confirmada'
-- sin reaplicar (no pisa zona/hora/mensaje ya guardados con un segundo intento).
-- Otros estados (en_curso/finalizada/no_show/disputa, todos de fase 5.x) no son
-- confirmables desde acá: conflicto (AY409).
--
-- Devuelve: 'confirmada' | 'ya_confirmada'.
-- Errcodes: AY400 forma inválida (defensa en profundidad) · AY403 no eres el
-- amigo de esta cita · AY404 cita inexistente · AY409 estado no confirmable.
--
-- La invoca el Edge Function confirmar-cita (service_role). El cliente NO puede
-- ejecutarla directamente (revoke execute) — mismo patrón que
-- crear_invitacion/responder_invitacion: mover el estado de `citas` es
-- server-side.

create or replace function public.confirmar_cita(
  p_amigo_id uuid,
  p_cita_id uuid,
  p_zona text,
  p_hora timestamptz,
  p_mensaje text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cita public.citas;
  v_inv public.invitaciones;
  v_amigo_real uuid;
begin
  -- Forma mínima (defensa en profundidad; la validación completa vive en el
  -- Edge Function / _shared/citas.ts).
  if p_zona is null or length(trim(p_zona)) = 0 then
    raise exception 'zona es requerida' using errcode = 'AY400';
  end if;
  if p_hora is null then
    raise exception 'hora es requerida' using errcode = 'AY400';
  end if;

  -- Lock de la cita: dos confirmaciones concurrentes se serializan; la segunda
  -- ve el estado ya confirmado y sale por el camino idempotente-benigno.
  select * into v_cita
    from public.citas
   where id = p_cita_id
   for update;

  if not found then
    raise exception 'cita no encontrada' using errcode = 'AY404';
  end if;

  select * into v_inv
    from public.invitaciones
   where id = v_cita.invitacion_id;

  -- "El amigo" de esta cita: la parte (emisor o receptor de la invitación) con
  -- profiles.rol = 'amigo'. Dinámico, no asumido por dirección.
  select p.id into v_amigo_real
    from public.profiles p
   where p.id in (v_inv.emisor_id, v_inv.receptor_id)
     and p.rol = 'amigo'
   limit 1;

  -- Solo el amigo confirma. Fijado por la fila (no por el body): el rentador
  -- (o su contraparte, si el amigo es emisor de una `solicitud`) no puede.
  if v_amigo_real is distinct from p_amigo_id then
    raise exception 'solo el amigo puede confirmar la cita' using errcode = 'AY403';
  end if;

  -- Idempotente-benigno: confirmar de nuevo una cita ya confirmada no reaplica
  -- (no pisa zona/hora/mensaje ya guardados).
  if v_cita.estado = 'confirmada' then
    return 'ya_confirmada';
  end if;

  if v_cita.estado <> 'pendiente' then
    raise exception 'la cita no está en un estado confirmable' using errcode = 'AY409';
  end if;

  update public.citas
     set estado = 'confirmada',
         zona = p_zona,
         hora = p_hora,
         mensaje = p_mensaje,
         confirmada_at = now()
   where id = p_cita_id;

  -- TODO(push): notificar a ambas partes — ver docs/backlog.md

  return 'confirmada';
end;
$$;

-- Solo service_role ejecuta. El cliente jamás confirma una cita por su cuenta.
revoke execute on function public.confirmar_cita(uuid, uuid, text, timestamptz, text) from public;
revoke execute on function public.confirmar_cita(uuid, uuid, text, timestamptz, text) from authenticated, anon;
grant execute on function public.confirmar_cita(uuid, uuid, text, timestamptz, text) to service_role;
