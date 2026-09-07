-- Aceptacion de terminos, como EVIDENCIA append-only y no como estado.
-- Cuando el texto cambie habra que re-pedir la aceptacion, y una columna en
-- profiles perderia la anterior. La fase 7.5 (ToS enforcement) necesita el
-- historico completo -- "acepto la v1 en tal fecha, la v2 en tal otra" --, no
-- el ultimo valor. Mismo criterio que el ledger de la fase 3.0.
create table public.tos_aceptaciones (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  version text not null,
  aceptado_at timestamptz not null default now()
);

create index tos_aceptaciones_perfil_idx
  on public.tos_aceptaciones (perfil_id, aceptado_at desc);

alter table public.tos_aceptaciones enable row level security;

-- Cada quien ve e inserta solo lo suyo. La aceptacion de otro no es asunto
-- de nadie. Mismo patron que onboarding_eventos (fase D.3).
create policy tos_aceptaciones_select_own on public.tos_aceptaciones
  for select to authenticated
  using (perfil_id = auth.uid());

create policy tos_aceptaciones_insert_own on public.tos_aceptaciones
  for insert to authenticated
  with check (perfil_id = auth.uid());

-- Append-only para el cliente, igual que el ledger y onboarding_eventos.
revoke update, delete on public.tos_aceptaciones from authenticated;
grant select, insert on public.tos_aceptaciones to authenticated;

-- Sin sesion no se toca nada de esto.
revoke select, insert, update, delete on public.tos_aceptaciones from anon;

-- Costura de referidos (fase 9.1): se captura en el alta y NADA la lee
-- todavia. El momento de capturar un referido es el registro y no vuelve;
-- sin esta columna, quien se registre antes de la fase 9 queda sin atribuir
-- para siempre. Texto libre a proposito: el catalogo de codigos no existe.
alter table public.profiles add column referido_por text;
