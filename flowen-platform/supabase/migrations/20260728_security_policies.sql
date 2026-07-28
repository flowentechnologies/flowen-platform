-- ============================================================================
-- FLOWEN PLATFORM — SECURITY POLICIES & GDPR COMPLIANCE LAYER
-- Migration: 20260728_security_policies.sql
--
-- Additive only. All DDL is guarded with IF NOT EXISTS or DO/EXCEPTION blocks
-- so this migration is safe to re-run on environments that applied earlier
-- migrations in a different order.
--
-- UK-GDPR basis: UK Data Protection Act 2018 + retained EU GDPR (Article 9
-- special-category data — biometric/health). Explicit consent required.
-- ============================================================================

-- ── Extensions (idempotent) ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- SECTION 1: PROFILE ENHANCEMENTS
-- Adds identity verification, UK-GDPR consent tracking, and data sovereignty
-- columns to the existing public.profiles table.
-- ============================================================================

-- Identity verification (Didit KYC protocol — Module 5)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS id_verified              BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS id_verified_at           TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS didit_session_id         TEXT        UNIQUE;

-- UK-GDPR Article 7/9 — explicit consent for special-category (biometric/health) data
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS gdpr_consent_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS gdpr_consent_version     TEXT,
    ADD COLUMN IF NOT EXISTS marketing_consent        BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS marketing_consent_at     TIMESTAMPTZ;

-- UK-GDPR Article 17 — right to erasure
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS data_erasure_requested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS data_erasure_completed_at TIMESTAMPTZ;

-- Data sovereignty — UK data residency declaration
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS data_residency_region    TEXT        NOT NULL DEFAULT 'UK-GBR',
    ADD COLUMN IF NOT EXISTS data_controller_entity   TEXT        NOT NULL DEFAULT 'Flowen Ltd';

-- Biofeedback personalisation
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS pacer_default_bpm        NUMERIC(5,2) DEFAULT 60.0,
    ADD COLUMN IF NOT EXISTS laryngeal_sensitivity    NUMERIC(3,2) DEFAULT 0.50
        CHECK (laryngeal_sensitivity BETWEEN 0.0 AND 1.0);

-- ============================================================================
-- SECTION 2: CONSENT AUDIT LOG
-- Immutable append-only ledger for GDPR accountability (Article 5(2)).
-- No UPDATE or DELETE policy is created for this table — inserts only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consent_audit_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type      TEXT        NOT NULL
                    CHECK (event_type IN (
                        'gdpr_consent_granted',
                        'gdpr_consent_withdrawn',
                        'marketing_consent_granted',
                        'marketing_consent_withdrawn',
                        'telemetry_opt_in',
                        'telemetry_opt_out',
                        'erasure_requested',
                        'erasure_completed',
                        'kyc_initiated',
                        'kyc_approved',
                        'kyc_declined'
                    )),
    consent_version TEXT,
    ip_address      INET,
    user_agent      TEXT,
    metadata        JSONB       DEFAULT '{}'::jsonb,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 3: SESSION SNAPSHOTS
-- Periodic persistence of ephemeral Redis biofeedback state.
-- Captures pacer rate, laryngeal tension index, and voice activity markers
-- at configurable intervals during a practice session.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.session_snapshots (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID        NOT NULL
                            REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    user_id                 UUID        NOT NULL
                            REFERENCES public.profiles(id) ON DELETE CASCADE,
    snapshot_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Pacer biofeedback state
    pacer_bpm               NUMERIC(5,2),
    target_bpm              NUMERIC(5,2),
    pacer_phase             TEXT        CHECK (pacer_phase IN ('inhale','hold','exhale','rest')),

    -- Acoustic biomarkers (non-identifying, aggregated)
    rms_level               NUMERIC(6,4),
    peak_rms                NUMERIC(6,4),
    fundamental_freq_hz     NUMERIC(7,2),
    laryngeal_tension_index NUMERIC(4,3)
                            CHECK (laryngeal_tension_index BETWEEN 0.0 AND 1.0),

    -- Voice activity
    is_voice_active         BOOLEAN     DEFAULT false,
    block_detected          BOOLEAN     DEFAULT false,
    block_duration_ms       INTEGER,

    -- Latency observability
    pipeline_latency_ms     NUMERIC(6,2)
);

-- ============================================================================
-- SECTION 4: DATA RETENTION POLICIES
-- Per-user retention preferences. When retention_days is reached, a scheduled
-- job (or Supabase pg_cron task) anonymises or deletes the rows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
    user_id                 UUID        PRIMARY KEY
                            REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_retention_days  INTEGER     NOT NULL DEFAULT 365,
    telemetry_retention_days INTEGER    NOT NULL DEFAULT 90,
    snapshot_retention_days  INTEGER   NOT NULL DEFAULT 30,
    auto_anonymise          BOOLEAN     NOT NULL DEFAULT true,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 5: PERFORMANCE INDEXES
-- All indexes target the sub-5ms lookup requirement for the primary
-- application access patterns. Composite indexes cover multi-column WHERE
-- clauses; expression indexes serve aggregation and time-bucket queries.
-- ============================================================================

-- profiles — KYC queue scan (ops dashboard)
CREATE INDEX IF NOT EXISTS idx_profiles_unverified
    ON public.profiles (id)
    WHERE id_verified = false;

-- profiles — erasure queue (GDPR Article 17 compliance batch)
CREATE INDEX IF NOT EXISTS idx_profiles_erasure_queue
    ON public.profiles (data_erasure_requested_at)
    WHERE data_erasure_requested_at IS NOT NULL
      AND data_erasure_completed_at IS NULL;

