-- =====================================================================
-- 0006_views.sql
-- Vistas de conveniencia para el frontend. Usan security_invoker para
-- que respeten las políticas RLS de quien consulta (no las del dueño).
-- =====================================================================

create or replace view public.branch_today_check
with (security_invoker = true) as
select distinct on (bc.branch_id)
  bc.branch_id, bc.id as check_id, bc.operator_id, bc.started_at,
  bc.finished_at, bc.status, bc.duration_seconds
from public.branch_checks bc
where bc.started_at >= date_trunc('day', now())
order by bc.branch_id, bc.started_at desc;

create or replace view public.branch_last_check
with (security_invoker = true) as
select distinct on (bc.branch_id)
  bc.branch_id, bc.id as check_id, bc.operator_id, bc.started_at,
  bc.finished_at, bc.status, bc.duration_seconds
from public.branch_checks bc
where bc.finished_at is not null
order by bc.branch_id, bc.finished_at desc;

-- Score actual + score anterior (para la flecha de tendencia ↑/↓/→ del
-- ranking) sin tener que hacer una consulta por sucursal desde el cliente.
create or replace view public.branch_score_latest
with (security_invoker = true) as
select distinct on (t.branch_id)
  t.branch_id, t.score, t.prev_score, t.recorded_at
from (
  select branch_id, score, recorded_at,
    lag(score) over (partition by branch_id order by recorded_at) as prev_score
  from public.score_history
) t
order by t.branch_id, t.recorded_at desc;

-- Incidencias "enriquecidas" con datos de sucursal/tipo/operador, para
-- no tener que hacer varios joins manuales desde el cliente.
create or replace view public.incidents_detailed
with (security_invoker = true) as
select
  i.id, i.check_id, i.branch_id, b.code as branch_code, b.name as branch_name, b.city as branch_city,
  i.type_id, t.label as type_label, t.is_personnel,
  i.severity, i.employee_id, e.full_name as employee_name, i.employee_name_freeform,
  i.occurred_at, i.observation, i.status, i.evidence_url,
  i.created_by, p.full_name as operator_name,
  i.created_at, i.deleted_at
from public.incidents i
join public.branches b on b.id = i.branch_id
join public.incident_types t on t.id = i.type_id
left join public.employees e on e.id = i.employee_id
left join public.profiles p on p.id = i.created_by;
