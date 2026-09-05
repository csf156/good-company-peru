-- El wizard de alta ocupa los pasos 1-7. El Bloque 3 de D.3 anade la captura
-- de KYC como cuatro pasos mas del mismo embudo (8 intro, 9 DNI, 10 selfie,
-- 11 resultado), para poder medir donde se abandona la verificacion — que es
-- justo donde mas se cae. Solo se ensancha el rango: la tabla, sus policies y
-- sus grants no cambian.
alter table public.onboarding_eventos
  drop constraint onboarding_eventos_paso_check;

alter table public.onboarding_eventos
  add constraint onboarding_eventos_paso_check check (paso between 1 and 11);
