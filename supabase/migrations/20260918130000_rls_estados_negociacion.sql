-- Fase F.1, Tarea 3 — Visibilidad de los estados de la propuesta negociada.
--
-- `invitaciones_select_parte` (20260910160000, E.2a) es una LISTA BLANCA a
-- propósito: el receptor solo ve `pendiente`, `aceptada`, `rechazada` y
-- `expirada`; el emisor ve todo. Los cuatro estados que añadió
-- 20260918100000 (`contrapropuesta`, `contrapropuesta_rechazada`, `retirada`,
-- `concluida`) nacieron, por eso, INVISIBLES para quien recibe. Eso no es un
-- bug: es la protección funcionando como se diseñó (falla cerrada — un estado
-- nuevo no se ve hasta que alguien decide abrirlo). Esta migración toma esa
-- decisión, una por una (spec §5.1):
--
--   contrapropuesta            SE ABRE. Son estados de una conversación en la
--   contrapropuesta_rechazada  que participan las dos partes: B contrapropone
--   retirada                   y espera a A; A declina y B decide sobre la
--   concluida                  original; A retira; el encuentro concluye. Si
--                              B no los viera, la pantalla de B no podría
--                              mostrar en qué va la propuesta.
--
--   preautorizando             SIGUE OCULTO para el receptor. Es el momento de
--                              la preautorización: mientras el hold no
--                              responde la invitación no existe todavía para
--                              quien la recibiría (si el hold falla, nunca
--                              existió). Nada cambia aquí.
--
-- La política conserva EXACTAMENTE su forma: mismo nombre, mismo rol
-- (`authenticated`), misma condición de pertenencia (emisor ve todo; receptor
-- solo con la lista de estados). Lo único que cambia es la lista, que pasa de
-- 4 a 8 etiquetas. Sigue siendo una LISTA BLANCA y no se convierte en lista
-- negra (`estado <> 'preautorizando'`), por la misma razón de E.2a: con una
-- lista negra cada etiqueta nueva del enum nacería visible y dependería de que
-- alguien recordara volver aquí. Con esta lista, el próximo valor del enum
-- vuelve a nacer oculto.
--
-- Esta política de SELECT es el ÚNICO objeto que CAMBIA: ni grants, ni otras
-- políticas, ni funciones, ni tablas. `crear_invitacion` y
-- `responder_invitacion` (F.2) tampoco se tocan, y no hay vistas sobre la
-- tabla. Pero su visibilidad SE PROPAGA a otras dos tablas. Las políticas
-- `citas_select_parte` (SELECT), `chat_select_parte` (SELECT) y
-- `chat_insert_propio` (INSERT, with check) de `citas` y `chat_mensajes`
-- consultan `invitaciones` con `exists (select … from invitaciones i …)` y
-- solo comprueban pertenencia (emisor o receptor), no estado; pero esas
-- subconsultas corren bajo el RLS de quien llama, así que HEREDAN lo que la
-- política de `invitaciones` deje ver. Consecuencia: para una invitación en
-- uno de los cuatro estados que se abren aquí, el acceso propio del receptor a
-- la cita y al chat relacionados sigue a la invitación. Por ejemplo, hasta
-- ahora el receptor no podía ver la cita ni el chat de una invitación en
-- `concluida` (la invitación misma quedaba oculta para él), y ahora sí;
-- `chat_insert_propio` pasa a ser posible para el receptor allí, como ya lo
-- era para el emisor (a quien la política nunca le ocultó nada). Es coherente
-- con la spec §5.1 (los cuatro estados son de una conversación entre las dos
-- partes). Si el chat debe seguir abierto o cerrarse después de `concluida`
-- es una decisión de una fase posterior; esta migración no la toma.

drop policy invitaciones_select_parte on public.invitaciones;

create policy invitaciones_select_parte
  on public.invitaciones for select
  to authenticated
  using (
    emisor_id = (select auth.uid())
    or (
      receptor_id = (select auth.uid())
      and estado in (
        'pendiente', 'aceptada', 'rechazada', 'expirada',
        'contrapropuesta', 'contrapropuesta_rechazada', 'retirada', 'concluida'
      )
    )
  );
