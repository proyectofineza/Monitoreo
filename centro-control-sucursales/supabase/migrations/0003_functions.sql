-- =====================================================================
-- 0003_functions.sql
-- Cálculo de Score, auditoría y notificaciones automáticas.
-- Corré esto después de 0002_rls.sql.
--
-- Nota: estas funciones son SECURITY DEFINER y las crea el rol dueño
-- de las tablas (normalmente "postgres"), por lo que sus escrituras
-- en branch_scores / score_history / audit_logs / notifications no
-- pasan por RLS — es la manera estándar de tener "triggers de sistema"
-- que el cliente no puede falsificar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cálculo de Score (fórmula configurable desde la tabla settings)
-- ---------------------------------------------------------------------
create or replace function public.recalc_branch_score(p_branch_id uuid, p_reason text default 'recalc')
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_formula jsonb;
  v_base int; v_baja int; v_media int; v_alta int; v_critica int;
  v_recur_pen int; v_recur_dias int; v_recur_umbral int := 5;
  v_penalty int := 0;
  v_recent_count int := 0;
  v_score int;
  v_total_checks int;
  v_total_incidents int;
  v_critical_incidents int;
  v_last_incident timestamptz;
begin
  select value into v_formula from public.settings where key = 'score_formula';
  v_base       := coalesce((v_formula->>'base')::int, 100);
  v_baja       := coalesce((v_formula->>'baja')::int, 2);
  v_media      := coalesce((v_formula->>'media')::int, 5);
  v_alta       := coalesce((v_formula->>'alta')::int, 10);
  v_critica    := coalesce((v_formula->>'critica')::int, 20);
  v_recur_pen  := coalesce((v_formula->>'recurrencia_penalizacion')::int, 6);
  v_recur_dias := coalesce((v_formula->>'recurrencia_umbral_dias')::int, 30);

  select
    coalesce(sum(case i.severity
      when 'baja' then v_baja when 'media' then v_media
      when 'alta' then v_alta when 'critica' then v_critica else 0 end), 0),
    count(*)
  into v_penalty, v_recent_count
  from public.incidents i
  where i.branch_id = p_branch_id
    and i.deleted_at is null
    and i.occurred_at >= now() - (v_recur_dias || ' days')::interval;

  v_score := v_base - v_penalty;
  if v_recent_count > v_recur_umbral then
    v_score := v_score - v_recur_pen;
  end if;
  v_score := greatest(20, least(100, v_score));

  select count(*) into v_total_checks
  from public.branch_checks where branch_id = p_branch_id and finished_at is not null;

  select count(*), count(*) filter (where severity = 'critica')
  into v_total_incidents, v_critical_incidents
  from public.incidents where branch_id = p_branch_id and deleted_at is null;

  select max(occurred_at) into v_last_incident
  from public.incidents where branch_id = p_branch_id and deleted_at is null;

  insert into public.branch_scores (branch_id, score, total_checks, total_incidents, critical_incidents, last_incident_at, updated_at)
  values (p_branch_id, v_score, v_total_checks, v_total_incidents, v_critical_incidents, v_last_incident, now())
  on conflict (branch_id) do update set
    score = excluded.score,
    total_checks = excluded.total_checks,
    total_incidents = excluded.total_incidents,
    critical_incidents = excluded.critical_incidents,
    last_incident_at = excluded.last_incident_at,
    updated_at = now();

  insert into public.score_history (branch_id, score, reason) values (p_branch_id, v_score, p_reason);
end;
$$;

-- Se recalcula cada vez que se crea, edita o elimina (soft) una incidencia.
create or replace function public.trg_incidents_recalc()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_branch_score(coalesce(new.branch_id, old.branch_id), 'incident_change');
  return coalesce(new, old);
end;
$$;

drop trigger if exists incidents_recalc on public.incidents;
create trigger incidents_recalc
  after insert or update or delete on public.incidents
  for each row execute function public.trg_incidents_recalc();

-- Al finalizar una verificación (se completa finished_at), se calcula la
-- duración automáticamente si no vino cargada, y se recalcula el score
-- (para que quede un punto de score_history aunque no haya incidencias).
create or replace function public.trg_checks_finish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.finished_at is not null and old.finished_at is null then
    if new.duration_seconds is null then
      new.duration_seconds := extract(epoch from (new.finished_at - new.started_at))::int;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists checks_finish_before on public.branch_checks;
create trigger checks_finish_before
  before update on public.branch_checks
  for each row execute function public.trg_checks_finish();

create or replace function public.trg_checks_recalc_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.finished_at is not null and old.finished_at is null then
    perform public.recalc_branch_score(new.branch_id, 'check_completed');
  end if;
  return new;
end;
$$;

drop trigger if exists checks_finish_after on public.branch_checks;
create trigger checks_finish_after
  after update on public.branch_checks
  for each row execute function public.trg_checks_recalc_after();

-- ---------------------------------------------------------------------
-- Notificación automática ante incidencia crítica
-- ---------------------------------------------------------------------
create or replace function public.trg_incident_critical_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_branch_name text;
  v_type_label text;
begin
  if new.severity = 'critica' then
    select name into v_branch_name from public.branches where id = new.branch_id;
    select label into v_type_label from public.incident_types where id = new.type_id;
    insert into public.notifications (kind, title, body, branch_id, incident_id)
    values (
      'incident_critical',
      'Incidencia crítica — ' || coalesce(v_branch_name, 'Sucursal'),
      coalesce(v_type_label, 'Incidencia') || coalesce(': ' || new.observation, ''),
      new.branch_id,
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists incident_critical_notify on public.incidents;
create trigger incident_critical_notify
  after insert on public.incidents
  for each row execute function public.trg_incident_critical_notify();

-- ---------------------------------------------------------------------
-- Auditoría genérica (no se borra nada físicamente: soft delete en las
-- tablas que lo soportan; audit_logs deja constancia de todo cambio)
-- ---------------------------------------------------------------------
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
  values (
    TG_TABLE_NAME,
    coalesce((case when TG_OP = 'DELETE' then old.id else new.id end)::text, ''),
    TG_OP,
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE','INSERT') then to_jsonb(new) else null end,
    auth.uid()
  );
  if TG_OP = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists audit_branches on public.branches;
create trigger audit_branches after insert or update or delete on public.branches
  for each row execute function public.audit_trigger();

drop trigger if exists audit_incident_types on public.incident_types;
create trigger audit_incident_types after insert or update or delete on public.incident_types
  for each row execute function public.audit_trigger();

drop trigger if exists audit_employees on public.employees;
create trigger audit_employees after insert or update or delete on public.employees
  for each row execute function public.audit_trigger();

drop trigger if exists audit_incidents on public.incidents;
create trigger audit_incidents after insert or update or delete on public.incidents
  for each row execute function public.audit_trigger();

drop trigger if exists audit_branch_checks on public.branch_checks;
create trigger audit_branch_checks after insert or update or delete on public.branch_checks
  for each row execute function public.audit_trigger();

drop trigger if exists audit_settings on public.settings;
create trigger audit_settings after insert or update or delete on public.settings
  for each row execute function public.audit_trigger();
