-- pgTAP: estructura del modelo de dinero (Fase 3.0).
-- Tablas ledger / bebidas_catalogo / bar, sus columnas clave, enums y RLS.
select plan(24);

-- Tablas base del sub-proyecto 3 existen
select has_table('public', 'ledger', 'existe tabla ledger');
select has_table('public', 'bebidas_catalogo', 'existe tabla bebidas_catalogo');
select has_table('public', 'bar', 'existe tabla bar');

-- ledger: columnas de contabilidad append-only
select has_column('public', 'ledger', 'perfil_id', 'ledger tiene perfil_id');
select has_column('public', 'ledger', 'tipo', 'ledger tiene tipo');
select has_column('public', 'ledger', 'monto', 'ledger tiene monto');
select has_column('public', 'ledger', 'moneda', 'ledger tiene moneda');
select has_column('public', 'ledger', 'referencia_id', 'ledger tiene referencia_id');
select has_column('public', 'ledger', 'idempotency_key', 'ledger tiene idempotency_key');
select has_column('public', 'ledger', 'created_at', 'ledger tiene created_at');

-- bebidas_catalogo: config del operador
select has_column('public', 'bebidas_catalogo', 'nombre', 'bebidas_catalogo tiene nombre');
select has_column('public', 'bebidas_catalogo', 'tipo_invitacion', 'bebidas_catalogo tiene tipo_invitacion');
select has_column('public', 'bebidas_catalogo', 'valor_v', 'bebidas_catalogo tiene valor_v');
select has_column('public', 'bebidas_catalogo', 'activo', 'bebidas_catalogo tiene activo');

-- bar: stock del rentador
select has_column('public', 'bar', 'perfil_id', 'bar tiene perfil_id');
select has_column('public', 'bar', 'bebida_id', 'bar tiene bebida_id');
select has_column('public', 'bar', 'estado', 'bar tiene estado');
select has_column('public', 'bar', 'escrow_ref', 'bar tiene escrow_ref');

-- Enums completos desde el día 1 (costuras de expansión — aditivas, no cambiar significado)
select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_movimiento'),
  array['compra', 'escrow_lock', 'escrow_release', 'payout', 'refund', 'fee'],
  'tipo_movimiento tiene los 6 tipos de movimiento'
);
select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_invitacion'),
  array['divertida', 'romantica', 'misteriosa', 'amigos', 'autor'],
  'tipo_invitacion tiene los 5 tipos de bebida/invitación'
);
select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'estado_bar'),
  array['disponible', 'bloqueada', 'consumida'],
  'estado_bar tiene los 3 estados de stock'
);

-- RLS habilitado en las 3 tablas de dinero
select is(relrowsecurity, true, 'RLS habilitado en ledger')
  from pg_class where oid = 'public.ledger'::regclass;
select is(relrowsecurity, true, 'RLS habilitado en bebidas_catalogo')
  from pg_class where oid = 'public.bebidas_catalogo'::regclass;
select is(relrowsecurity, true, 'RLS habilitado en bar')
  from pg_class where oid = 'public.bar'::regclass;

select * from finish();
