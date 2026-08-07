-- ── Affiliates ────────────────────────────────────────────────────────────────
-- Partners who refer users to Flowen (SLTs, SEND schools, influencers, etc.)

create table if not exists affiliates (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  name              text not null,
  email             text not null,
  code              text not null unique,        -- e.g. "SLT-JANE", "SEND-BIRMINGHAM"
  tier              text not null default 'standard'
                      check (tier in ('standard','premium','partner')),
  status            text not null default 'pending'
                      check (status in ('pending','active','suspended','rejected')),
  commission_pct    numeric(5,2) not null default 20.00,   -- % of first payment
  recurring_months  integer not null default 3,             -- how many months commission applies
  channel           text,                                    -- e.g. "SLT community","SEND school","social"
  website           text,
  notes             text,
  approved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists affiliates_code_idx  on affiliates(code);
create index if not exists affiliates_email_idx on affiliates(email);
create index if not exists affiliates_status_idx on affiliates(status);

alter table affiliates enable row level security;
create policy "admin_full" on affiliates using (true) with check (true);

-- ── Affiliate Clicks ──────────────────────────────────────────────────────────
-- Raw click events written by the public referral middleware

create table if not exists affiliate_clicks (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references affiliates(id) on delete cascade,
  ip_hash       text,                     -- hashed for privacy
  user_agent    text,
  landing_path  text,
  created_at    timestamptz not null default now()
);

create index if not exists affiliate_clicks_affiliate_idx on affiliate_clicks(affiliate_id);
create index if not exists affiliate_clicks_created_idx   on affiliate_clicks(created_at desc);

alter table affiliate_clicks enable row level security;
create policy "admin_full" on affiliate_clicks using (true) with check (true);

-- ── Affiliate Conversions ─────────────────────────────────────────────────────
-- A conversion = a referred user who signs up (and optionally pays)

create table if not exists affiliate_conversions (
  id              uuid primary key default gen_random_uuid(),
  affiliate_id    uuid not null references affiliates(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  event_type      text not null default 'signup'
                    check (event_type in ('signup','subscription','renewal')),
  subscription_id text,                    -- Stripe subscription id if applicable
  amount_pence    integer,                 -- value of the triggering event
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists affiliate_conversions_affiliate_idx on affiliate_conversions(affiliate_id);
create index if not exists affiliate_conversions_user_idx      on affiliate_conversions(referred_user_id);

alter table affiliate_conversions enable row level security;
create policy "admin_full" on affiliate_conversions using (true) with check (true);

-- ── Affiliate Commissions ─────────────────────────────────────────────────────
-- Individual commission line items earned by affiliates

create table if not exists affiliate_commissions (
  id              uuid primary key default gen_random_uuid(),
  affiliate_id    uuid not null references affiliates(id) on delete cascade,
  conversion_id   uuid references affiliate_conversions(id) on delete set null,
  amount_pence    integer not null,
  status          text not null default 'pending'
                    check (status in ('pending','approved','paid','rejected','cancelled')),
  description     text,
  payout_id       uuid,                    -- FK added below after payouts table
  approved_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists affiliate_commissions_affiliate_idx on affiliate_commissions(affiliate_id);
create index if not exists affiliate_commissions_status_idx    on affiliate_commissions(status);

alter table affiliate_commissions enable row level security;
create policy "admin_full" on affiliate_commissions using (true) with check (true);

-- ── Affiliate Payouts ─────────────────────────────────────────────────────────
-- Batched payment runs to affiliates

create table if not exists affiliate_payouts (
  id              uuid primary key default gen_random_uuid(),
  affiliate_id    uuid not null references affiliates(id) on delete cascade,
  amount_pence    integer not null,
  commission_count integer not null default 0,
  status          text not null default 'pending'
                    check (status in ('pending','processing','paid','failed')),
  payment_method  text,                    -- bank_transfer, paypal, stripe
  payment_ref     text,
  notes           text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

alter table affiliate_commissions
  add constraint affiliate_commissions_payout_fk
  foreign key (payout_id) references affiliate_payouts(id) on delete set null;

create index if not exists affiliate_payouts_affiliate_idx on affiliate_payouts(affiliate_id);
create index if not exists affiliate_payouts_status_idx    on affiliate_payouts(status);

alter table affiliate_payouts enable row level security;
create policy "admin_full" on affiliate_payouts using (true) with check (true);
