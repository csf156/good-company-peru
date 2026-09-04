-- Catálogo de bebidas (Fase D.3, dato de producto — no de demo).
--
-- Sin esto la tienda (fase 3.2) no tiene nada que listar y comprar-bebida no
-- tiene nada que referenciar: es dato real, no desechable, por eso va como
-- migración permanente y no en el script de siembra de demo.
--
-- Clave estable para reaplicar sin duplicar: `nombre` (única). Los ids son
-- gen_random_uuid() de la tabla; `on conflict (nombre) do nothing` hace la
-- migración idempotente sin necesidad de fijarlos a mano.

alter table public.bebidas_catalogo
  add constraint bebidas_catalogo_nombre_key unique (nombre);

-- Ninguna bebida usa `tipo_invitacion = 'romantica'`, por decisión explícita
-- del usuario (2026-09-04). El valor sigue existiendo en el enum desde la
-- fase 3.0 y no se toca —eso sería alterar el esquema de una fase cerrada—
-- pero ningún dato lo referencia, así que la palabra nunca llega a la tienda.
--
-- El porqué está en el spec de onboarding §7: `CLAUDE.md` fija el
-- posicionamiento como compañía social y lo justifica como requisito para
-- mantener las pasarelas de pago. "Romántica" corre la lectura del producto
-- hacia "citas pagadas", que es el encuadre por el que un procesador cierra
-- una cuenta. La misma decisión ya excluyó ese valor de los tipos de salida.
insert into public.bebidas_catalogo (nombre, tipo_invitacion, valor_v) values
  ('Chicha Morada de la Casa', 'amigos', 15),
  ('Pisco Sour Clásico', 'divertida', 25),
  ('Maracuyá Sour', 'amigos', 35),
  ('Algarrobina Especial', 'misteriosa', 45),
  ('Cóctel de Autor Ayni', 'autor', 60)
on conflict (nombre) do nothing;
