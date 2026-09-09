-- Fase E.1 — Invariantes del ledger: la cuenta por cobrar del amigo no es un
-- monedero.
--
-- Exigencia del backlog, textual: "Nada de esto se sostiene como regla de
-- aplicación: dentro de dos fases alguien escribe un endpoint de crédito 'solo
-- para pruebas' y ahí muere el argumento." Estas reglas fallan en un INSERT de
-- Postgres, no en una revisión de código, y aplican TAMBIÉN a service_role.
--
-- Errcode AY451 (familia AY4xx del proyecto) para distinguirlo en los tests de
-- un fallo de constraint genérico.

create or replace function public.ledger_credito_amigo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rol rol_usuario;
  v_estado_cita estado_cita;
begin
  select rol into v_rol from public.profiles where id = new.perfil_id;

  if v_rol is distinct from 'amigo' then
    return new;
  end if;

  -- Crédito (veto 8, 9, 14): solo liberación de escrow por encuentro verificado.
  if new.monto > 0 then
    if new.tipo <> 'payout' then
      raise exception 'credito a un amigo solo por payout (recibido: %)', new.tipo
        using errcode = 'AY451';
    end if;

    if new.referencia_id is null then
      raise exception 'un payout necesita referencia a la cita'
        using errcode = 'AY451';
    end if;

    select estado into v_estado_cita
      from public.citas where id = new.referencia_id;

    if v_estado_cita is distinct from 'finalizada' then
      raise exception 'payout solo por cita finalizada (cita: %, estado: %)',
        new.referencia_id, coalesce(v_estado_cita::text, 'inexistente')
        using errcode = 'AY451';
    end if;
  end if;

  return new;
end;
$$;

create trigger ledger_invariante_credito
  before insert on public.ledger
  for each row execute function public.ledger_credito_amigo();
