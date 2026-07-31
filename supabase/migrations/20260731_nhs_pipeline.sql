-- ── NHS ICB Pipeline ─────────────────────────────────────────────────────────

create table if not exists nhs_icb_contacts (
  id                 uuid primary key default gen_random_uuid(),
  icb_name           text not null,
  region             text,
  stage              text not null default 'prospecting'
                       check (stage in ('prospecting','engaged','proposal','pilot','contract','declined')),
  contact_name       text,
  contact_email      text,
  contact_role       text,
  last_contact_at    timestamptz,
  next_action        text,
  patient_population integer,
  notes              text,
  created_at         timestamptz not null default now()
);

alter table nhs_icb_contacts enable row level security;
create policy "service role full access" on nhs_icb_contacts using (true) with check (true);

-- ── NHS SLP Portal Signups ────────────────────────────────────────────────────

create table if not exists nhs_slp_signups (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text,
  organisation      text,
  role              text,
  region            text,
  signup_date       timestamptz not null default now(),
  activated         boolean not null default false,
  patient_referrals integer not null default 0,
  notes             text,
  created_at        timestamptz not null default now()
);

alter table nhs_slp_signups enable row level security;
create policy "service role full access" on nhs_slp_signups using (true) with check (true);

-- ── NHS Block Pledges ─────────────────────────────────────────────────────────

create table if not exists nhs_block_pledges (
  id                   uuid primary key default gen_random_uuid(),
  icb_name             text not null,
  contact_name         text,
  patients_covered     integer,
  contract_value_pence integer,
  status               text not null default 'verbal'
                         check (status in ('verbal','written','signed','live')),
  expected_start_date  date,
  actual_start_date    date,
  notes                text,
  created_at           timestamptz not null default now()
);

alter table nhs_block_pledges enable row level security;
create policy "service role full access" on nhs_block_pledges using (true) with check (true);
