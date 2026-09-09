-- Fase E.1 — Como máximo una orden viva por invitación.
--
-- No es `unique` a secas: un fallo de preautorización debe poder reintentarse.
-- Lo que no puede haber son dos holds o dos capturas vivas sobre el mismo
-- encuentro (veto 22: el ciclo comprar-cancelar es una ruta de cash-out).
create unique index ordenes_pago_viva_por_invitacion_uq
  on public.ordenes_pago (invitacion_id)
  where estado in ('preautorizada', 'capturada');
