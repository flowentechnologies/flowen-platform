create table if not exists grants (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  funder           text not null,
  grant_type       text not null default 'innovate_uk'
                     check (grant_type in ('innovate_uk','sbri','nihr','wellcome','horizon','seis_eis','private','other')),
  amount_pence     integer,                  -- max award value
  awarded_pence    integer,                  -- actual if awarded
  status           text not null default 'researching'
                     check (status in ('researching','drafting','submitted','under_review','awarded','rejected','withdrawn')),
  deadline         date,
  submitted_at     date,
  decision_date    date,
  lead_contact     text,
  reference_number text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table grants enable row level security;
create policy "service role full access" on grants using (true) with check (true);
