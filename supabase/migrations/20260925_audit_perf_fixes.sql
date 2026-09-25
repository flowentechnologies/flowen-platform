-- Full product/infra audit (25 Sep 2026) — two concrete, safe performance
-- fixes flagged by the Supabase advisor.

-- 1. ad_platform_stats had two byte-for-byte identical unique indexes on
--    (platform, stat_date, campaign_id, adset_id, ad_id): the bare index
--    'ad_platform_stats_unique_row' (20260905) and the named constraint
--    'ad_platform_stats_unique_key' (20260907, which superseded it but never
--    removed it). Every insert/upsert has been maintaining both ever since.
--    Keeping the constraint (more semantically meaningful, referenceable by
--    name) and dropping the redundant bare index.
drop index if exists public.ad_platform_stats_unique_row;

-- 2. Three RLS policies called auth.uid() directly in their USING clause,
--    which Postgres re-evaluates per row rather than once per query.
--    Wrapping in (select ...) lets the planner treat it as a stable
--    sub-select evaluated once — same access rules, no behaviour change,
--    just avoids the per-row re-evaluation at scale.
drop policy if exists "admins can read notifications" on public.admin_notifications;
create policy "admins can read notifications" on public.admin_notifications
  for select using (
    exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.is_admin = true)
  );

drop policy if exists "clinicians read their own notifications" on public.slp_notifications;
create policy "clinicians read their own notifications" on public.slp_notifications
  for select using ((select auth.uid()) = slp_user_id);

drop policy if exists "clinicians update their own notifications" on public.slp_notifications;
create policy "clinicians update their own notifications" on public.slp_notifications
  for update using ((select auth.uid()) = slp_user_id);

drop policy if exists "admin_all_google_analytics_stats" on public.google_analytics_stats;
create policy "admin_all_google_analytics_stats" on public.google_analytics_stats
  for all using (
    exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin')
  );
