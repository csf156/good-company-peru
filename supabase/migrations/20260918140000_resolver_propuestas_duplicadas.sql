-- Fase F.1, Tarea 4 — Resolver las propuestas duplicadas de los datos demo.
--
-- POR QUÉ. La spec (§6, §6.1) exige UNA sola relación activa por par de
-- personas, en cualquier sentido, y la hará cumplir un índice único parcial
-- (Tarea 5). Ese índice NO se puede crear mientras haya pares duplicados, y
-- hoy hay tres (medidos el 2026-09-16 y re-medidos el 2026-09-18 y 2026-09-21):
--
--   chris ↔ Vale   2 relaciones   (1 pendiente sin cobrar + 1 aceptada cobrada)
--   Rodri ↔ Vale   3 relaciones   (todas aceptadas y cobradas)
--   Fer   ↔ Seba   3 relaciones   (todas aceptadas y cobradas)
--
-- Hay tres por par y no dos porque la regla también bloquea el sentido
-- contrario: Vale le hizo una solicitud a Rodri además de las dos invitaciones
-- de Rodri, y Seba a Fer igual. La resolución la aprobó el usuario el
-- 2026-09-16 (spec §6.1). Aplicar esta migración toca la cuenta REAL del
-- usuario (`chris`), así que exige además su aprobación sobre la lista exacta
-- de filas, mostrada antes de aplicar.
--
-- QUÉ HACE (las 8 filas, por id concreto; cada fila trae su acción abajo):
--
--   BORRAR       2622ed25  chris → Vale   invitacion  pendiente   orden preautorizada
--                          (se borra junto con su orden 4b7da6dd)
--   se conserva  cf47727d  chris → Vale   invitacion  aceptada    capturada, con cita
--
--   se conserva  39613a0f  Rodri → Vale   invitacion  aceptada    (la más antigua)
--   → concluida  bc0c1c54  Vale → Rodri   solicitud   aceptada
--   → concluida  e9444495  Rodri → Vale   invitacion  aceptada
--
--   se conserva  34043b80  Fer → Seba     invitacion  aceptada    (la más antigua)
--   → concluida  c61fcb12  Seba → Fer     solicitud   aceptada
--   → concluida  0c1fbc73  Seba → Fer     solicitud   aceptada
--
-- "La más antigua" (por `created_at`, desempatando por `id`; spec §6.1) es la
-- regla de Rodri ↔ Vale y Fer ↔ Seba. En chris ↔ Vale la regla es otra: se
-- borra la pendiente y se conserva la aceptada.
-- Queda exactamente UNA relación no terminal por par.
--
-- POR IDS Y NO POR UNA REGLA. Esto es un cambio de datos sobre filas medidas
-- una por una, en una base con datos reales del usuario. Una regla del tipo
-- "las sobrantes de cada par" podría atrapar otras filas si alguien creó o
-- respondió propuestas entre la medición y la aplicación. Por eso cada
-- sentencia opera solo sobre estos ids y la migración se comprueba a sí misma
-- (ver "SEGURA POR CONSTRUCCIÓN").
--
-- POR QUÉ LAS COBRADAS NO SE BORRAN. Cada una dejó tres movimientos en
-- `ledger` (compra, fee, escrow_lock), que es append-only: los triggers
-- `ledger_no_update` y `ledger_no_delete` lo rechazan para todo rol. Su orden
-- capturada es tan inmutable como ese ledger (hallazgo de E.2b) y arrastra a su
-- invitación por el FK. Borrar la propuesta dejaría esos movimientos huérfanos
-- para siempre y la conciliación (`detectar_discrepancias_sp3`) quedaría en
-- rojo permanente, lo que ya obligó a un reset destructivo en E.2b. Para esas
-- filas SOLO cambia el `estado` de la invitación: sus órdenes, citas y ledger
-- no se tocan.
--
-- EXCEPCIÓN DECLARADA A LA REGLA DE `concluida`. La regla del diseño es que
-- `concluida` solo lo pone el sub-proyecto 5, cuando el encuentro termina de
-- verdad. Aquí se ponen en `concluida` cuatro invitaciones (bc0c1c54, e9444495,
-- c61fcb12, 0c1fbc73) cuyos encuentros NUNCA ocurrieron: son datos demo de la
-- base de desarrollo. Se elige `concluida` igualmente porque es el único
-- estado terminal que no finge algo peor (`retirada` o `rechazada` inventarían
-- una acción que nadie tomó). Es una excepción única, acotada a estos cuatro
-- ids y aprobada por el usuario; NO abre la puerta a poner `concluida` desde
-- ningún otro camino. Cualquier invariante futura del tipo "`concluida`
-- implica cita finalizada" tiene que contar con estas cuatro (spec §6.1,
-- línea ~204; anotado en docs/backlog.md).
--
-- LA RETENCIÓN DE LA PENDIENTE NO EXISTE FUERA DE LA FILA. La orden que se
-- borra (4b7da6dd, chris, 40.25) está `preautorizada`, es decir, con su
-- retención "viva". Se comprobó por introspección que esa retención es solo la
-- fila de `ordenes_pago`: el proveedor es `mock` (crear_invitacion lo fija así
-- y `decidePaymentProvider` exige un opt-in explícito para Red Pontis), su
-- `provider_ref` es `hold:<id de la orden>` — una cadena determinista que el
-- mock deriva del id, sin estado propio (pagos.ts, `mockPreautorizar`) — y no
-- hay ninguna fila en el ledger ni en ninguna otra tabla que apunte a la orden
-- o a su invitación; tampoco pg_cron ni pg_net ni cola alguna. Un rechazo
-- normal libera este hold con `capturar_orden(…, 'anulada')`, que solo cambia
-- el estado de la orden y no escribe ledger ni llama al proveedor. Por eso
-- borrar la fila elimina la retención: no queda retención huérfana. La
-- migración lo vuelve a comprobar antes de borrar (proveedor mock, ref de
-- forma `hold:<id>`, cero filas de ledger) y si no se cumple, aborta.
--
-- QUÉ SE TOCA Y QUÉ NO. Exactamente: 1 DELETE en `ordenes_pago`, 1 DELETE en
-- `invitaciones` y 4 UPDATE de `invitaciones.estado`. No se toca el ledger
-- (ni sus triggers), ni `citas`, ni funciones, ni políticas, ni esquema. Único
-- efecto lateral: el trigger `invitaciones_set_updated_at` actualiza
-- `updated_at` en las 4 filas que pasan a `concluida`. El borrado de la
-- invitación no dispara el ON DELETE CASCADE de `citas` porque la migración
-- comprueba antes que no tiene cita (ni, por tanto, chat).
--
-- SEGURA POR CONSTRUCCIÓN. Todo va en un bloque `do` que, antes de mutar,
-- exige que las 8 filas existan exactamente como se midieron (emisor,
-- receptor, tipo, estado, estado de sus órdenes y si tienen cita), que no haya
-- ninguna otra invitación entre esos tres pares, que la orden a borrar sea la
-- única de su invitación y no tenga ledger, y que la conciliación esté en
-- cero. Cada mutación exige su cuenta exacta de filas afectadas y, al final,
-- se vuelve a comprobar el estado resultante. Cualquier desvío ABORTA con un
-- mensaje que dice qué no cuadra, y como es una sola transacción no queda
-- nada a medias. Se escribe para aplicarse UNA sola vez: una segunda
-- ejecución no encontraría el estado medido y abortaría.
--
-- PROYECTO LIMPIO. Estos son datos demo de la base de desarrollo y NO deben
-- llegar a producción: si el sistema se lanza sobre un proyecto limpio (como
-- está recomendado), ninguno de los ids existe y la migración es un no-op con
-- un aviso. Si existen algunos pero no todos, aborta (estado intermedio).

