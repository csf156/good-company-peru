-- Fase E.2a, Tarea 0 — `por_pagar` pasa a llamarse `preautorizando`.
--
-- El nombre viejo se lee como "pendiente de pago hasta que se concrete el
-- encuentro". No es eso: el estado dura segundos, entre crear la invitación y
-- la respuesta de la preautorización. Cuando el amigo acepta, el dinero YA se
-- cobró y está en custodia; lo que falta hasta el encuentro verificado es
-- liberarlo (fase 5.4), no pagarlo.
--
-- Se renombra ahora porque hoy es gratis: cero filas con ese estado y cero
-- apariciones en UI.

alter type estado_invitacion rename value 'por_pagar' to 'preautorizando';
