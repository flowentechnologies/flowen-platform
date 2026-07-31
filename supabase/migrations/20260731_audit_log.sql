create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_email   text,
  actor_id      uuid,
  action        text not null,          -- e.g. 'user.delete', 'investor.update', 'gdpr.export'
  resource_type text,                   -- e.g. 'user', 'investor', 'compliance_item'
  resource_id   text,
  metadata      jsonb,                  -- arbitrary extra context (old value, new value, etc.)
  ip_address    text,
  severity      text not null default 'info'
                  check (severity in ('info','warning','critical')),
  created_at    timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on audit_log (created_at desc);
create index if not exists audit_log_actor_idx on audit_log (actor_email);
create index if not exists audit_log_action_idx on audit_log (action);

alter table audit_log enable row level security;
create policy "service role full access" on audit_log using (true) with check (true);
