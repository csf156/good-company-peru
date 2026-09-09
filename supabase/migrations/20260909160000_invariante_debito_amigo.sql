-- Fase E.1 — El importe pendiente del amigo no se gasta dentro de la app.
--
-- Vetos 10, 11 y 12. Hoy rechaza TODO débito sobre un perfil `amigo`, porque la
-- única salida legítima —la liquidación bancaria a titular verificado— es la
-- fase 6.3 y no existe. Cuando llegue, amplía este trigger con su tipo y su
-- comprobación de titularidad: NO lo elimina.

create or replace function public.ledger_debito_amigo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rol rol_usuario;
begin
  select rol into v_rol from public.profiles where id = new.perfil_id;

  if v_rol is distinct from 'amigo' then
    return new;
  end if;

  if new.monto < 0 then
    raise exception
      'un amigo solo puede ser debitado por una liquidacion bancaria (fase 6.3); recibido: % %',
      new.tipo, new.monto
      using errcode = 'AY452';
  end if;

  return new;
end;
$$;

create trigger ledger_invariante_debito
  before insert on public.ledger
  for each row execute function public.ledger_debito_amigo();