-- profiles — tier + brand composite (entitlement lookups)
CREATE INDEX IF NOT EXISTS idx_profiles_tier_brand
    ON public.profiles (tier, brand);

-- practice_sessions — user timeline (most common query: "list user's sessions")
CREATE INDEX IF NOT EXISTS idx_sessions_user_created
    ON public.practice_sessions (user_id, created_at DESC);

-- practice_sessions — daily aggregation bucketed to UTC day.
-- AT TIME ZONE 'UTC' returns timestamp (not timestamptz) which is IMMUTABLE.
CREATE INDEX IF NOT EXISTS idx_sessions_day_bucket
    ON public.practice_sessions (date_trunc('day', created_at AT TIME ZONE 'UTC'));

-- telemetry_logs — session-scoped lookup with time ordering
CREATE INDEX IF NOT EXISTS idx_telemetry_session_time
    ON public.telemetry_logs (session_id, created_at DESC);

-- telemetry_logs — user + type composite (disfluency trend queries)
CREATE INDEX IF NOT EXISTS idx_telemetry_user_type
    ON public.telemetry_logs (user_id, disfluency_type, created_at DESC);

-- telemetry_logs — BRIN for time-range scans on large sequential inserts
-- BRIN is far cheaper to maintain than B-tree for append-only telemetry tables.
CREATE INDEX IF NOT EXISTS idx_telemetry_brin_created
    ON public.telemetry_logs USING brin (created_at)
    WITH (pages_per_range = 32);

-- telemetry_logs — high-confidence disfluency events only (partial index)
CREATE INDEX IF NOT EXISTS idx_telemetry_high_confidence
    ON public.telemetry_logs (session_id, confidence_score DESC)
    WHERE confidence_score >= 0.85;

-- session_snapshots — session timeline
CREATE INDEX IF NOT EXISTS idx_snapshots_session_time
    ON public.session_snapshots (session_id, snapshot_at DESC);

-- session_snapshots — user + time for cross-session trend analysis
CREATE INDEX IF NOT EXISTS idx_snapshots_user_time
    ON public.session_snapshots (user_id, snapshot_at DESC);

-- session_snapshots — voice activity periods (partial index for event queries)
CREATE INDEX IF NOT EXISTS idx_snapshots_voice_active
    ON public.session_snapshots (session_id, snapshot_at)
    WHERE is_voice_active = true;

-- consent_audit_log — user history
CREATE INDEX IF NOT EXISTS idx_consent_audit_user_time
    ON public.consent_audit_log (user_id, recorded_at DESC);

-- consent_audit_log — event type scan for compliance reporting
CREATE INDEX IF NOT EXISTS idx_consent_audit_event
    ON public.consent_audit_log (event_type, recorded_at DESC);

-- system_error_logs — ops unresolved queue
CREATE INDEX IF NOT EXISTS idx_errors_unresolved
    ON public.system_error_logs (timestamp DESC)
    WHERE resolved = false;

-- ============================================================================
-- SECTION 6: ROW-LEVEL SECURITY POLICIES
-- Strict per-user isolation. Service-role (webhook handlers, admin jobs) is
-- exempt from RLS by virtue of the BYPASSRLS privilege on the service role.
-- ============================================================================

-- consent_audit_log: users can insert their own events; read their own history.
ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own consent events" ON public.consent_audit_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own consent history" ON public.consent_audit_log
    FOR SELECT USING (auth.uid() = user_id);

-- session_snapshots: users own their snapshots.
ALTER TABLE public.session_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own snapshots" ON public.session_snapshots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own snapshots" ON public.session_snapshots
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- data_retention_policies: users manage their own retention settings.
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own retention policy" ON public.data_retention_policies
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users upsert own retention policy" ON public.data_retention_policies
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own retention policy" ON public.data_retention_policies
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 7: HELPER FUNCTIONS
-- ============================================================================

-- Soft GDPR erasure: anonymise PII columns while preserving aggregate telemetry.
-- Called by the erasure batch job; not exposed to end-users directly.
CREATE OR REPLACE FUNCTION public.apply_gdpr_erasure(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Anonymise profile PII
    UPDATE public.profiles SET
        id_verified              = false,
        id_verified_at           = NULL,
        didit_session_id         = NULL,
        gdpr_consent_at          = NULL,
        gdpr_consent_version     = NULL,
        marketing_consent        = false,
        marketing_consent_at     = NULL,
        data_erasure_completed_at = NOW(),
        pacer_default_bpm        = 60.0,
        laryngeal_sensitivity    = 0.50,
        updated_at               = NOW()
    WHERE id = target_user_id;

    -- Remove personally-linked telemetry logs
    DELETE FROM public.telemetry_logs WHERE user_id = target_user_id;

    -- Remove session snapshots (contain real-time voice biomarkers)
    DELETE FROM public.session_snapshots WHERE user_id = target_user_id;

    -- Retain practice_sessions aggregate counts for model integrity but
    -- null out any direct identifiers if they exist.
    UPDATE public.practice_sessions SET
        average_latency_ms = NULL
    WHERE user_id = target_user_id;
END;
$$;

-- Trigger: auto-create a default data retention policy on new profile creation.
CREATE OR REPLACE FUNCTION public.create_default_retention_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.data_retention_policies (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'on_profile_created_set_retention'
    ) THEN
        CREATE TRIGGER on_profile_created_set_retention
            AFTER INSERT ON public.profiles
            FOR EACH ROW EXECUTE FUNCTION public.create_default_retention_policy();
    END IF;
END $$;
