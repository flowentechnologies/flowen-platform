-- ============================================================================
-- GDPR FIX: Change opt_in_telemetry default from TRUE to FALSE
--
-- UK GDPR Article 9(2)(a) requires explicit consent before processing
-- special-category (biometric/health) data. The previous DEFAULT TRUE
-- violated this by processing voice telemetry for all new users without
-- prior consent capture. New users must now explicitly opt in during
-- onboarding before any telemetry is stored.
-- ============================================================================

ALTER TABLE public.profiles
    ALTER COLUMN opt_in_telemetry SET DEFAULT false;

-- Existing users who were auto-opted-in are grandfathered — do not
-- retroactively set them to false as they may have consented via
-- in-app flows. A future explicit consent capture migration will
-- backfill gdpr_consent_at for those who have genuinely consented.
