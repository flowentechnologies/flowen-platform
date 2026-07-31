create table if not exists roadmap_milestones (
  id            uuid primary key default gen_random_uuid(),
  phase         text not null
                  check (phase in ('launch','nhs_pilot','scale')),
  category      text not null default 'product'
                  check (category in ('product','compliance','commercial','fundraising','team')),
  title         text not null,
  description   text,
  status        text not null default 'planned'
                  check (status in ('planned','in_progress','complete','blocked','deferred')),
  target_date   date,
  completed_at  date,
  owner         text,
  priority      text not null default 'medium'
                  check (priority in ('critical','high','medium','low')),
  notes         text,
  created_at    timestamptz not null default now()
);

alter table roadmap_milestones enable row level security;
create policy "service role full access" on roadmap_milestones using (true) with check (true);
