-- profiles.referido_por (Tarea 1 de D.4, 20260906130000) nació sin su grant
-- de columna. Este proyecto usa grants por columna explícitos desde la fase
-- 1.1 (security-review: "RLS es por fila, no por columna") — la tabla tiene
-- `revoke insert, update on public.profiles from authenticated` a nivel de
-- tabla desde entonces, así que una columna nueva no hereda escritura de
-- nada: sin este grant, el cliente nunca puede fijar su propio referido,
-- aunque la columna exista y el wizard la muestre.
grant update (referido_por) on public.profiles to authenticated;
