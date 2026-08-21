-- ── Fix SECURITY DEFINER function exposure ───────────────────────────────────
-- REVOKE from anon/authenticated alone has no effect when EXECUTE is granted to
-- PUBLIC (the PostgreSQL default for new functions).  Must revoke from PUBLIC.

-- Trigger-only functions — nothing outside the trigger system needs to call these.
-- Revoking from PUBLIC removes all external access; triggers run as the table owner.
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_marketing_attribution_meta_capi()     FROM PUBLIC;

-- get_user_id_by_email — revoke from PUBLIC (closes anon access).
-- Re-grant to authenticated so SLP patient-lookup flows still work.
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;

-- increment_deck_view_count — intentionally callable by anon (investor deck tracking).
-- Leave it alone; accept the advisor warning as expected.
