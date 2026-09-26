-- Aligns data_retention_policies.session_retention_days' default with the
-- 90-day period the ROPA (src/app/admin/ropa/page.tsx) already documented
-- as the policy, now that src/app/api/cron/data-retention/route.ts actually
-- reads and enforces this column for the first time. The column existed
-- since 20260728 (auto-created per profile by on_profile_created_set_
-- retention) with a default of 365 days that nothing ever consumed — 90
-- matches what the ROPA and the public privacy policy (src/app/legal/
-- policies.ts) already stated was happening.
--
-- Only backfills rows still at the untouched 365-day default — never
-- overwrites a value anyone (a user or SLP) may already have customised.
alter table data_retention_policies alter column session_retention_days set default 90;

update data_retention_policies
set session_retention_days = 90, updated_at = now()
where session_retention_days = 365;
