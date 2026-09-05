-- =====================================================================
-- 0001_schema.sql
-- Centro de Control de Sucursales — esquema base
-- Corré este archivo primero en el SQL Editor de tu proyecto Supabase
-- (o con `supabase db push` si usás la CLI).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin','supervisor','monitoreo','rrhh');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.check_status as enum ('en_revision','verificada','con_incidencia');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.incident_severity as enum ('baja','media','alta','critica');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- branches (Sucursales)
-- ---------------------------------------------------------------------
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  city text not null,
  department text,
  lat double precision,
  lng double precision,
  open_time time,
  close_time time,
  camera_count int not null default 0,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists branches_city_idx on public.branches(city);

-- ---------------------------------------------------------------------
-- profiles (1:1 con auth.users) — perfil + rol de cada usuario
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'monitoreo',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Crea automáticamente un perfil cuando se registra un usuario nuevo en Auth.
-- El rol por defecto es 'monitoreo'; un admin lo cambia después desde
-- Administración > Usuarios (usa la Edge Function admin-set-role).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'monitoreo')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- employees (personal de las sucursales, para incidencias de RRHH)
-- ---------------------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  branch_id uuid references public.branches(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- incident_types (catálogo de tipos de incidencia)
-- ---------------------------------------------------------------------
create table if not exists public.incident_types (
  id smallint generated always as identity primary key,
  code text not null unique,
  label text not null,
  is_personnel boolean not null default true,
  active boolean not null default true,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- branch_checks (verificaciones)
-- ---------------------------------------------------------------------
create table if not exists public.branch_checks (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  operator_id uuid not null references public.profiles(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.check_status not null default 'en_revision',
  duration_seconds int,
  created_at timestamptz not null default now()
);

-- Regla de negocio: una sucursal no puede tener dos verificaciones
-- abiertas (sin finalizar) al mismo tiempo.
create unique index if not exists one_open_check_per_branch
  on public.branch_checks(branch_id) where finished_at is null;

create index if not exists branch_checks_branch_idx on public.branch_checks(branch_id);
create index if not exists branch_checks_operator_idx on public.branch_checks(operator_id);
create index if not exists branch_checks_started_idx on public.branch_checks(started_at);

-- ---------------------------------------------------------------------
-- incidents (incidencias)
-- ---------------------------------------------------------------------
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.branch_checks(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  type_id smallint not null references public.incident_types(id),
  severity public.incident_severity not null,
  employee_id uuid references public.employees(id),
  employee_name_freeform text,
  occurred_at timestamptz not null default now(),
  observation text,
  status text not null default 'abierta' check (status in ('abierta','cerrada')),
  evidence_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists incidents_branch_idx on public.incidents(branch_id);
create index if not exists incidents_check_idx on public.incidents(check_id);
create index if not exists incidents_severity_idx on public.incidents(severity);
create index if not exists incidents_occurred_idx on public.incidents(occurred_at);

-- ---------------------------------------------------------------------
-- branch_scores (score actual — 1 fila por sucursal) y score_history
-- ---------------------------------------------------------------------
create table if not exists public.branch_scores (
  branch_id uuid primary key references public.branches(id),
  score int not null default 100,
  total_checks int not null default 0,
  total_incidents int not null default 0,
  critical_incidents int not null default 0,
  last_incident_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.score_history (
  id bigint generated always as identity primary key,
  branch_id uuid not null references public.branches(id),
  score int not null,
  recorded_at timestamptz not null default now(),
  reason text not null default 'recalc'
);
create index if not exists score_history_branch_idx on public.score_history(branch_id, recorded_at);

-- ---------------------------------------------------------------------
-- audit_logs (auditoría — nunca se borran físicamente los registros)
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index if not exists audit_logs_table_idx on public.audit_logs(table_name, changed_at);

-- ---------------------------------------------------------------------
-- notifications (arquitectura para alertas — críticas por ahora)
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  kind text not null default 'incident_critical',
  title text not null,
  body text,
  branch_id uuid references public.branches(id),
  incident_id uuid references public.incidents(id),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- settings (fórmula de score configurable, clave/valor)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('score_formula', '{"base":100,"baja":2,"media":5,"alta":10,"critica":20,"recurrencia_penalizacion":6,"recurrencia_umbral_dias":30}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- updated_at genérico
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists branches_set_updated_at on public.branches;
create trigger branches_set_updated_at before update on public.branches
  for each row execute function public.set_updated_at();
