-- Shareholders and equity holders
create table if not exists cap_table_entries (
  id                uuid primary key default gen_random_uuid(),
  holder_name       text not null,
  holder_type       text not null default 'founder'
                      check (holder_type in ('founder','investor','employee','advisor','pool')),
  instrument        text not null default 'ordinary_shares'
                      check (instrument in ('ordinary_shares','preference_shares','safe_note','convertible_loan','emi_option','unapproved_option','warrant')),
  shares            integer,               -- null for SAFEs/convertibles (no fixed share count yet)
  share_class       text,                  -- e.g. 'A Ordinary', 'Seed Preference'
  price_per_share_pence integer,           -- subscription price
  amount_pence      integer,               -- total invested / loan amount / option value
  valuation_cap_pence integer,             -- for SAFEs / convertible notes
  discount_pct      numeric(5,2),          -- conversion discount %
  interest_rate_pct numeric(5,2),          -- for convertible loans
  vesting_start     date,
  vesting_months    integer,               -- total vesting period
  cliff_months      integer,               -- cliff before any vests
  seis_eligible     boolean not null default false,
  eis_eligible      boolean not null default false,
  certificate_ref   text,                  -- share certificate number
  issued_at         date,
  notes             text,
  created_at        timestamptz not null default now()
);

alter table cap_table_entries enable row level security;
create policy "service role full access" on cap_table_entries using (true) with check (true);
