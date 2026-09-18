-- Intención de cada bebida, "Ayni" fuera del catálogo y momento propuesto
-- (Fase F.1, Tarea 2) — spec 2026-09-16-propuesta-negociada-design.md §2, §8.
--
-- Tres cambios. Van juntos porque los dos primeros tocan `bebidas_catalogo` en
-- un orden que importa (renombrar ANTES de rellenar) y el tercero es una
-- columna suelta sin dependencias.
--
-- 1. Renombrar "Cóctel de Autor Ayni" -> "Cóctel de Autor". "Ayni" era el
--    nombre anterior de la app (Ayni -> Martini, D.4) y sobrevivía en el dato
--    de `20260904120000_catalogo_bebidas.sql`. Esa migración YA está aplicada y
--    no se reescribe: se corrige aquí con un `update`, casando por `nombre`
--    (clave estable del catálogo; los uuid difieren entre entornos).
--
-- 2. La bebida es el significante de la intención del encuentro (spec §2), así
--    que cada una lleva su intención escrita. Se guarda en DOS columnas, no en
--    una: `intencion_titulo` (la parte en negrita, con su punto final, tal como
--    la aprobó el usuario el 2026-09-16) e `intencion_detalle` (el resto). F.4
--    necesita esa jerarquía tipográfica y partir un solo string por ". " en el
--    cliente es frágil.
--
--    Las columnas son NULLABLE a propósito. Un NOT NULL habría roto los fixtures
--    de 9 archivos pgTAP de fases cerradas (11, 12, 13, 14, 15, 19, 20, 34, 35),
--    que insertan bebidas sin intención, y no vale reescribirlos. El costo, que
--    hay que tener presente: una bebida futura PUEDE crearse sin intención, y
--    la UI de F.4 tiene que tolerarlo. Lo que el check sí garantiza es que
--    nunca queda una intención a medias ni en blanco.
--
--    El check escribe `is not null` de forma explícita a propósito: un CHECK
--    solo rechaza el resultado FALSE y deja pasar NULL, así que una expresión
--    como `btrim(intencion_detalle) <> ''` aceptaría un detalle NULL con un
--    título lleno (NULL <> '' es NULL, no FALSE). Lectura: los grants de
--    `bebidas_catalogo` son a nivel de tabla (ninguna columna tiene ACL propia)
--    y la política `bebidas_select_activas` ya existe, así que las columnas
--    nuevas heredan el SELECT de `authenticated` sin tocar nada. Escritura: el
--    cliente no tiene INSERT/UPDATE/DELETE sobre la tabla (migración
--    `20260723120000`) y este cambio no se lo concede.
--
-- 3. `invitaciones.momento_propuesto timestamptz`, nullable y sin backfill: las
--    invitaciones existentes no tienen momento. `timestamptz` guarda el instante
--    correcto; el riesgo está en CONVERTIR texto a hora con la sesión en UTC (ya
--    corrió 5 horas en `confirmar_cita`, revisión 4.6). Aquí solo se crea la
--    columna; el contrato de ida y vuelta lo fija el pgTAP
--    `supabase/tests/36_propuesta_negociada_esquema.sql` y quien la escriba
--    (F.2) tiene que pasar la zona explícita.

-- (2) Renombrado ANTES del backfill: el backfill casa por el nombre final.
update public.bebidas_catalogo
   set nombre = 'Cóctel de Autor'
 where nombre = 'Cóctel de Autor Ayni';

-- (1) Intención: las dos columnas nacen NULL, con el check de coherencia.
alter table public.bebidas_catalogo
  add column intencion_titulo  text,
  add column intencion_detalle text,
  add constraint bebidas_catalogo_intencion_coherente check (
    (intencion_titulo is null and intencion_detalle is null)
    or (intencion_titulo is not null and intencion_detalle is not null
        and btrim(intencion_titulo) <> '' and btrim(intencion_detalle) <> '')
  );

-- Textos aprobados por el usuario el 2026-09-16 (spec §2), por nombre final.
update public.bebidas_catalogo b
   set intencion_titulo  = v.titulo,
       intencion_detalle = v.detalle
  from (values
    ('Chicha Morada de la Casa', 'Solo compañía.',     'Un café, una conversación, sin plan fijo.'),
    ('Pisco Sour Clásico',       'Para pasarla bien.', 'Un bar, un juego, un rato de risas.'),
    ('Maracuyá Sour',            'Salida casual.',     'Pasear, comer algo, conocer un lugar.'),
    ('Algarrobina Especial',     'Algo distinto.',     'Un plan que no harías solo.'),
    ('Cóctel de Autor',          'Evento especial.',   'Un concierto, una exposición, una celebración.')
  ) as v (nombre, titulo, detalle)
 where b.nombre = v.nombre;

-- (3) Momento propuesto del encuentro.
alter table public.invitaciones
  add column momento_propuesto timestamptz;
