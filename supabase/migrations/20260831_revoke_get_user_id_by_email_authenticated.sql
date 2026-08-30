-- ── Security: tighten get_user_id_by_email exposure ─────────────────────────
-- The only caller is the Stripe webhook route which already runs under the
-- service_role key (bypasses RLS / EXECUTE checks entirely).
-- Granting EXECUTE to `authenticated` lets any signed-in user enumerate any
-- other user's UUID by email — a real privacy leak.
-- Revoke it; service_role access is unaffected.

REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM authenticated;
