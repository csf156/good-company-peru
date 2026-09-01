-- Fase D.3 bloque 1 — esquema de fecha_nacimiento y tipo_salida.
select plan(11);

-- Forma de la tabla
select has_column('public', 'profiles', 'fecha_nacimiento', 'profiles tiene fecha_nacimiento');
select col_type_is('public', 'profiles', 'fecha_nacimiento', 'date', 'fecha_nacimiento es date');
select hasnt_column('public', 'profiles', 'edad', 'profiles ya no guarda edad');
select has_column('public', 'profiles', 'tipo_salida', 'profiles tiene tipo_salida');
select hasnt_column('public', 'profiles', 'intereses', 'intereses fue renombrada');
select has_column('public', 'profiles', 'profesion', 'profesion sigue existiendo (columna muerta, no borrada)');

-- Grants por columna: el cliente puede escribir los campos nuevos de su perfil
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'fecha_nacimiento', 'UPDATE'),
  'authenticated puede actualizar fecha_nacimiento'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'tipo_salida', 'UPDATE'),
  'authenticated puede actualizar tipo_salida'
);

-- La vista pública expone edad calculada, nunca la fecha de nacimiento
select has_column('public', 'perfiles_publicos', 'edad', 'la vista pública expone edad');
select hasnt_column(
  'public', 'perfiles_publicos', 'fecha_nacimiento',
  'la vista pública NO expone fecha_nacimiento (dato sensible)'
);

-- 18+ se sigue exigiendo, ahora sobre la fecha.
--
-- `profiles.id` referencia `auth.users`, así que el usuario tiene que existir
-- primero: sin esto el insert fallaría por violación de FK (23503) y el test
-- pasaría por la razón equivocada, sin llegar nunca a probar el check.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000',
   'd3d3d3d3-0000-0000-0000-00000000d3d3', 'authenticated', 'authenticated',
   'menor@test.dev', '', now(), now(), now(), '', '', '', '');

select throws_ok(
  $$insert into public.profiles (id, rol, fecha_nacimiento)
    values ('d3d3d3d3-0000-0000-0000-00000000d3d3', 'amigo',
            current_date - interval '17 years')$$,
  '23514',
  null,
  'un menor de 18 es rechazado por el check'
);

select * from finish();
