create table if not exists feature_flags (
  id           uuid    primary key default gen_random_uuid(),
  key          text    unique not null,
  name         text    not null,
  description  text,
  enabled      boolean not null default false,
  rollout_pct  integer not null default 100
                 check (rollout_pct between 0 and 100),
  allowed_tiers text[],          -- null = all tiers; e.g. '{founding,standard}'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table feature_flags enable row level security;
create policy "service role full access" on feature_flags using (true) with check (true);
