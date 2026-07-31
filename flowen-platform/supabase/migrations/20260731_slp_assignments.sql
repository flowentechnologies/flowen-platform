create table if not exists slp_assignments (
  id uuid primary key default gen_random_uuid(),
  slp_user_id uuid not null references auth.users(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by text,
  notes text,
  unique(slp_user_id, patient_user_id)
);
alter table slp_assignments enable row level security;
create policy "slp_see_own" on slp_assignments for select
  using (slp_user_id = auth.uid() or patient_user_id = auth.uid());

create table if not exists slp_session_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references practice_sessions(id) on delete cascade,
  slp_user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, slp_user_id)
);
alter table slp_session_notes enable row level security;
create policy "slp_manage_notes" on slp_session_notes for all
  using (slp_user_id = auth.uid());
