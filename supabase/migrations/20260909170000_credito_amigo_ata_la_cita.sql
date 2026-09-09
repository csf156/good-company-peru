-- Fase E.1, Tarea 3b — El crédito al amigo se ata a SU cita, por SU importe,
-- una sola vez.
--
-- La Tarea 3 solo exigía que la cita estuviera finalizada, y con eso dejaba
-- tres formas de acuñar dinero: acreditar a un amigo ajeno al encuentro,
-- acreditar más de lo capturado, y acreditar N veces por el mismo encuentro.
-- Las tres son la misma figura que el backlog nombra como la muerte del
-- argumento: un crédito que no proviene de un encuentro verificado concreto.

create or replace function public.ledger_credito_amigo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rol rol_usuario;
  v_estado_cita estado_cita;
  v_emisor uuid;
  v_receptor uuid;
  v_capturado numeric(12, 2);
begin
  select rol into v_rol from public.profiles where id = new.perfil_id;

  if v_rol is distinct from 'amigo' then
    return new;
  end if;

  if new.monto > 0 then
    if new.tipo <> 'payout' then
      raise exception 'credito a un amigo solo por payout (recibido: %)', new.tipo
        using errcode = 'AY451';
    end if;

    if new.referencia_id is null then
      raise exception 'un payout necesita referencia a la cita'
        using errcode = 'AY451';
    end if;

    select c.estado, i.emisor_id, i.receptor_id
      into v_estado_cita, v_emisor, v_receptor
      from public.citas c
      join public.invitaciones i on i.id = c.invitacion_id
     where c.id = new.referencia_id;

    if v_estado_cita is distinct from 'finalizada' then
      raise exception 'payout solo por cita finalizada (cita: %, estado: %)',
        new.referencia_id, coalesce(v_estado_cita::text, 'inexistente')
        using errcode = 'AY451';
    end if;

    -- Hueco 1: el crédito tiene que ser de SU encuentro.
    if new.perfil_id not in (v_emisor, v_receptor) then
      raise exception 'el amigo no es parte de la cita %', new.referencia_id
        using errcode = 'AY451';
    end if;

    -- Hueco 2: nunca más de lo que se capturó para ese encuentro. El reparto
    -- fino (seller fee, premium al 100%) es de la fase 5.4; esto es el techo.
    select o.valor_v into v_capturado
      from public.ordenes_pago o
      join public.citas c on c.invitacion_id = o.invitacion_id
     where c.id = new.referencia_id and o.estado = 'capturada';

    if v_capturado is null then
      raise exception 'no hay captura para la cita %', new.referencia_id
        using errcode = 'AY451';
    end if;

    if new.monto > v_capturado then
      raise exception 'payout % excede lo capturado para la cita (%)',
        new.monto, v_capturado
        using errcode = 'AY451';
    end if;
  end if;

  return new;
end;
$$;

-- Hueco 3: un encuentro respalda UN payout por amigo. Va como índice y no como
-- comprobación dentro del trigger: una consulta dentro del trigger sufre
-- carreras entre transacciones concurrentes, el índice único no.
create unique index ledger_payout_por_cita_uq
  on public.ledger (referencia_id, perfil_id)
  where tipo = 'payout';
