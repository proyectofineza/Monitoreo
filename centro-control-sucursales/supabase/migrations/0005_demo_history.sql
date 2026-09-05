-- =====================================================================
-- 0005_demo_history.sql
-- Historial demo (verificaciones + incidencias de los últimos 45 días,
-- más la cobertura de "hoy") para que los dashboards se vean realistas
-- desde el primer inicio.
--
-- IMPORTANTE: corré esto DESPUÉS de:
--   1) 0001..0004 (esquema, RLS, funciones, catálogo)
--   2) scripts/seed-demo-users.mjs (crea los 15 usuarios demo)
-- Este script busca a los operadores de "monitoreo" por su rol en
-- profiles, así que si todavía no existen usuarios no hace nada
-- (te va a avisar con un NOTICE).
-- =====================================================================

do $$
declare
  v_monitoreo_ids uuid[];
  v_type_ids smallint[];
  v_severities public.incident_severity[] := array['baja','media','alta','critica']::public.incident_severity[];
  v_branch record;
  v_op uuid;
  v_check_id uuid;
  v_started timestamptz;
  v_duration int;
  v_num_incidents int;
  v_type_id smallint;
  v_severity public.incident_severity;
  v_sev_range int;
  d int;
  j int;
begin
  select array_agg(id) into v_monitoreo_ids from public.profiles where role = 'monitoreo';
  select array_agg(id) into v_type_ids from public.incident_types;

  if v_monitoreo_ids is null or array_length(v_monitoreo_ids, 1) = 0 then
    raise notice 'No hay usuarios con rol monitoreo todavía. Corré scripts/seed-demo-users.mjs primero y volvé a ejecutar este archivo.';
    return;
  end if;

  perform setseed(0.77);

  -- ---- Historial de los últimos 45 días -------------------------------
  for v_branch in select id from public.branches loop
    for d in 1..45 loop
      if random() < 0.55 then
        v_op := v_monitoreo_ids[1 + floor(random() * array_length(v_monitoreo_ids,1))::int];
        v_started := (current_date - d)::timestamptz
                     + (8::int * interval '1 hour')
                     + (floor(random()*600)::int * interval '1 minute');
        v_duration := 150 + floor(random()*450)::int;

        insert into public.branch_checks (branch_id, operator_id, started_at, finished_at, status, duration_seconds)
        values (v_branch.id, v_op, v_started, v_started + (v_duration * interval '1 second'), 'verificada', v_duration)
        returning id into v_check_id;

        if random() < 0.28 then
          v_num_incidents := 1 + floor(random()*3)::int;
          for j in 1..v_num_incidents loop
            v_type_id := v_type_ids[1 + floor(random()*array_length(v_type_ids,1))::int];
            v_sev_range := case when random() < 0.08 then 4 else 3 end;
            v_severity := v_severities[1 + floor(random()*v_sev_range)::int];
            insert into public.incidents (check_id, branch_id, type_id, severity, occurred_at, observation, created_by)
            values (v_check_id, v_branch.id, v_type_id, v_severity,
                    v_started + (floor(random()*10)::int * interval '1 minute'),
                    'Registrado durante la verificación de rutina.', v_op);
          end loop;
          update public.branch_checks set status = 'con_incidencia' where id = v_check_id;
        end if;
      end if;
    end loop;
  end loop;

  -- ---- Verificación de HOY para ~72% de las sucursales ----------------
  for v_branch in select id from public.branches loop
    if random() < 0.72 then
      v_op := v_monitoreo_ids[1 + floor(random() * array_length(v_monitoreo_ids,1))::int];
      v_started := current_date::timestamptz
                   + (8::int * interval '1 hour')
                   + (floor(random()*540)::int * interval '1 minute');
      v_duration := 150 + floor(random()*450)::int;

      insert into public.branch_checks (branch_id, operator_id, started_at, finished_at, status, duration_seconds)
      values (v_branch.id, v_op, v_started, v_started + (v_duration * interval '1 second'), 'verificada', v_duration)
      returning id into v_check_id;

      if random() < 0.22 then
        v_num_incidents := 1 + floor(random()*2)::int;
        for j in 1..v_num_incidents loop
          v_type_id := v_type_ids[1 + floor(random()*array_length(v_type_ids,1))::int];
          v_severity := v_severities[1 + floor(random()*3)::int];
          insert into public.incidents (check_id, branch_id, type_id, severity, occurred_at, observation, created_by)
          values (v_check_id, v_branch.id, v_type_id, v_severity, v_started,
                  'Registrado durante la verificación de hoy.', v_op);
        end loop;
        update public.branch_checks set status = 'con_incidencia' where id = v_check_id;
      end if;
    end if;
  end loop;

  -- ---- Recalcular el Score de todas las sucursales --------------------
  for v_branch in select id from public.branches loop
    perform public.recalc_branch_score(v_branch.id, 'seed');
  end loop;

  raise notice 'Historial demo generado correctamente.';
end $$;
