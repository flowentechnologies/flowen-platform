create table if not exists investor_updates (
  id               uuid primary key default gen_random_uuid(),
  subject          text not null,
  body             text not null,
  sent_at          timestamptz not null default now(),
  recipient_count  integer not null default 0,
  kpis_snapshot    jsonb
);

alter table investor_updates enable row level security;
create policy "service role full access" on investor_updates using (true) with check (true);
