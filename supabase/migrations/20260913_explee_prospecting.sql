-- New prospecting surface: find-and-enrich + search (genuine new-prospect
-- discovery, confirmed buildable against Explee's real OpenAPI spec —
-- unlike the outreach/inbox API alone, which has no "not yet contacted"
-- list at all) and importing selected results into a brand-new Explee
-- campaign. Billable per email found (1.5-5 credits), so this is always a
-- deliberate admin action, never a cron.

create table if not exists explee_searches (
  id               uuid primary key default gen_random_uuid(),
  task_id          text unique not null, -- Explee's find-and-enrich task_id
  status           text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  people_filters   jsonb,
  company_filters  jsonb,
  max_contacts     integer not null,
  preset           text not null default 'basic' check (preset in ('basic', 'premium')),
  credits_charged  numeric,
  error            text,
  created_by       text,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create table if not exists explee_prospects (
  id                   uuid primary key default gen_random_uuid(),
  search_id            uuid not null references explee_searches(id) on delete cascade,
  first_name           text,
  last_name            text,
  title                text,
  linkedin_url         text,
  company_name         text,
  company_domain       text,
  email                text,
  email_status         text,
  -- Set once this prospect has actually been imported into a real Explee
  -- campaign (see explee_campaign_imports) — lets the UI grey out a
  -- prospect that's already been sent to outreach instead of double-importing.
  imported_campaign_id integer,
  imported_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists explee_prospects_search_id_idx on explee_prospects (search_id);
create index if not exists explee_prospects_company_domain_idx on explee_prospects (company_domain);

create table if not exists explee_campaign_imports (
  id            uuid primary key default gen_random_uuid(),
  task_id       text unique not null, -- Explee's campaign-import task_id
  campaign_name text not null,
  prospect_ids  uuid[] not null,
  status        text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  campaign_id   integer, -- the new Explee campaign, once the import completes
  error         text,
  created_by    text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

comment on table explee_searches is 'One row per find-and-enrich job run from /admin/prospecting — the filters used, Explee''s task_id, and how many credits it ended up costing.';
comment on table explee_prospects is 'Enriched people found by a search — only rows with a found email are ever stored, matching what find-and-enrich itself returns.';
comment on table explee_campaign_imports is 'One row per "create an Explee campaign from selected prospects" action — tracks the async import task until Explee reports the new campaign_id.';
