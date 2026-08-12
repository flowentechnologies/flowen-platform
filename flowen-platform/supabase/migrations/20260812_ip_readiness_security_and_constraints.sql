-- ── IP Readiness: Security hardening + unique constraints ────────────────────
-- Applied 2026-08-12
--
-- 1. Drop the overly-permissive RLS policy from 20260807_ip_readiness.sql
--    that allowed any authenticated user to read IP audit data directly.
--    Service role (used by all admin API routes) bypasses RLS entirely.
--    With RLS enabled and no permissive policy, regular users are denied.
--
-- 2. Add unique constraints to prevent duplicate seeds.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "service role full access" on ip_audit_items;
drop policy if exists "service role full access" on ip_funding_items;

alter table ip_audit_items  enable row level security;
alter table ip_funding_items enable row level security;

-- Unique constraints (title / name are natural dedup keys for seed idempotency)
alter table ip_audit_items
  add constraint if not exists ip_audit_items_title_unique unique (title);

alter table ip_funding_items
  add constraint if not exists ip_funding_items_name_unique unique (name);

-- Indexes for common admin query patterns
create index if not exists ip_audit_items_priority_idx  on ip_audit_items (priority, created_at);
create index if not exists ip_audit_items_category_idx  on ip_audit_items (category);
create index if not exists ip_audit_items_status_idx    on ip_audit_items (status);
create index if not exists ip_funding_items_type_idx    on ip_funding_items (program_type);
create index if not exists ip_funding_items_status_idx  on ip_funding_items (status);
