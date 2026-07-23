-- pgTAP: Realtime habilitado en `chat_mensajes` y `citas` — Fase 4.0.
-- El chat en vivo (4.4) y el reflejo de estado de la cita en la UI dependen de
-- que ambas tablas estén en la publicación `supabase_realtime`.
select plan(2);

select is(
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_mensajes')::int,
  1, 'chat_mensajes está en la publicación supabase_realtime');

select is(
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'citas')::int,
  1, 'citas está en la publicación supabase_realtime');

select * from finish();