do $$
declare
  -- Las 8 filas medidas, por id concreto. `accion` es lo que se hace con cada
  -- una: 'borrar', 'concluir' o 'conservar'. `ordenes` es la lista de estados
  -- de las órdenes de esa invitación ('' si no tiene).
  v_esperadas constant jsonb := '[
    {"id":"2622ed25-29b2-4353-b340-ceb8b44d369d","emisor_id":"fca1ad46-aa6f-46a1-993a-cfff0e8870cf","receptor_id":"d0000000-0000-0000-0000-000000000001","tipo":"invitacion","estado":"pendiente","ordenes":"preautorizada","tiene_cita":false,"accion":"borrar"},
    {"id":"cf47727d-7303-4256-ae03-d337538b4247","emisor_id":"fca1ad46-aa6f-46a1-993a-cfff0e8870cf","receptor_id":"d0000000-0000-0000-0000-000000000001","tipo":"invitacion","estado":"aceptada","ordenes":"capturada","tiene_cita":true,"accion":"conservar"},
    {"id":"39613a0f-400a-4fea-8705-ba17c5fb47fa","emisor_id":"d0000000-0000-0000-0000-000000000005","receptor_id":"d0000000-0000-0000-0000-000000000001","tipo":"invitacion","estado":"aceptada","ordenes":"capturada","tiene_cita":true,"accion":"conservar"},
    {"id":"bc0c1c54-bc37-40e2-bb66-5a5865c32568","emisor_id":"d0000000-0000-0000-0000-000000000001","receptor_id":"d0000000-0000-0000-0000-000000000005","tipo":"solicitud","estado":"aceptada","ordenes":"capturada","tiene_cita":true,"accion":"concluir"},
    {"id":"e9444495-f5a9-4615-957b-1a1eb967aaa6","emisor_id":"d0000000-0000-0000-0000-000000000005","receptor_id":"d0000000-0000-0000-0000-000000000001","tipo":"invitacion","estado":"aceptada","ordenes":"capturada","tiene_cita":true,"accion":"concluir"},
    {"id":"34043b80-27ca-43f9-bd4b-afb9a023ca64","emisor_id":"d0000000-0000-0000-0000-000000000006","receptor_id":"d0000000-0000-0000-0000-000000000002","tipo":"invitacion","estado":"aceptada","ordenes":"capturada","tiene_cita":true,"accion":"conservar"},
    {"id":"c61fcb12-32ac-4474-997a-fc6e766e871d","emisor_id":"d0000000-0000-0000-0000-000000000002","receptor_id":"d0000000-0000-0000-0000-000000000006","tipo":"solicitud","estado":"aceptada","ordenes":"capturada","tiene_cita":true,"accion":"concluir"},
    {"id":"0c1fbc73-79c7-4359-a4fe-110258f20903","emisor_id":"d0000000-0000-0000-0000-000000000002","receptor_id":"d0000000-0000-0000-0000-000000000006","tipo":"solicitud","estado":"aceptada","ordenes":"capturada","tiene_cita":true,"accion":"concluir"}
  ]'::jsonb;
  -- La orden que se borra junto con su invitación (2622ed25).
  v_orden_borrar constant uuid := '4b7da6dd-0d6d-491d-97f2-948ceb37fefb';

  v_ids_presentes int;
  v_ordenes_presentes int;
  v_no_cuadran text;
  v_n int;
