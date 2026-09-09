-- Fase E.1 — `por_cobrar` sustituye a `balance`.
--
-- El veto 18 prohíbe "saldo", "billetera", "monedero" y "wallet" en UI, ToS,
-- soporte y marketing; el 19 prohíbe presentar el importe como poder de compra.
-- El nombre del objeto en la base importa igual: la siguiente fase construye lo
-- que encuentra escrito.
--
-- Diferencia de fondo, no de nombre: `balance` sumaba TODO el ledger y valía
-- para los dos roles. `por_cobrar` suma solo los payouts —lo que la plataforma
-- DEBE al amigo por servicios ya prestados—, que es una cuenta por cobrar y no
-- un valor almacenado. El rentador no tiene vista de dinero agregado: nunca
-- tuvo saldo.
--
-- Hoy devuelve 0 para todo el mundo, porque la fase 5.4 (liberación de escrow)
-- no existe. Es lo correcto.

drop view public.balance;

create view public.por_cobrar
  with (security_invoker = on) as
  select
    perfil_id,
    coalesce(sum(monto), 0)::numeric(12, 2) as por_cobrar
  from public.ledger
  where tipo = 'payout'
  group by perfil_id;

grant select on public.por_cobrar to authenticated;
revoke select on public.por_cobrar from anon;
