create table if not exists alert_rules (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  rule_type       text not null
                    check (rule_type in (
                      'grant_deadline',
                      'gdpr_overdue',
                      'hazard_open_critical',
                      'user_retention_drop',
                      'at_risk_users',
                      'mrr_drop',
                      'no_new_signups'
                    )),
  enabled         boolean not null default true,
  threshold_days  integer,          -- for deadline/overdue rules: days before to alert
  threshold_count integer,          -- for count-based rules: trigger if count exceeds this
  threshold_pct   numeric(5,2),     -- for % drop rules
  recipient_email text not null,
  last_triggered_at timestamptz,
  last_checked_at   timestamptz,
  created_at      timestamptz not null default now()
);

alter table alert_rules enable row level security;
create policy "service role full access" on alert_rules using (true) with check (true);

create table if not exists alert_history (
  id          uuid primary key default gen_random_uuid(),
  rule_id     uuid not null references alert_rules(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  message     text not null,
  sent        boolean not null default false,
  error       text
);

create index if not exists alert_history_rule_idx on alert_history(rule_id);
alter table alert_history enable row level security;
create policy "service role full access" on alert_history using (true) with check (true);
