-- =====================================================================
-- 0004_seed_catalog.sql
-- Datos demo que NO dependen de usuarios: 150 sucursales, catálogo de
-- tipos de incidencia y empleados. Podés correr esto ya mismo, antes
-- de crear ningún usuario.
-- =====================================================================

-- ---------------------------------------------------------------------
-- incident_types
-- ---------------------------------------------------------------------
insert into public.incident_types (code, label, is_personnel, sort_order) values
  ('alcohol',        'Empleado tomando alcohol',        true,  1),
  ('sin_uniforme',   'Empleado sin uniforme',           true,  2),
  ('ausente',        'Empleado ausente',                true,  3),
  ('menor_edad',     'Presencia de menor de edad',      false, 4),
  ('celular',        'Uso de teléfono celular',         true,  5),
  ('comportamiento', 'Comportamiento inadecuado',       true,  6),
  ('incumplimiento', 'Incumplimiento operativo',        false, 7),
  ('seguridad',      'Problema de seguridad',           false, 8),
  ('cerrada',        'Sucursal cerrada fuera de horario', false, 9),
  ('cliente',        'Situación irregular con cliente', false, 10),
  ('otro',           'Otro',                            false, 11)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- branches (150 sucursales demo, coordenadas alrededor de Asunción)
-- ---------------------------------------------------------------------
do $$
declare
  v_cities text[] := array['Asunción','San Lorenzo','Luque','Lambaré','Fernando de la Mora','Ñemby','Capiatá','Mariano R. Alonso','Villa Elisa','Itauguá'];
  v_suffixes text[] := array['Centro','Shopping','Terminal','Norte','Sur','Plaza','Mercado','Av. Principal','Barrio Obrero','Ruta 2','Km 14','Estación'];
  v_city text;
  v_suffix text;
  v_code text;
  i int;
begin
  perform setseed(0.42);
  for i in 1..150 loop
    v_city := v_cities[1 + floor(random() * array_length(v_cities,1))::int];
    v_suffix := v_suffixes[1 + floor(random() * array_length(v_suffixes,1))::int];
    v_code := lpad(i::text, 3, '0');
    insert into public.branches (code, name, city, department, lat, lng, open_time, close_time, camera_count)
    values (
      v_code,
      v_city || ' ' || v_suffix,
      v_city,
      'Central',
      -25.30 + (random() - 0.5) * 0.5,
      -57.63 + (random() - 0.5) * 0.5,
      '08:00', '18:00',
      3 + floor(random() * 6)::int
    )
    on conflict (code) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- employees (personal demo, repartido entre sucursales)
-- ---------------------------------------------------------------------
do $$
declare
  v_names text[] := array[
    'C. Benítez','R. Fleitas','D. Cabrera','L. Ayala','M. Ortiz','V. Rojas',
    'A. Villalba','G. Mendoza','N. Cáceres','J. Aquino','P. Duarte','S. Ferreira',
    'F. Insfrán','E. Notario','T. Ovelar','B. Riquelme','H. Samudio','I. Torres',
    'K. Vera','O. Zaracho'
  ];
  v_branch_ids uuid[];
  n int;
  i int;
begin
  select array_agg(id) into v_branch_ids from public.branches;
  n := array_length(v_branch_ids,1);
  if n is null then return; end if;
  for i in 1..array_length(v_names,1) loop
    insert into public.employees (full_name, branch_id)
    values (v_names[i], v_branch_ids[1 + floor(random()*n)::int]);
  end loop;
end $$;
