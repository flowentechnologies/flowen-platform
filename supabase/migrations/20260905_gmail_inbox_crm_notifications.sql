-- Gmail inbox automation, vendor billing extraction, unified CRM pipeline,
-- and a generic in-admin notification feed.
--
-- All aliases (hello@, security@, press@, investors@, billing@, etc.) already
-- route into the single admin@flowen.digital Workspace mailbox (see
-- src/lib/email.ts FROM comment) — so this is a single-mailbox OAuth grant,
-- not domain-wide delegation. Gmail API scopes needed: gmail.modify,
-- gmail.settings.basic, gmail.settings.sharing (the last one specifically
-- required by Gmail's API to create "send as" aliases).
--
-- Every table here is service-role only (adminDb), same convention as
-- social_platform_tokens: RLS enabled, no policies, so anon/authenticated
-- get zero access regardless of any future policy mistake elsewhere.

-- ── OAuth token storage (single row — one mailbox: admin@) ────────────────────
create table if not exists gmail_oauth_tokens (
  id            text primary key default 'admin',
  mailbox       text not null default 'admin@flowen.digital',
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,
  scope         text,
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table gmail_oauth_tokens enable row level security;

-- ── Synced inbox items ─────────────────────────────────────────────────────────
create table if not exists inbox_items (
  id              uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id  text not null,
  alias           text not null,               -- which @flowen.digital address received it
  from_address    text not null,
  from_name       text,
  to_addresses    jsonb not null default '[]',
  subject         text,
  snippet         text,
  body_text       text,
  received_at     timestamptz not null,
  category        text not null default 'general'
                    check (category in ('general','billing','crm','press','security','support','careers','affiliates','other')),
  is_billing      boolean not null default false,
  vendor_name     text,
  crm_contact_id  uuid,
  status          text not null default 'unread'
                    check (status in ('unread','read','responded','archived')),
  labels_applied  jsonb not null default '[]',
  created_at      timestamptz not null default now()
);
alter table inbox_items enable row level security;
create index if not exists inbox_items_alias_idx on inbox_items(alias);
create index if not exists inbox_items_category_idx on inbox_items(category);
create index if not exists inbox_items_received_at_idx on inbox_items(received_at desc);

-- ── Vendor / service-provider billing extracted from inbox items ──────────────
create table if not exists vendor_invoices (
  id            uuid primary key default gen_random_uuid(),
  inbox_item_id uuid references inbox_items(id) on delete set null,
  vendor_name   text not null,
  amount_pence  bigint,
  currency      text default 'gbp',
  invoice_date  date,
  description   text,
  created_at    timestamptz not null default now()
);
alter table vendor_invoices enable row level security;
create index if not exists vendor_invoices_vendor_idx on vendor_invoices(vendor_name);

-- ── Unified CRM pipeline (investors, grants, NHS partners, press, affiliates) ──
create table if not exists crm_contacts (
  id             uuid primary key default gen_random_uuid(),
  name           text,
  email          text not null unique,
  company        text,
  category       text not null default 'other'
                   check (category in ('investor','grant','nhs_partner','press','affiliate','vendor','other')),
  stage          text not null default 'new'
                   check (stage in ('new','contacted','in_discussion','won','lost')),
  source         text,                          -- e.g. 'inbox:investors@', 'manual'
  last_contact_at timestamptz,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table crm_contacts enable row level security;
create index if not exists crm_contacts_category_idx on crm_contacts(category);
create index if not exists crm_contacts_stage_idx on crm_contacts(stage);

alter table inbox_items
  add constraint inbox_items_crm_contact_fk
  foreign key (crm_contact_id) references crm_contacts(id) on delete set null;

-- ── AI-drafted responses / outreach, queued for admin approval ─────────────────
-- Nothing here is ever sent automatically — status only moves to 'sent' via
-- an explicit admin action in /admin/inbox, per the founder's own instruction
-- that all outreach and responses go through manual approval.
create table if not exists ai_drafts (
  id             uuid primary key default gen_random_uuid(),
  draft_type     text not null check (draft_type in ('reply','outreach')),
  inbox_item_id  uuid references inbox_items(id) on delete cascade,
  crm_contact_id uuid references crm_contacts(id) on delete set null,
  to_address     text not null,
  from_alias     text not null,                 -- which alias this should send as
  subject        text,
  body_text      text not null,
  confidence_pct integer not null default 0 check (confidence_pct between 0 and 100),
  model          text,
  status         text not null default 'pending'
                   check (status in ('pending','approved','rejected','sent','edited_sent')),
  reviewed_by    uuid references profiles(id),
  reviewed_at    timestamptz,
  gmail_message_id text,                        -- set once actually sent via Gmail API
  created_at     timestamptz not null default now()
);
alter table ai_drafts enable row level security;
create index if not exists ai_drafts_status_idx on ai_drafts(status);

-- ── Generic in-admin notification feed (bell icon + dashboard widget) ──────────
create table if not exists admin_notifications (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('inbox_new','draft_pending','vendor_invoice','crm_new','system')),
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
alter table admin_notifications enable row level security;
create index if not exists admin_notifications_unread_idx on admin_notifications(read_at) where read_at is null;
