-- Fase D.3 — embudo de onboarding.
--
-- Registro append-only de por qué pasos pasa cada persona al darse de alta,
-- para poder medir en qué punto abandona. Eventos con marca de tiempo y no
-- un contador de "paso máximo": así se responde también cuánto tardó en cada
-- paso y si retrocedió — lo que distingue un paso confuso de uno aburrido.
--
-- NO hay lector todavía: el panel de operaciones es la fase 7.4. Esto
-- acumula historia desde hoy para que ese panel tenga qué mostrar.

create table public.onboarding_eventos (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  paso smallint not null check (paso between 1 and 7),
  evento text not null check (evento in ('paso_visto', 'completado')),
  created_at timestamptz not null default now()
);

create index onboarding_eventos_perfil_idx
  on public.onboarding_eventos (perfil_id, created_at);

alter table public.onboarding_eventos enable row level security;

-- Cada quien ve e inserta solo lo suyo. El embudo de otra persona no es
-- asunto de nadie más.
create policy onboarding_eventos_select_own on public.onboarding_eventos
  for select to authenticated
  using (perfil_id = auth.uid());

create policy onboarding_eventos_insert_own on public.onboarding_eventos
  for insert to authenticated
  with check (perfil_id = auth.uid());

-- Append-only para el cliente, igual que el ledger.
revoke update, delete on public.onboarding_eventos from authenticated;
grant select, insert on public.onboarding_eventos to authenticated;

-- Sin sesión no se toca nada de esto. Mismo criterio que chat_mensajes.
revoke select, insert, update, delete on public.onboarding_eventos from anon;
