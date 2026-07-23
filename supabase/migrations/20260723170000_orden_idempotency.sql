-- Fase 3.4 (endurecimiento post-review) — idempotencia de CREACIÓN de orden
-- Cierra el hueco señalado en el code-review: confirmar_orden_pago es idempotente
-- por-orden, pero comprar-bebida creaba una orden nueva por request (UUID fresco
-- por llamada), así que un reintento o doble-tap generaba 2 órdenes → 2 bebidas
-- (modo mock) o 2 checkouts (Red Pontis real). El diseño exige idempotencia en
-- todo pago.
--
-- Mecanismo: el cliente genera una idempotency_key por intento de compra y la
-- reusa en reintentos del mismo intento. comprar-bebida inserta con ella; el
-- unique de abajo cierra la carrera (dos requests con la misma key → la segunda
-- choca con 23505 y el Edge Function devuelve la orden existente sin crear otra).
--
-- Nullable: filas legadas (si las hubiera) quedan sin key; Postgres permite
-- múltiples NULL en un unique. Las órdenes nuevas siempre traen key.

alter table public.ordenes_pago
  add column idempotency_key text;

create unique index ordenes_pago_idempotency_key_uq
  on public.ordenes_pago (idempotency_key);
