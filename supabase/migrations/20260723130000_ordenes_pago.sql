-- Fase 3.1 — Órdenes de pago (integración pagos + escrow)
-- Sub-proyecto 3. Una `orden de pago` correlaciona la compra de una bebida con
-- su confirmación (síncrona en modo mock, o vía webhook del partner en modo
-- Red Pontis real).
--
-- Por qué persistir la orden (y no confiar en el payload del webhook):
--   * Los montos (valor_v, buyer_fee, total) se calculan SERVER-SIDE al crear
--     la orden y se guardan aquí. El webhook confirma usando ESTOS montos, no
--     los del payload → el cliente ni el webhook pueden alterar el fee.
--   * `id` de la orden es el `external_id` que se pasa al partner; el webhook lo
--     devuelve y se busca por PK. Idempotencia de confirmación por CAS de estado
--     (pendiente→confirmada/fallida) + unique del ledger.

create type estado_orden as enum ('pendiente', 'confirmada', 'fallida');

create table public.ordenes_pago (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.profiles (id),
  bebida_catalogo_id uuid not null references public.bebidas_catalogo (id),
  -- Montos congelados al crear la orden (server-side). El webhook NO los recalcula.
  valor_v numeric(12, 2) not null check (valor_v >= 0),
  buyer_fee numeric(12, 2) not null check (buyer_fee >= 0),
  total numeric(12, 2) not null check (total >= 0),
  estado estado_orden not null default 'pendiente',
  provider text not null,          -- 'mock' | 'redpontis'
  provider_ref text,               -- referencia de la orden en el partner (reconciliación)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ordenes_pago_set_updated_at
  before update on public.ordenes_pago
  for each row execute function public.set_updated_at();

alter table public.ordenes_pago enable row level security;

-- El cliente solo LEE sus propias órdenes (para reflejar estado en la UI). La
-- creación y confirmación son exclusivas del service_role (comprar-bebida /
-- pago-webhook): un cliente jamás crea ni auto-confirma una orden.
create policy ordenes_pago_select_own
  on public.ordenes_pago for select
  to authenticated
  using (perfil_id = (select auth.uid()));

revoke insert, update, delete on public.ordenes_pago from authenticated;
revoke insert, update, delete on public.ordenes_pago from anon;
