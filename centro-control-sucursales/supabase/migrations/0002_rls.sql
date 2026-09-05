-- =====================================================================
-- 0002_rls.sql
-- Row Level Security — la autorización real vive en la base, no en la UI.
-- Corré esto después de 0001_schema.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.current_role()
returns public.app_role
language sql security definer stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_role(variadic roles public.app_role[])
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = any(roles), false);
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- No hay policy de insert/update/delete para el rol authenticated:
-- la creación de perfiles la hace el trigger (dueño de tabla, sin RLS)
-- y los cambios de rol se hacen únicamente vía la Edge Function
-- admin-set-role, que usa la service role key (bypassa RLS).

-- ---------------------------------------------------------------------
-- branches
-- ---------------------------------------------------------------------
alter table public.branches enable row level security;

create policy "branches_select_authenticated"
  on public.branches for select to authenticated using (true);

create policy "branches_write_admin"
  on public.branches for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- ---------------------------------------------------------------------
-- incident_types
-- ---------------------------------------------------------------------
alter table public.incident_types enable row level security;

create policy "incident_types_select_authenticated"
  on public.incident_types for select to authenticated using (true);

create policy "incident_types_write_admin"
  on public.incident_types for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- ---------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------
alter table public.employees enable row level security;

create policy "employees_select_authenticated"
  on public.employees for select to authenticated using (true);

create policy "employees_write_admin"
  on public.employees for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- ---------------------------------------------------------------------
-- branch_checks
-- ---------------------------------------------------------------------
alter table public.branch_checks enable row level security;

-- Admin, supervisor y RRHH ven todas las verificaciones.
create policy "branch_checks_select_wide"
  on public.branch_checks for select to authenticated
  using (public.has_role('admin','supervisor','rrhh'));

-- Monitoreo solo ve las suyas.
create policy "branch_checks_select_own"
  on public.branch_checks for select to authenticated
  using (public.has_role('monitoreo') and operator_id = auth.uid());

-- Monitoreo (y admin) inician verificaciones a su propio nombre.
create policy "branch_checks_insert_own"
  on public.branch_checks for insert to authenticated
  with check (operator_id = auth.uid() and public.has_role('monitoreo','admin'));

-- Solo quien la inició (o admin) puede finalizarla/editarla.
create policy "branch_checks_update_own"
  on public.branch_checks for update to authenticated
  using (operator_id = auth.uid() or public.has_role('admin'))
  with check (operator_id = auth.uid() or public.has_role('admin'));

-- ---------------------------------------------------------------------
-- incidents
-- ---------------------------------------------------------------------
alter table public.incidents enable row level security;

create policy "incidents_select_wide"
  on public.incidents for select to authenticated
  using (public.has_role('admin','supervisor','rrhh') and deleted_at is null);

create policy "incidents_select_own"
  on public.incidents for select to authenticated
  using (public.has_role('monitoreo') and created_by = auth.uid() and deleted_at is null);

create policy "incidents_insert_own"
  on public.incidents for insert to authenticated
  with check (created_by = auth.uid() and public.has_role('monitoreo','admin'));

create policy "incidents_update_admin"
  on public.incidents for update to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- ---------------------------------------------------------------------
-- branch_scores / score_history — solo lectura desde el cliente,
-- se recalculan por trigger (dueño de tabla, sin RLS de por medio).
-- ---------------------------------------------------------------------
alter table public.branch_scores enable row level security;
create policy "branch_scores_select_authenticated"
  on public.branch_scores for select to authenticated using (true);

alter table public.score_history enable row level security;
create policy "score_history_select_authenticated"
  on public.score_history for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- audit_logs — visibilidad exclusiva de Admin
-- ---------------------------------------------------------------------
alter table public.audit_logs enable row level security;
create policy "audit_logs_select_admin"
  on public.audit_logs for select to authenticated
  using (public.has_role('admin'));

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
alter table public.notifications enable row level security;
create policy "notifications_select_authenticated"
  on public.notifications for select to authenticated
  using (public.has_role('admin','supervisor','monitoreo'));

create policy "notifications_update_read"
  on public.notifications for update to authenticated
  using (public.has_role('admin','supervisor','monitoreo'))
  with check (public.has_role('admin','supervisor','monitoreo'));

-- ---------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------
alter table public.settings enable row level security;
create policy "settings_select_authenticated"
  on public.settings for select to authenticated using (true);

create policy "settings_write_admin"
  on public.settings for update to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));
