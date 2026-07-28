-- ── Migration: RLS fixes, admin gate, onboarding, waitlist ────────────────────
-- Addresses:
--   CRITICAL: system_error_logs missing RLS
--   CRITICAL: organizations table has RLS but no policies
--   HIGH:     telemetry_logs missing SELECT policy
--   MEDIUM:   anonymous telemetry INSERT too permissive
--   NEW:      is_admin, display_name, onboarding_complete on profiles
--   NEW:      waitlist_signups table

-- ── 1. New profile columns ─────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin          BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name      TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN    NOT NULL DEFAULT false;

-- Only super-admins should be able to set is_admin directly; all other updates
-- go through the existing UPDATE policy (users update their own row).
-- Admins are set manually via the Supabase dashboard or a privileged migration.

-- ── 2. system_error_logs — enable RLS and restrict to admins ──────────────────

ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;

-- Service role (webhook handlers) bypasses RLS — no policy needed for INSERT.
-- Authenticated admins can read logs; no one else can.
CREATE POLICY "sel_system_error_logs_admins"
  ON public.system_error_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── 3. organizations — add member policies ────────────────────────────────────

-- Members can see their own organisation.
CREATE POLICY "sel_organizations_member"
  ON public.organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND organization_id = organizations.id
    )
  );

-- Admins can see all organisations.
CREATE POLICY "sel_organizations_admin"
  ON public.organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Only admins can insert or update organisations.
CREATE POLICY "ins_organizations_admin"
  ON public.organizations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "upd_organizations_admin"
  ON public.organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── 4. telemetry_logs — add SELECT policy ────────────────────────────────────

-- Users can read their own telemetry (needed by the analytics page).
CREATE POLICY "sel_telemetry_logs_own"
  ON public.telemetry_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all telemetry.
CREATE POLICY "sel_telemetry_logs_admin"
  ON public.telemetry_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── 5. anonymized_telemetry_features — require auth for INSERT ────────────────

-- Drop the overly permissive anonymous insert policy.
DROP POLICY IF EXISTS "Anon upload to anonymized feature store"
  ON public.anonymized_telemetry_features;

-- Replace with authenticated-only policy.
CREATE POLICY "ins_anonymized_telemetry_auth"
  ON public.anonymized_telemetry_features
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── 6. waitlist_signups — new table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  source      TEXT        NOT NULL DEFAULT 'waitlist_page',
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can add their email.
CREATE POLICY "ins_waitlist_public"
  ON public.waitlist_signups
  FOR INSERT
  WITH CHECK (true);

-- Only admins can read the list.
CREATE POLICY "sel_waitlist_admins"
  ON public.waitlist_signups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── 7. Update handle_new_user trigger to set onboarding_complete ──────────────
--     New users start with onboarding_complete = false (column default).
--     No trigger change needed — the DEFAULT covers this automatically.

-- ── 8. Performance indexes ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
  ON public.profiles (is_admin)
  WHERE is_admin = true;

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_email
  ON public.waitlist_signups (email);

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at
  ON public.waitlist_signups USING BRIN (created_at);
