-- ── Venture: investor CRM ─────────────────────────────────────────────────────

create table if not exists investors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  firm           text,
  email          text,
  stage          text not null default 'researched'
                   check (stage in ('researched','contacted','warm','in_diligence','term_sheet','committed','passed','on_hold')),
  last_contact_at timestamptz,
  next_action    text,
  amount_pence   integer,
  notes          text,
  created_at     timestamptz not null default now()
);

alter table investors enable row level security;
create policy "service role full access" on investors using (true) with check (true);

-- ── Venture: round config (single-row) ───────────────────────────────────────

create table if not exists venture_config (
  id                          integer primary key default 1,
  round_type                  text check (round_type in ('pre_seed','seed','seed_bridge','series_a')),
  target_raise_pence          integer,
  committed_pence             integer,
  valuation_cap_pence         integer,
  instrument                  text check (instrument in ('safe','convertible_note','equity')),
  seis_advance_assurance      boolean not null default false,
  seis_limit_remaining_pence  integer,
  eis_eligible                boolean not null default false,
  notes                       text,
  updated_at                  timestamptz not null default now(),
  constraint single_row check (id = 1)
);

alter table venture_config enable row level security;
create policy "service role full access" on venture_config using (true) with check (true);

-- Seed with an empty config row so the UI can read/update immediately
insert into venture_config (id) values (1) on conflict (id) do nothing;

-- ── Compliance: per-item status store ────────────────────────────────────────

create table if not exists compliance_items (
  id           uuid primary key default gen_random_uuid(),
  framework    text not null
                 check (framework in ('dcb0129','dtac','dspt','mhra','wcag')),
  item_code    text not null,
  status       text not null default 'not_started'
                 check (status in ('not_started','in_progress','complete','not_applicable','blocked')),
  notes        text,
  evidence_url text,
  updated_at   timestamptz not null default now(),
  unique (framework, item_code)
);

alter table compliance_items enable row level security;
create policy "service role full access" on compliance_items using (true) with check (true);

-- ── Pitch deck: investor access links ────────────────────────────────────────

create table if not exists deck_invites (
  id              uuid primary key default gen_random_uuid(),
  investor_name   text not null,
  investor_email  text,
  firm            text,
  token           text not null unique,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz,
  revoked         boolean not null default false,
  view_count      integer not null default 0,
  last_viewed_at  timestamptz
);

alter table deck_invites enable row level security;
create policy "service role full access" on deck_invites using (true) with check (true);

-- ── Pitch deck: view log ──────────────────────────────────────────────────────

create table if not exists deck_views (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references deck_invites (id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  ip_address  text,
  user_agent  text
);

create index if not exists deck_views_invite_id_idx on deck_views (invite_id);

alter table deck_views enable row level security;
create policy "service role full access" on deck_views using (true) with check (true);
