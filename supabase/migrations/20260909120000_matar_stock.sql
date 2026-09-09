-- Fase E.1 — La invitación es la compra: muere el stock de bebidas.
--
-- Por qué: la tabla `bar` con estado 'disponible' es valor almacenado, la
-- característica que define al dinero electrónico en la Ley 29985. El
-- reglamento (DS 090-2013-EF, art. 1) excluye los soportes de uso específico;
-- una bebida que solo existe atada a una persona, un encuentro y un importe
-- cae de lleno en esa exclusión. Ver
-- docs/superpowers/specs/2026-09-09-rediseno-dinero-sbs-design.md §3.2.
--
-- La ausencia de stock deja de ser una regla de aplicación y pasa a ser un
-- hecho del esquema: no queda ninguna tabla donde exista una bebida sin
-- destinatario.

-- 1. La bebida pasa a ser un atributo de la invitación, tomada del catálogo.
--    Nullable: una `solicitud` de amigo no lleva bebida hasta que el rentador
--    acepta y elige (spec §4.1).
alter table public.invitaciones
  add column bebida_catalogo_id uuid references public.bebidas_catalogo (id);

-- 2. Cae la referencia al stock. `bar` no se puede borrar mientras exista.
alter table public.invitaciones
  drop column bebida_bar_id;

-- 3. Toda orden de pago nace atada a una invitación. NOT NULL sin default:
--    la Tarea 0 dejó la tabla vacía, así que no hay filas que rellenar.
alter table public.ordenes_pago
  add column invitacion_id uuid not null references public.invitaciones (id);

-- 4. La bebida sale de la orden: ahora es derivable por invitacion_id, y
--    mantenerla en dos tablas es una fuente de deriva.
alter table public.ordenes_pago
  drop column bebida_catalogo_id;

-- 5. Muere el stock.
drop table public.bar;
drop type estado_bar;
