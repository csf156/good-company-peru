-- Fase D.3 — la edad deja de guardarse y pasa a derivarse de la fecha de
-- nacimiento; `intereses` cambia de semántica (temas de conversación → tipo
-- de salida buscado) y se renombra en consecuencia.
--
-- Por qué la edad se calcula en la vista y no como columna generada: una
-- columna generada de Postgres debe ser IMMUTABLE, y la edad depende de la
-- fecha de hoy. Guardada como número suelto, envejece mal — el perfil diría
-- 24 para siempre.

-- 1. Fecha de nacimiento. Nace nullable: los perfiles existentes no la tienen
--    y el wizard (bloque 2) es quien la exige al dar de alta.
alter table public.profiles
  add column fecha_nacimiento date;

-- El check usa current_date, que es STABLE y no IMMUTABLE. Es seguro aquí
-- porque el predicado es monótono: quien ya cumplió 18 nunca vuelve a tener
-- 17, así que una fila válida no puede invalidarse con el paso del tiempo
-- (ni al restaurar un dump).
alter table public.profiles
  add constraint profiles_mayor_de_edad
  check (
    fecha_nacimiento is null
    or fecha_nacimiento <= current_date - interval '18 years'
  );

-- 2. Baja de `edad`. La vista se recrea abajo; hay que soltarla primero
--    porque depende de esta columna.
drop view public.perfiles_publicos;

alter table public.profiles
  drop column edad;

-- 3. `intereses` → `tipo_salida`. El rename conserva datos, grants de tabla
--    e índices; los grants POR COLUMNA se re-otorgan explícitamente abajo.
alter table public.profiles
  rename column intereses to tipo_salida;

-- 4. Vista pública. Se recrea con la misma allowlist explícita de columnas
--    que la fase 1.5 definió, con dos cambios: `edad` pasa a ser expresión
--    calculada, e `intereses` pasa a `tipo_salida`.
--
--    `fecha_nacimiento` queda DELIBERADAMENTE fuera: es dato sensible y solo
--    debe verlo su dueño vía profiles_select_own sobre la tabla base.
create view public.perfiles_publicos as
select
  id,
  rol,
  alias,
  case
    when fecha_nacimiento is null then null
    else extract(year from age(current_date, fecha_nacimiento))::int
  end as edad,
  genero,
  profesion,
  hobbies,
  tipo_salida,
  foto_url,
  kyc_estado
from public.profiles;

grant select on public.perfiles_publicos to authenticated;
revoke select on public.perfiles_publicos from anon;

-- 5. Grants por columna. El `drop column edad` se llevó su grant; el rename
--    conservó el de `intereses` bajo el nombre nuevo, pero se re-otorga
--    explícitamente para que este archivo documente el conjunto completo y no
--    dependa del comportamiento del rename.
grant update (fecha_nacimiento, tipo_salida) on public.profiles to authenticated;
