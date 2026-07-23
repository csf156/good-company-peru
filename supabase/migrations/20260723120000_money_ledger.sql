-- Fase 3.0 — Ledger + wallet + escrow (schema)
-- Sub-proyecto 3 (Tienda + Bar + Wallet/Escrow). Modelo de dinero: contabilidad
-- append-only e idempotente. Núcleo de plata del MVP.
--
-- Reglas de dinero (CLAUDE.md / diseño §A, §E):
--   * El cliente nunca calcula ni mueve saldo → toda escritura es del
--     service_role (Edge Functions de compra/escrow/payout), que bypassa RLS.
--   * Ledger append-only: sin UPDATE/DELETE (trigger de inmutabilidad + revoke
--     de privilegios). Las correcciones se hacen con filas compensatorias
--     nuevas (p.ej. `refund`), nunca mutando una fila existente.
--   * Idempotencia: `idempotency_key` unique global. Doble webhook no duplica
--     un movimiento.
--   * `balance` es una VISTA calculada (suma del ledger), nunca un número
--     mutable suelto.
--   * RLS estricto: cada quien ve solo su ledger / bar / balance.

-- ============================================================================
-- Enums (completos desde el día 1; ampliar solo de forma aditiva)
-- ============================================================================

create type tipo_movimiento as enum (
  'compra',          -- pago del rentador al comprar una bebida
  'escrow_lock',     -- fondos bloqueados en custodia del partner
  'escrow_release',  -- fondos liberados de custodia
  'payout',          -- pago neto al amigo tras la cita verificada
  'refund',          -- devolución (no-show, cancelación)
  'fee'              -- comisión (buyer/seller fee, procesamiento)
);

create type tipo_invitacion as enum (
  'divertida', 'romantica', 'misteriosa', 'amigos', 'autor'
);

create type estado_bar as enum ('disponible', 'bloqueada', 'consumida');

-- ============================================================================
-- ledger (append-only)
-- ============================================================================

create table public.ledger (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.profiles (id),
  tipo tipo_movimiento not null,
  -- Signo desde la perspectiva del `perfil_id` de la fila: crédito (+) aumenta
  -- su balance, débito (−) lo reduce. Lo fija el Edge Function que escribe
  -- (service_role). Qué tipos afectan el balance disponible vs. escrow lo
  -- integran las fases 3.1 (compra) y 5.4 (payout), cada una con sus tests;
  -- esta fase solo garantiza append-only, idempotencia y balance = suma.
  monto numeric(12, 2) not null,
  moneda text not null default 'PEN',
  -- Objeto de dominio referenciado (bar / cita / orden de pago). Polimórfico
  -- entre fases → sin FK.
  referencia_id uuid,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

-- Sin `on delete cascade` en perfil_id: el ledger es un registro financiero que
-- sobrevive; un perfil con historial no se borra en duro (se anonimizaría en el
-- futuro, fuera de alcance del MVP).

alter table public.ledger enable row level security;

-- El cliente autenticado solo LEE sus propias filas. La escritura es exclusiva
-- del service_role (que bypassa RLS): no hay policy de insert/update/delete.
create policy ledger_select_own
  on public.ledger for select
  to authenticated
  using (perfil_id = (select auth.uid()));

-- Defensa en profundidad sobre RLS: el cliente no tiene privilegio de escritura.
revoke insert, update, delete on public.ledger from authenticated;
revoke insert, update, delete on public.ledger from anon;

-- Inmutabilidad real (aplica a TODOS los roles, incluido service_role): un
-- trigger prohíbe UPDATE/DELETE de cualquier fila del ledger. Append-only de
-- verdad — las correcciones son filas compensatorias nuevas.
create or replace function public.ledger_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ledger es append-only: % no permitido', tg_op;
end;
$$;

create trigger ledger_no_update
  before update on public.ledger
  for each row execute function public.ledger_append_only();

create trigger ledger_no_delete
  before delete on public.ledger
  for each row execute function public.ledger_append_only();

-- ============================================================================
-- balance (vista calculada del ledger)
-- ============================================================================

-- `security_invoker = on`: la RLS de `ledger` corre como el usuario que
-- consulta, así cada quien ve SOLO su balance. (A diferencia de
-- perfiles_publicos, que a propósito lee todas las filas.) El balance nunca es
-- un número mutable: se recalcula sumando el ledger.
create view public.balance
  with (security_invoker = on) as
  select
    perfil_id,
    coalesce(sum(monto), 0)::numeric(12, 2) as balance
  from public.ledger
  group by perfil_id;

grant select on public.balance to authenticated;
revoke select on public.balance from anon;

-- ============================================================================
-- bebidas_catalogo (config del operador)
-- ============================================================================

create table public.bebidas_catalogo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo_invitacion tipo_invitacion not null,
  valor_v numeric(12, 2) not null check (valor_v >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.bebidas_catalogo enable row level security;

-- El cliente solo ve bebidas activas. El catálogo (precios/valor) lo administra
-- el operador vía service_role; el cliente nunca lo escribe.
create policy bebidas_select_activas
  on public.bebidas_catalogo for select
  to authenticated
  using (activo);

revoke insert, update, delete on public.bebidas_catalogo from authenticated;
revoke insert, update, delete on public.bebidas_catalogo from anon;

-- ============================================================================
-- bar (stock de bebidas del rentador)
-- ============================================================================

create table public.bar (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  bebida_id uuid not null references public.bebidas_catalogo (id),
  estado estado_bar not null default 'disponible',
  escrow_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger bar_set_updated_at
  before update on public.bar
  for each row execute function public.set_updated_at();

alter table public.bar enable row level security;

-- El rentador solo LEE su bar. El stock lo crea/mueve el service_role
-- (comprar-bebida añade; invitación bloquea; cita consume/refund).
create policy bar_select_own
  on public.bar for select
  to authenticated
  using (perfil_id = (select auth.uid()));

revoke insert, update, delete on public.bar from authenticated;
revoke insert, update, delete on public.bar from anon;
