-- 2026-09-29 tracking repair: consent records, conversion milestones,
-- attribution diagnostics.
--
-- consent_records     — server-verifiable, timestamped consent state bound to
--                       the visitor (anonymous_id) and/or user (user_id).
--                       Latest row wins; a 'necessary' row after an 'all' row
--                       is a revocation. Read/written by the service role only.
-- conversion_milestones — authoritative, idempotent business milestones.
--                       unique(milestone, external_id) makes every downstream
--                       analytics event exactly-once:
--                         signup              external_id = user_id
--                         onboarding_complete external_id = user_id
--                         paid_purchase       external_id = Stripe invoice ID

create table if not exists public.consent_records (
  id           uuid primary key default gen_random_uuid(),
  anonymous_id text,
  user_id      uuid,
  decision     text not null check (decision in ('all', 'necessary')),
  purposes     text[] not null default '{}',
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists consent_records_anonymous_id_idx
  on public.consent_records (anonymous_id, created_at desc);
create index if not exists consent_records_user_id_idx
  on public.consent_records (user_id, created_at desc);

alter table public.consent_records enable row level security;
-- No anon/authenticated policies: service role only.

create table if not exists public.conversion_milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  milestone   text not null,
  external_id text not null default '',
  recorded_at timestamptz not null default now(),
  unique (milestone, external_id)
);

alter table public.conversion_milestones enable row level security;
-- No anon/authenticated policies: service role only.

alter table public.marketing_attribution
  add column if not exists signup_event_id  uuid,
  add column if not exists meta_last_error   text,
  add column if not exists google_last_error text;