begin
  -- ------------------------------------------------------------ PROYECTO LIMPIO
  -- Ni una sola de las 8 invitaciones ni de sus órdenes existe: no es la base
  -- de desarrollo con sus datos demo, no hay nada que resolver.
  select count(*) into v_ids_presentes
    from public.invitaciones i
   where i.id in (select e.id from jsonb_to_recordset(v_esperadas) as e(id uuid));

  select count(*) into v_ordenes_presentes
    from public.ordenes_pago o
   where o.invitacion_id in (select e.id from jsonb_to_recordset(v_esperadas) as e(id uuid))
      or o.id = v_orden_borrar;

  if v_ids_presentes = 0 and v_ordenes_presentes = 0 then
    raise notice 'resolver_propuestas_duplicadas: ninguna de las 8 invitaciones existe (proyecto limpio); no hay nada que resolver.';
    return;
  end if;

  -- ---------------------------------------------------- COMPROBACIONES PREVIAS
  -- 1. Las 8 filas existen exactamente como se midieron. `v_no_cuadran` lista
  --    (por id corto) las que faltan o difieren en cualquiera de estos campos.
  select string_agg(left(e.id::text, 8), ', ' order by e.id) into v_no_cuadran
    from jsonb_to_recordset(v_esperadas)
           as e(id uuid, emisor_id uuid, receptor_id uuid, tipo text, estado text,
                ordenes text, tiene_cita boolean, accion text)
    left join public.invitaciones i on i.id = e.id
   where i.id is null
      or i.emisor_id   is distinct from e.emisor_id
      or i.receptor_id is distinct from e.receptor_id
      or i.tipo::text   <> e.tipo
      or i.estado::text <> e.estado
      or coalesce((select string_agg(o.estado::text, ',' order by o.estado::text)
                     from public.ordenes_pago o
                    where o.invitacion_id = i.id), '') <> e.ordenes
      or exists (select 1 from public.citas c where c.invitacion_id = i.id) <> e.tiene_cita;

  if v_no_cuadran is not null then
    raise exception 'resolver_propuestas_duplicadas: las siguientes invitaciones no están como se midieron (faltan o difieren): %. No se tocó nada.', v_no_cuadran;
  end if;

  -- 2. No hay NINGUNA otra invitación (de cualquier estado) entre esos tres
  --    pares: si alguien creó o respondió propuestas desde la medición, la
  --    resolución aprobada ya no aplica tal cual.
  select count(*) into v_n
    from public.invitaciones i
   where (least(i.emisor_id, i.receptor_id), greatest(i.emisor_id, i.receptor_id)) in (
           select least(e.emisor_id, e.receptor_id), greatest(e.emisor_id, e.receptor_id)
             from jsonb_to_recordset(v_esperadas) as e(emisor_id uuid, receptor_id uuid));

  if v_n <> 8 then
    raise exception 'resolver_propuestas_duplicadas: entre esos tres pares hay % invitaciones y se midieron 8. No se tocó nada.', v_n;
  end if;

  -- 3. La orden a borrar es la ÚNICA de su invitación (ya lo cubre el paso 1,
  --    que compara la lista completa de estados de órdenes), es la esperada, y
  --    su retención no existe fuera de la fila: proveedor mock, referencia de
  --    forma `hold:<id>`.
  select count(*) into v_n
    from public.ordenes_pago o
   where o.id = v_orden_borrar
     and o.invitacion_id = (select e.id from jsonb_to_recordset(v_esperadas) as e(id uuid, accion text) where e.accion = 'borrar')
     and o.estado = 'preautorizada'
     and o.provider = 'mock'
     and o.provider_ref = 'hold:' || o.id::text;

  if v_n <> 1 then
    raise exception 'resolver_propuestas_duplicadas: la orden % no es la preautorizada del proveedor mock que se midió. No se tocó nada.', v_orden_borrar;
  end if;

  -- 4. Sin ledger para esa orden ni para su invitación (las dos ligas del
  --    ledger: `referencia_id` = invitación; `idempotency_key` = '<orden>:…').
  select count(*) into v_n
    from public.ledger l
   where l.referencia_id = (select e.id from jsonb_to_recordset(v_esperadas) as e(id uuid, accion text) where e.accion = 'borrar')
      or l.idempotency_key like v_orden_borrar::text || ':%';

  if v_n <> 0 then
    raise exception 'resolver_propuestas_duplicadas: hay % fila(s) de ledger ligadas a la orden o invitación que se borrarían; el ledger no se toca. No se tocó nada.', v_n;
  end if;

  -- 5. La conciliación parte en cero (línea base de la fase).
  select count(*) into v_n from public.detectar_discrepancias_sp3();
  if v_n <> 0 then
    raise exception 'resolver_propuestas_duplicadas: detectar_discrepancias_sp3() ya devuelve % fila(s) antes de empezar. No se tocó nada.', v_n;
  end if;

  -- ------------------------------------------------------------------ MUTACIONES
  -- (a) La pendiente de chris ↔ Vale: primero su orden (el FK
  --     `ordenes_pago_invitacion_id_fkey` es NO ACTION), después la invitación.
  delete from public.ordenes_pago
   where id = v_orden_borrar
     and estado = 'preautorizada';
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'resolver_propuestas_duplicadas: se esperaba borrar 1 orden y se borraron %.', v_n;
  end if;

  delete from public.invitaciones
   where id in (select e.id from jsonb_to_recordset(v_esperadas) as e(id uuid, accion text) where e.accion = 'borrar')
     and estado = 'pendiente';
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'resolver_propuestas_duplicadas: se esperaba borrar 1 invitación y se borraron %.', v_n;
  end if;

  -- (b) Las cuatro sobrantes cobradas: SOLO cambia el estado de la invitación.
  update public.invitaciones
     set estado = 'concluida'
   where id in (select e.id from jsonb_to_recordset(v_esperadas) as e(id uuid, accion text) where e.accion = 'concluir')
     and estado = 'aceptada';
  get diagnostics v_n = row_count;
  if v_n <> 4 then
    raise exception 'resolver_propuestas_duplicadas: se esperaba pasar 4 invitaciones a concluida y se pasaron %.', v_n;
  end if;

  -- ------------------------------------------------------- COMPROBACIONES FINALES
  -- 1. Cada fila quedó en el estado que le tocaba: la borrada no existe, las
  --    cuatro 'concluir' están concluida, las 'conservar' siguen como estaban.
  select string_agg(left(e.id::text, 8), ', ' order by e.id) into v_no_cuadran
    from jsonb_to_recordset(v_esperadas) as e(id uuid, estado text, accion text)
    left join public.invitaciones i on i.id = e.id
   where (e.accion = 'borrar'    and i.id is not null)
      or (e.accion = 'concluir'  and i.estado is distinct from 'concluida')
      or (e.accion = 'conservar' and i.estado::text is distinct from e.estado);

  if v_no_cuadran is not null then
    raise exception 'resolver_propuestas_duplicadas: el estado final de % no es el esperado.', v_no_cuadran;
  end if;

  -- 2. Exactamente UNA relación no terminal por cada uno de los tres pares.
  select count(*) into v_n
    from (
      select least(i.emisor_id, i.receptor_id) a, greatest(i.emisor_id, i.receptor_id) b,
             count(*) filter (where i.estado not in ('rechazada', 'expirada', 'retirada', 'concluida')) activas
        from public.invitaciones i
       where (least(i.emisor_id, i.receptor_id), greatest(i.emisor_id, i.receptor_id)) in (
               select least(e.emisor_id, e.receptor_id), greatest(e.emisor_id, e.receptor_id)
                 from jsonb_to_recordset(v_esperadas) as e(emisor_id uuid, receptor_id uuid))
       group by 1, 2
    ) p
   where p.activas <> 1;

  if v_n <> 0 then
    raise exception 'resolver_propuestas_duplicadas: % par(es) no quedaron con exactamente una relación activa.', v_n;
  end if;

  -- 3. La conciliación sigue en cero.
  select count(*) into v_n from public.detectar_discrepancias_sp3();
  if v_n <> 0 then
    raise exception 'resolver_propuestas_duplicadas: detectar_discrepancias_sp3() devuelve % fila(s) después de resolver.', v_n;
  end if;
end
$$;
