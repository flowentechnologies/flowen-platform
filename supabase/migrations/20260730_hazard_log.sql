-- ── DCB0129 Clinical Hazard Log ───────────────────────────────────────────────
-- NHS mandatory deliverable for clinical safety compliance.
-- Stores every potential clinical hazard with risk scoring and mitigation.

create table if not exists hazard_log (
  id                    uuid        primary key default gen_random_uuid(),
  hazard_ref            text        unique not null,          -- H001, H002, …
  hazard_description    text        not null,
  affected_pathway      text        not null,
  cause                 text        not null default '',
  effect                text        not null default '',
  severity              int         not null check (severity between 1 and 5),
  likelihood            int         not null check (likelihood between 1 and 5),
  risk_score            int         not null,                 -- severity × likelihood
  risk_level            text        not null                  -- low | medium | high | critical
                          check (risk_level in ('low', 'medium', 'high', 'critical')),
  mitigation            text        not null default '',
  residual_severity     int         not null check (residual_severity between 1 and 5),
  residual_likelihood   int         not null check (residual_likelihood between 1 and 5),
  residual_risk_score   int         not null,
  residual_risk_level   text        not null
                          check (residual_risk_level in ('low', 'medium', 'high', 'critical')),
  status                text        not null default 'open'
                          check (status in ('open', 'mitigated', 'accepted', 'closed')),
  reviewed_by           text,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now()
);

alter table hazard_log enable row level security;

-- Service role has full access (admin API uses service role key)
create policy "service role full access"
  on hazard_log
  using (true)
  with check (true);
