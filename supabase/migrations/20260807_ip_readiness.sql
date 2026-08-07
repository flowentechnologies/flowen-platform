-- ── Tier 1: IP Audit Items ────────────────────────────────────────────────────

create table if not exists ip_audit_items (
  id           uuid primary key default gen_random_uuid(),
  category     text not null
                 check (category in ('patents','trademarks','ai_models','data_datasets','software','trade_secrets','contracts')),
  title        text not null,
  description  text,
  status       text not null default 'not_started'
                 check (status in ('not_started','in_progress','complete','blocked','waived')),
  risk_level   text not null default 'medium'
                 check (risk_level in ('critical','high','medium','low','none')),
  priority     integer not null default 3,   -- 1 = highest
  assignee     text,
  due_date     date,
  evidence_url text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table ip_audit_items enable row level security;
create policy "service role full access" on ip_audit_items using (true) with check (true);

-- ── Tier 2: IP Funding & Access Items ────────────────────────────────────────

create table if not exists ip_funding_items (
  id              uuid primary key default gen_random_uuid(),
  program_type    text not null
                    check (program_type in ('grant','loan','tax_relief','licensing','partnership','legal_aid','equity')),
  name            text not null,
  provider        text not null,
  description     text,
  status          text not null default 'researching'
                    check (status in ('researching','eligible','applied','in_progress','awarded','rejected','not_eligible','on_hold')),
  min_amount_pence integer,
  max_amount_pence integer,
  deadline        date,
  url             text,
  lead_contact    text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table ip_funding_items enable row level security;
create policy "service role full access" on ip_funding_items using (true) with check (true);
