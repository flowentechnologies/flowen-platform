-- ============================================================
-- Security & Performance fixes from Supabase advisor
-- 2026-08-21
-- ============================================================

-- ── 1. SECURITY: Revoke public EXECUTE on SECURITY DEFINER functions ────────
-- Trigger functions are not meant to be callable via /rest/v1/rpc.
-- Revoking EXECUTE prevents anonymous or authenticated users from calling them directly.

REVOKE EXECUTE ON FUNCTION public.set_updated_at()               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_marketing_attribution_meta_capi() FROM anon, authenticated;

-- get_user_id_by_email — highest risk: unauthenticated callers can enumerate
-- any user's internal UUID by supplying their email address.
-- Revoke from anon; keep for authenticated (SLP patient lookup uses it).
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM anon;

-- ── 2. SECURITY: Tighten "admin_full" policies that use USING (true) ────────
-- These tables have USING (true) WITH CHECK (true) which means ANY authenticated
-- user can read/write/delete sensitive admin data.  Service-role bypasses RLS
-- for all admin ops anyway, so these policies only need to allow is_admin users.

DROP POLICY IF EXISTS "admin_full" ON public.affiliate_clicks;
CREATE POLICY "admin_only" ON public.affiliate_clicks
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "admin_full" ON public.affiliate_commissions;
CREATE POLICY "admin_only" ON public.affiliate_commissions
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "admin_full" ON public.affiliate_conversions;
CREATE POLICY "admin_only" ON public.affiliate_conversions
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "admin_full" ON public.affiliate_payouts;
CREATE POLICY "admin_only" ON public.affiliate_payouts
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "admin_full" ON public.affiliates;
CREATE POLICY "admin_only" ON public.affiliates
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "service role full access" ON public.slp_beta_applications;
CREATE POLICY "admin_only" ON public.slp_beta_applications
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "service role full access" ON public.valuation_config;
CREATE POLICY "admin_only" ON public.valuation_config
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "service role full access" ON public.valuation_snapshots;
CREATE POLICY "admin_only" ON public.valuation_snapshots
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

-- ── 3. PERFORMANCE: Fix auth RLS init-plan — wrap auth.uid() in (SELECT …) ──
-- Each bare auth.uid() / auth.jwt() call inside a USING clause gets re-executed
-- once per row.  SELECT-wrapping memoises it across the scan.

-- deploy_log (created in 20260821_daily_backups.sql)
DROP POLICY IF EXISTS "admin_only" ON public.deploy_log;
CREATE POLICY "admin_only" ON public.deploy_log
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND is_admin = true
  ));

-- backup_log (created in 20260821_daily_backups.sql)
DROP POLICY IF EXISTS "admin_only" ON public.backup_log;
CREATE POLICY "admin_only" ON public.backup_log
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND is_admin = true
  ));

-- training_samples
DROP POLICY IF EXISTS "Users read own training samples" ON public.training_samples;
CREATE POLICY "Users read own training samples" ON public.training_samples
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- stage_progressions — drop duplicate SELECT policy, fix the surviving one
DROP POLICY IF EXISTS "users_view_own_progressions" ON public.stage_progressions;
DROP POLICY IF EXISTS "users_own_progressions"      ON public.stage_progressions;
CREATE POLICY "users_own_progressions" ON public.stage_progressions
  FOR ALL
  USING      ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- nps_responses — also drop the redundant "service role full access" policy
-- (service role bypasses RLS; the policy is pure noise and causes the
--  multiple_permissive_policies warning)
DROP POLICY IF EXISTS "Service role full access on nps_responses" ON public.nps_responses;
DROP POLICY IF EXISTS "Admins can read nps_responses"             ON public.nps_responses;
CREATE POLICY "Admins can read nps_responses" ON public.nps_responses
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND is_admin = true
  ));

-- feedback — drop redundant service-role policy; fix initplan on remaining two
DROP POLICY IF EXISTS "Service role full access on feedback"    ON public.feedback;
DROP POLICY IF EXISTS "Users can insert their own feedback"     ON public.feedback;
DROP POLICY IF EXISTS "Admins can read feedback"                ON public.feedback;
CREATE POLICY "Users can insert their own feedback" ON public.feedback
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Admins can read feedback" ON public.feedback
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND is_admin = true
  ));

-- marketing_attribution
DROP POLICY IF EXISTS "Admins can read attribution data" ON public.marketing_attribution;
CREATE POLICY "Admins can read attribution data" ON public.marketing_attribution
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND is_admin = true
  ));

-- ── 4. PERFORMANCE: Add missing FK indexes on high-traffic tables ────────────
-- Only the tables most likely to be JOIN-ed at scale.
-- Low-risk: CREATE INDEX is non-blocking with CONCURRENTLY on live tables,
-- but Supabase migrations run in a transaction so we use plain CREATE INDEX.

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id
  ON public.subscriptions (customer_id);

CREATE INDEX IF NOT EXISTS idx_training_samples_session_id
  ON public.training_samples (session_id);

CREATE INDEX IF NOT EXISTS idx_slp_messages_from_user_id
  ON public.slp_messages (from_user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id
  ON public.feedback (user_id);

CREATE INDEX IF NOT EXISTS idx_nps_responses_user_id
  ON public.nps_responses (user_id);

CREATE INDEX IF NOT EXISTS idx_consent_audit_log_user_id
  ON public.consent_audit_log (user_id);

CREATE INDEX IF NOT EXISTS idx_affiliates_user_id
  ON public.affiliates (user_id);
