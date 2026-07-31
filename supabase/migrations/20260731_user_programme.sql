create table if not exists user_programme (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_week integer not null default 1,
  week_started_at timestamptz not null default now(),
  completed_weeks integer[] not null default '{}',
  started_at timestamptz not null default now()
);
alter table user_programme enable row level security;
create policy "user_own_programme" on user_programme for all using (user_id = auth.uid());
