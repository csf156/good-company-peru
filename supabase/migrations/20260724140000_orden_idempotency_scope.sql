-- SP3 (endurecimiento post-review 4.2) — idempotencia de orden SCOPED por perfil
-- Cierra la misma clase de hallazgo que se corrigió en `invitaciones`: la
-- `idempotency_key` de `ordenes_pago` era globalmente única (no por perfil), y el
-- catch del 23505 en comprar-bebida recuperaba la orden existente filtrando SOLO
-- por `idempotency_key`, sin verificar que el `perfil_id` coincidiera con el
-- llamante. Consecuencia: el usuario B que reusara (por adivinación/reuso) la key
-- del usuario A → su insert `(B, keyA)` chocaba con `(A, keyA)` en el índice
-- global → el catch devolvía la orden de A (id, estado, montos). Disclosure
-- cross-user en el núcleo de dinero, y B quedaba bloqueado de usar esa key.
--
-- Fix: la idempotencia es por-INTENTO y el intento pertenece a UN perfil. Se
-- reescopa a (perfil_id, idempotency_key):
--   * el índice único pasa de (idempotency_key) a (perfil_id, idempotency_key);
--   * el catch del 23505 en comprar-bebida filtra por AMBOS → una key de otro
--     perfil NO es idempotente: dos perfiles distintos pueden coexistir con la
--     misma key (filas distintas), sin fuga ni bloqueo cruzado.
--
-- Aditivo (convención del repo): NO edita 20260723170000 in-place; dropea el
-- índice viejo y crea el compuesto.

-- ----------------------------------------------------------------------------
-- Índice único: de global a compuesto por perfil.
-- (Postgres permite múltiples NULL en un unique, incluido el compuesto: las
-- filas legadas sin key siguen sin colisionar.)
-- ----------------------------------------------------------------------------
drop index if exists public.ordenes_pago_idempotency_key_uq;

create unique index ordenes_pago_perfil_idempotency_key_uq
  on public.ordenes_pago (perfil_id, idempotency_key);
