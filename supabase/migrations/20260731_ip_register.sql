-- ── IP Register ───────────────────────────────────────────────────────────────

create table if not exists ip_assets (
  id                     uuid primary key default gen_random_uuid(),
  asset_type             text not null
                           check (asset_type in ('ai_model','trademark','patent','trade_secret','copyright','domain','dataset')),
  name                   text not null,
  description            text,
  jurisdiction           text,
  status                 text not null default 'unregistered'
                           check (status in ('registered','pending','unregistered','licensed','expired')),
  filing_date            date,
  registration_number    text,
  renewal_date           date,
  estimated_value_pence  integer,
  owner                  text not null default 'Flowen Technologies Ltd',
  notes                  text,
  created_at             timestamptz not null default now()
);

alter table ip_assets enable row level security;
create policy "service role full access" on ip_assets using (true) with check (true);

-- ── Model Version Registry ────────────────────────────────────────────────────

create table if not exists ip_model_versions (
  id              uuid primary key default gen_random_uuid(),
  model_name      text not null default 'Disfluent ASR Engine',
  version         text not null,
  description     text,
  training_clips  integer,
  accuracy_pct    numeric(5,2),
  latency_ms      integer,
  deployed        boolean not null default false,
  deployed_at     timestamptz,
  deprecated      boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table ip_model_versions enable row level security;
create policy "service role full access" on ip_model_versions using (true) with check (true);
