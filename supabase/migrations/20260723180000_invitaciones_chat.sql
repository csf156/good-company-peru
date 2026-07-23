-- Fase 4.0 — Schema de invitaciones + chat
-- Sub-proyecto 4 (Invitaciones, solicitudes, chat y confirmación).
-- Modelo de datos de la propuesta de encuentro: rentador invita (desde el bar) o
-- amigo solicita → se acepta → se abre chat → se confirma la cita.
--
-- Reglas de seguridad (CLAUDE.md / diseño §E):
--   * Una invitación / cita / chat la ven SOLO sus dos partes (emisor y receptor
--     de la invitación). RLS estricto.
--   * La creación de invitaciones y las transiciones de estado de invitación y
--     cita son server-side (Edge Functions `crear-invitacion` 4.2 /
--     `responder-invitacion` 4.3 / motor de cita 5.x, todas con service_role):
--     el cliente NUNCA inserta ni muta esas filas directamente. Igual patrón que
--     ledger/bar/ordenes_pago.
--   * ÚNICA excepción de escritura del cliente: `chat_mensajes`. El cliente
--     inserta su propio mensaje (chat en tiempo real, Realtime), solo en citas
--     de las que es parte y solo como sí mismo. No edita ni borra: la moderación
--     (4.4) marca/oculta vía service_role.

-- ============================================================================
-- Enums (completos desde el día 1; ampliar solo de forma aditiva)
-- ============================================================================

-- Dirección de la propuesta. OJO: distinto del enum existente `tipo_invitacion`
-- (divertida|romantica|... = categoría de la bebida). Aquí `tipo` es quién
-- propone a quién.
create type tipo_propuesta as enum (
  'invitacion',  -- rentador → amigo (lleva bebida de su bar)
  'solicitud'    -- amigo → rentador (sin bebida aún; la pone el rentador al aceptar)
);

-- Alcance del destinatario. `global` (receptor_id null, descubrimiento abierto)
-- es sub-proyecto 2 (premium); la costura queda desde ya, el MVP usa `especifica`.
create type alcance_invitacion as enum ('especifica', 'global');

create type estado_invitacion as enum (
  'pendiente', 'aceptada', 'rechazada', 'expirada'
);

-- ============================================================================
-- invitaciones
-- ============================================================================

create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  emisor_id uuid not null references public.profiles (id) on delete cascade,
  -- Null solo cuando alcance = 'global' (aún sin destinatario concreto).
  receptor_id uuid references public.profiles (id) on delete cascade,
  tipo tipo_propuesta not null,
  alcance alcance_invitacion not null default 'especifica',
  -- Bebida del bar del emisor (solo en `invitacion` de rentador). En `solicitud`
  -- de amigo es null hasta que el rentador asigne una al aceptar (4.3). Sin
  -- `on delete cascade`: si la fila de bar se borrara, preferimos que falle
  -- ruidosamente a perder el enlace de una invitación viva.
  bebida_bar_id uuid references public.bar (id),
  tiempo_estimado_min integer check (tiempo_estimado_min is null or tiempo_estimado_min > 0),
  zona_aproximada text,
  estado estado_invitacion not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Coherencia del modelo: una invitación específica tiene destinatario; una
  -- global no (lo resuelve el descubrimiento premium, SP2).
  constraint invitacion_receptor_por_alcance check (
    (alcance = 'especifica' and receptor_id is not null)
    or (alcance = 'global' and receptor_id is null)
  )
);

create index invitaciones_receptor_idx on public.invitaciones (receptor_id);
create index invitaciones_emisor_idx on public.invitaciones (emisor_id);

create trigger invitaciones_set_updated_at
  before update on public.invitaciones
  for each row execute function public.set_updated_at();

alter table public.invitaciones enable row level security;

-- Solo las partes ven la invitación. Global (receptor null) la ve solo el emisor
-- hasta que el flujo premium le asigne receptor.
create policy invitaciones_select_parte
  on public.invitaciones for select
  to authenticated
  using (
    emisor_id = (select auth.uid())
    or receptor_id = (select auth.uid())
  );

