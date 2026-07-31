-- ── Runway: burn-rate and cash-in-bank config ────────────────────────────────

alter table venture_config
  add column if not exists monthly_burn_pence  integer,
  add column if not exists cash_in_bank_pence  integer,
  add column if not exists last_updated_at     timestamptz;
