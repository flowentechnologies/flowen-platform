-- Adds lead/registration conversion counts to ad_platform_stats (previously
-- only spend/clicks/impressions — no way to compare "what the ad platform
-- reports as conversions" against real signups without this).
alter table ad_platform_stats
  add column if not exists leads integer default 0,
  add column if not exists registrations integer default 0;

-- Cross-system consistency checks: billing (Stripe vs Flowen), marketing
-- (ad platforms vs real signups), venture (generated docs vs venture_config).
-- Philosophy per founder decision: flag discrepancies for a human to
-- resolve, never auto-overwrite one system's data with another's guess.
create table if not exists consistency_checks (
  id         uuid primary key default gen_random_uuid(),
  check_type text not null check (check_type in ('billing', 'marketing', 'venture')),
  status     text not null check (status in ('ok', 'discrepancy', 'error')),
  summary    text not null,
  details    jsonb not null default '{}',
  checked_at timestamptz not null default now()
);
alter table consistency_checks enable row level security;
create index if not exists consistency_checks_type_idx on consistency_checks(check_type, checked_at desc);
