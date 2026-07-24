-- Fase 4.4 — Moderación anti-fuga del chat (trigger) + cierre del hallazgo RLS de 4.0
-- Sub-proyecto 4 (Invitaciones/chat).
--
-- Regla de negocio (docs/2026-07-01-modelo-negocio-design.md, "Regla anti-fuga"):
-- todo pago ocurre DENTRO de la app. Compartir teléfono / cuenta / CCI o intentar
-- pagar por fuera = fuga. La moderación detecta esos patrones y OCULTA el mensaje
-- a la contraparte, avisando al emisor (su propio mensaje se ve tachado/marcado).
--
-- Arquitectura (decisión de la fase): el cliente inserta mensajes DIRECTO en
-- chat_mensajes (RLS chat_insert_propio, 4.0) para el chat en tiempo real — no
-- pasa por ningún Edge Function. Meter uno en medio del envío añadiría latencia y
-- contradiría ese diseño. Por eso la moderación es un trigger BEFORE INSERT que
-- setea NEW.oculto ANTES de guardar: el mensaje NACE oculto para la contraparte,
-- nunca existe una ventana visible-y-luego-ocultado. La MISMA regla vive, para
-- test/documentación, en el módulo isomórfico supabase/functions/_shared/moderacion.ts
-- (probado con Jest). La fuente de verdad en producción es ESTE trigger — el
-- cliente jamás decide el ocultamiento.

-- ============================================================================
-- Función de moderación (trigger)
-- ============================================================================

-- SECURITY DEFINER + search_path fijo: necesita (1) contar los mensajes ocultos
-- previos del emisor saltando RLS y (2) escribir profiles.flags (columna que el
-- cliente no puede tocar). Corre con privilegios del owner, no secuestrable por
-- search_path. Es un trigger: se dispara solo en cada insert, no se concede execute.
create or replace function public.moderar_chat_mensaje()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Texto sin espacios ni guiones: "987-654 321" → "987654321", así los
  -- separadores no evaden la detección. Solo espacios/guiones (no letras ni
  -- comas): las letras siguen separando números distintos y una lista "1, 2, 3"
  -- no se concatena en una secuencia larga falsa.
  v_compacto text := regexp_replace(new.texto, '[[:space:]-]', '', 'g');
  v_fuga boolean;
  v_ocultos_previos integer;
begin
  v_fuga :=
    -- Teléfono peruano: un 9 seguido de 8 dígitos (con o sin prefijo 51/+51, que
    -- tras compactar queda embebido). Ya compactado.
    v_compacto ~ '9[0-9]{8}'
    -- Secuencia larga (cuenta / CCI: la CCI peruana son 20 dígitos). 10+ dígitos
    -- consecutivos es improbable en chat inocente (un precio/hora no llega a 10).
    or v_compacto ~ '[0-9]{10,}'
    -- Palabras clave de pago/canal externo. \y = límite de palabra (ARE): "cuenta"
    -- NO dispara dentro de "cuéntame" (la é rompe la coincidencia literal). El
    -- match es de substring desde un límite, así "yape" cubre "yapeame". Mantener
    -- en sincronía con PALABRAS_CLAVE de _shared/moderacion.ts.
    or new.texto ~* '\y(yape|plin|cuenta|transferencia|transferir|deposito|cci|cbvu|bcp|interbank|bbva|scotiabank)';

  if not v_fuga then
    return new;
  end if;

  -- Nace oculto para la contraparte (la RLS de abajo deja que el propio emisor lo
  -- siga viendo → así se entera del "warning" sin un canal de notificación aparte).
  new.oculto := true;

  -- Reincidencia: si el emisor YA tenía mensajes ocultos, este es repetición →
  -- registra un flag en su perfil (costura jsonb desde 1.1). Shape acordado:
  --   flags->>'chat_violaciones' = nº de reincidencias (violaciones DESPUÉS de la
  --   primera). 1ª fuga: oculta, sin flag. 2ª: oculta, chat_violaciones=1. Etc.
  --   Es el contador que una futura política de baja/ban (fuera de alcance) leerá.
  select count(*) into v_ocultos_previos
    from public.chat_mensajes
   where emisor_id = new.emisor_id and oculto;

  if v_ocultos_previos >= 1 then
    update public.profiles
       set flags = jsonb_set(
             coalesce(flags, '{}'::jsonb),
             '{chat_violaciones}',
             to_jsonb(coalesce((flags->>'chat_violaciones')::int, 0) + 1),
             true)
     where id = new.emisor_id;
  end if;

  return new;
end;
$$;

create trigger chat_mensajes_moderar
  before insert on public.chat_mensajes
  for each row execute function public.moderar_chat_mensaje();

-- ============================================================================
-- RLS: cierra el hallazgo de 4.0 (backlog) — oculto ya no lo ve la contraparte
-- ============================================================================

-- Antes (4.0): las dos partes veían TODOS los mensajes, incluso oculto=true — un
-- mensaje moderado se podía leer consultando directo. Ahora un mensaje oculto solo
-- lo ve su propio emisor (para el warning); la contraparte NUNCA. Los mensajes NO
-- ocultos siguen visibles a ambas partes (no rompe 4.0). No se toca la policy de
-- insert (chat_insert_propio).
drop policy chat_select_parte on public.chat_mensajes;

create policy chat_select_parte
  on public.chat_mensajes for select
  to authenticated
  using (
    (not oculto or emisor_id = (select auth.uid()))
    and exists (
      select 1
      from public.citas c
      join public.invitaciones i on i.id = c.invitacion_id
      where c.id = chat_mensajes.cita_id
        and ((select auth.uid()) in (i.emisor_id, i.receptor_id))
    )
  );
