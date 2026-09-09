-- Fase E.1 — Estados del flujo preautorización → captura.
--
-- Se preautoriza al invitar y se captura al aceptar (spec §3.1): si el amigo
-- rechaza, se anula el hold y NO hubo cobro — con lo que no hay devolución que
-- gestionar, y el veto 4 (nunca devolver a crédito interno) se cumple solo.
--
-- Ampliación ADITIVA de ambos enums: las etiquetas viejas siguen valiendo.

alter type estado_invitacion add value if not exists 'por_pagar';

alter type estado_orden add value if not exists 'preautorizada';
alter type estado_orden add value if not exists 'capturada';
alter type estado_orden add value if not exists 'anulada';
