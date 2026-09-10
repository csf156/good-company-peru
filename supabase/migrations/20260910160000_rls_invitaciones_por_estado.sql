-- Fase E.2a, Tarea 2b — La visibilidad de una invitación depende del estado,
-- no solo de la identidad.
--
-- `invitaciones_select_parte` (20260723180000) filtraba solo por identidad,
-- porque en la Fase 4.0 ningún estado debía ocultarse de una de las partes.
-- `preautorizando` es el primero: mientras la preautorización no responde, la
-- invitación no existe para el amigo — si el hold falla, nunca existió.
--
-- Se escribe como LISTA BLANCA a propósito. Con una lista negra
-- (`estado <> 'preautorizando'`) cada etiqueta nueva del enum nacería visible
-- para el receptor y dependería de que alguien recordara volver aquí — que es
-- justo el fallo que esta migración corrige. Así falla cerrada: un estado
-- nuevo es invisible hasta que se le abra la puerta a propósito.

drop policy invitaciones_select_parte on public.invitaciones;

create policy invitaciones_select_parte
  on public.invitaciones for select
  to authenticated
  using (
    emisor_id = (select auth.uid())
    or (
      receptor_id = (select auth.uid())
      and estado in ('pendiente', 'aceptada', 'rechazada', 'expirada')
    )
  );
