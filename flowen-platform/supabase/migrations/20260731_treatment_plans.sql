create table if not exists treatment_plans (
  id uuid primary key default gen_random_uuid(),
  slp_user_id uuid not null references auth.users(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  prescribed_stages integer[] not null default '{1}',
  sessions_per_week integer not null default 3,
  minutes_per_session integer not null default 10,
  phase text not null default 'Establishment',
  goals text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(slp_user_id, patient_user_id)
);
alter table treatment_plans enable row level security;
create policy "slp_manage_plans" on treatment_plans for all
  using (slp_user_id = auth.uid());
create policy "patient_read_plan" on treatment_plans for select
  using (patient_user_id = auth.uid());
