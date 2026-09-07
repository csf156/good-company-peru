-- pgTAP del endurecimiento de tos_aceptaciones (migracion 20260906140000).
--
-- Estas aserciones REPRODUCEN los ataques como `authenticated`, no consultan
-- el catalogo. Un test que solo mirara information_schema y viera el `revoke`
-- pasaria igual aunque el agujero siguiera abierto: lo que importa no es que
-- el permiso este escrito, sino que la base rechace el insert.
begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000e1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'tos-dur@ayni.test', '',
        now(), now(), now());

insert into public.profiles (id, rol)
values ('00000000-0000-0000-0000-0000000000e1'::uuid, 'amigo');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1"}';

-- El camino legitimo sigue funcionando: solo perfil y version.
select lives_ok(
  $$insert into public.tos_aceptaciones (perfil_id, version)
    values ('00000000-0000-0000-0000-0000000000e1'::uuid, 'v1')$$,
  'un usuario puede aceptar la version vigente'
);

-- Y la fecha la puso el servidor, no el cliente.
select ok(
  (select aceptado_at from public.tos_aceptaciones
    where perfil_id = '00000000-0000-0000-0000-0000000000e1'::uuid)
  between now() - interval '1 minute' and now() + interval '1 minute',
  'aceptado_at lo pone el servidor: cae dentro del minuto actual'
);

-- ATAQUE 1: repetir la misma aceptacion. Antes creaba filas ilimitadas.
select throws_ok(
  $$insert into public.tos_aceptaciones (perfil_id, version)
    values ('00000000-0000-0000-0000-0000000000e1'::uuid, 'v1')$$,
  '23505',
  null,
  'no se puede aceptar dos veces la misma version (indice unico)'
);

-- ATAQUE 2: fechar la aceptacion a mano. Reproducido de verdad antes del fix:
-- se aceptaba una fila con aceptado_at = 2001-01-01.
select throws_ok(
  $$insert into public.tos_aceptaciones (perfil_id, version, aceptado_at)
    values ('00000000-0000-0000-0000-0000000000e1'::uuid, 'v1', '2001-01-01T00:00:00Z')$$,
  '42501',
  null,
  'el cliente no puede fijar aceptado_at: sin privilegio sobre la columna'
);

-- ATAQUE 3: pre-aceptar una version futura para saltarse el re-consentimiento
-- cuando el ToS cambie.
select throws_ok(
  $$insert into public.tos_aceptaciones (perfil_id, version)
    values ('00000000-0000-0000-0000-0000000000e1'::uuid, 'v2')$$,
  '23514',
  null,
  'no se puede aceptar una version que todavia no existe'
);

reset role;

select * from finish();
rollback;
