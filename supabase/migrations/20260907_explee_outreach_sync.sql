-- Full Explee outreach ledger: campaign performance, every contacted
-- person (not just the ones who went hot), and every email/reply in each
-- conversation. Complements crm_contacts (the business pipeline, fed by
-- the separate hot-leads sync) with the underlying send-level detail —
-- "what did we actually send, and who's talked back."
--
-- Admin-only, service-role access (matches crm_contacts / campaign_contacts
-- convention elsewhere in this schema) — RLS enabled, no policies needed.

create table explee_campaigns (
  id                     integer primary key,  -- Explee's own campaign id, not ours
  project_id             integer not null,
  name                   text not null,
  status                 text,
  status_reason          text,
  daily_budget_usd       numeric,
  emails_sent            integer not null default 0,
  total_replies          integer not null default 0,
  reply_rate_pct         numeric,
  hot_leads              integer not null default 0,
  spend_usd              numeric,
  cost_per_lead_usd      numeric,
  leads_pool_used        integer,
  leads_pool_total       integer,
  leads_pool_pending     integer,
  collected_leads_total  integer,
  cold_lost              integer,
  manual_status_counts   jsonb,
  synced_at              timestamptz not null default now()
);
alter table explee_campaigns enable row level security;

create table explee_contacts (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      integer not null references explee_campaigns(id) on delete cascade,
  person_id        text not null,
  email            text,     -- Explee hides this until the person replies
  name             text,
  latest_subject   text,
  latest_sent_at   timestamptz,
  latest_reply_at  timestamptz,
  latest_intent    text,     -- hot_lead, not_interested, out_of_office, unsubscribe, ...
  sent_count       integer not null default 0,
  reply_count      integer not null default 0,
  crm_contact_id   uuid references crm_contacts(id) on delete set null,
  synced_at        timestamptz not null default now(),
  unique (campaign_id, person_id)
);
alter table explee_contacts enable row level security;
create index explee_contacts_intent_idx on explee_contacts(latest_intent);
create index explee_contacts_email_idx  on explee_contacts(email);

create table explee_messages (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   integer not null references explee_campaigns(id) on delete cascade,
  person_id     text not null,
  message_id    text,  -- RFC Message-ID; occasionally null for edge states
  type          text not null check (type in ('sent','reply')),
  from_email    text,
  to_email      text,
  subject       text,
  body_text     text,
  intent        text,
  status        text,
  in_reply_to   text,
  sent_at       timestamptz,
  synced_at     timestamptz not null default now()
);
alter table explee_messages enable row level security;
-- Strong dedupe for the normal case (message_id present); rows without one
-- are deduped by the sync job comparing against what's already stored.
create unique index explee_messages_message_id_idx
  on explee_messages(campaign_id, person_id, message_id) where message_id is not null;
create index explee_messages_person_idx on explee_messages(campaign_id, person_id);

-- Lightweight trend log: one row per sync run in which project-wide
-- numbers actually changed (not one row per run regardless), so this
-- stays a meaningful "what changed and when" history rather than noise.
create table explee_analytics_snapshots (
  id                      uuid primary key default gen_random_uuid(),
  project_id              integer not null,
  total_emails_sent       integer not null,
  total_replies           integer not null,
  total_auto_replies      integer not null,
  overall_reply_rate_pct  numeric not null,
  total_hot_leads         integer not null,
  total_spend_usd         numeric not null,
  captured_at             timestamptz not null default now()
);
alter table explee_analytics_snapshots enable row level security;
create index explee_analytics_snapshots_project_idx on explee_analytics_snapshots(project_id, captured_at desc);