-- El cliente no crea ni muta invitaciones: es del service_role.
revoke insert, update, delete on public.invitaciones from authenticated;
revoke insert, update, delete on public.invitaciones from anon;

-- ============================================================================
-- citas
-- ============================================================================

-- La cita concreta que nace al aceptar una invitación. Usa el enum de estado de
-- cita COMPLETO (`estado_cita`, definido en 1.1) — el motor de cita (5.x) usa el
-- resto de los valores. Una invitación produce como mucho una cita (unique).
create table public.citas (
  id uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null unique references public.invitaciones (id) on delete cascade,
  estado estado_cita not null default 'pendiente',
  zona text,
  hora timestamptz,
  mensaje text,
  confirmada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger citas_set_updated_at
  before update on public.citas
  for each row execute function public.set_updated_at();

alter table public.citas enable row level security;

-- Ven la cita las dos partes de su invitación. La subconsulta corre bajo la RLS
-- de `invitaciones` (que ya limita a las partes), así que es consistente.
create policy citas_select_parte
  on public.citas for select
  to authenticated
  using (
    exists (
      select 1 from public.invitaciones i
      where i.id = citas.invitacion_id
        and ((select auth.uid()) in (i.emisor_id, i.receptor_id))
    )
  );

-- El cliente no crea ni mueve el estado de la cita: es del service_role
-- (responder-invitacion 4.3, confirmar 4.5, motor de cita 5.x).
revoke insert, update, delete on public.citas from authenticated;
revoke insert, update, delete on public.citas from anon;

-- ============================================================================
-- chat_mensajes
-- ============================================================================

create table public.chat_mensajes (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null references public.citas (id) on delete cascade,
  emisor_id uuid not null references public.profiles (id) on delete cascade,
  texto text not null check (length(texto) > 0),
  -- Moderación anti-fuga (4.4): la escribe el service_role, no el cliente.
  oculto boolean not null default false,
  created_at timestamptz not null default now()
);

create index chat_mensajes_cita_idx on public.chat_mensajes (cita_id, created_at);

alter table public.chat_mensajes enable row level security;

-- Lectura: las dos partes de la cita.
create policy chat_select_parte
  on public.chat_mensajes for select
  to authenticated
  using (
    exists (
      select 1
      from public.citas c
      join public.invitaciones i on i.id = c.invitacion_id
      where c.id = chat_mensajes.cita_id
        and ((select auth.uid()) in (i.emisor_id, i.receptor_id))
    )
  );

-- Escritura (ÚNICA del cliente en la fase): solo como sí mismo y solo en una
-- cita de la que es parte. Sin suplantación de emisor, sin colarse en cita ajena.
create policy chat_insert_propio
  on public.chat_mensajes for insert
  to authenticated
  with check (
    emisor_id = (select auth.uid())
    and exists (
      select 1
      from public.citas c
      join public.invitaciones i on i.id = c.invitacion_id
      where c.id = chat_mensajes.cita_id
        and ((select auth.uid()) in (i.emisor_id, i.receptor_id))
    )
  );

-- El cliente no edita ni borra mensajes (la moderación oculta vía service_role).
revoke update, delete on public.chat_mensajes from authenticated;
revoke insert, update, delete, select on public.chat_mensajes from anon;

-- ============================================================================
-- Realtime
-- ============================================================================

-- Chat en vivo (4.4) y reflejo del estado de la cita en la UI (4.3/4.5) via
-- Supabase Realtime. La RLS de arriba también gobierna el stream de Realtime.
alter publication supabase_realtime add table public.chat_mensajes;
alter publication supabase_realtime add table public.citas;

-- `replica identity full` en citas: que los UPDATE de estado (pendiente→
-- confirmada→en_curso→...) viajen con la fila completa por Realtime. chat es
-- insert-only, la identidad por defecto basta.
alter table public.citas replica identity full;
