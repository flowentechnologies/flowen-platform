-- ============================================================================
-- FIX: app_brand ENUM causing auth 500s on POST /admin/users
--
-- Root cause (two issues):
--   1. handle_new_user trigger casts brand to ::app_brand without
--      SET search_path = public, so GoTrue's service role cannot resolve
--      the ENUM type — transaction aborts, user creation returns 500.
--   2. The onboarding page stores user roles ('pwds', 'clinician', etc.)
--      into the brand column — none are valid app_brand ENUM values
--      ('flowen', 'vocali'), so an ENUM constraint would also reject them.
--
-- Fix: convert brand columns to TEXT, rewrite trigger without ENUM cast.
-- ============================================================================

-- 1. Convert profiles.brand from app_brand ENUM to TEXT
ALTER TABLE public.profiles
    ALTER COLUMN brand TYPE TEXT USING brand::TEXT;

-- 2. Convert practice_sessions.brand from app_brand ENUM to TEXT
ALTER TABLE public.practice_sessions
    ALTER COLUMN brand TYPE TEXT USING brand::TEXT;

-- 3. Rewrite handle_new_user with:
--    • SET search_path = public (type resolution works for any calling role)
--    • No ::app_brand cast (brand is now TEXT, plain string extraction)
--    • ON CONFLICT DO NOTHING (safe if profile already exists)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, brand, tier)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'brand', 'flowen'),
        COALESCE(
            (NEW.raw_user_meta_data->>'tier')::subscription_tier,
            'standard'
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- 4. Drop the now-unused ENUM type (no columns reference it after steps 1–2)
--    Use CASCADE to handle any remaining dependent objects automatically.
DROP TYPE IF EXISTS app_brand CASCADE;
