-- notify_slp_new_message() / notify_slp_session_completed() are trigger-only
-- functions (see 20260907_slp_notifications.sql) — they reference NEW.* and
-- only make sense fired by their triggers on slp_messages/practice_sessions
-- inserts. Supabase auto-exposes every SECURITY DEFINER function in the
-- public schema as a PostgREST RPC endpoint unless EXECUTE is explicitly
-- revoked, which nothing did here. Found via a routine security-advisor
-- pass (anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable): any signed-in user,
-- or an anonymous caller, could hit
-- /rest/v1/rpc/notify_slp_new_message directly. Calling it outside a real
-- trigger context would error immediately (NEW is undefined), so this was
-- not independently exploitable — but it's not something that should be
-- reachable at all. Applied directly via apply_migration already; this
-- file is for repo history, matching this project's existing pattern.
revoke execute on function notify_slp_new_message() from anon, authenticated;
revoke execute on function notify_slp_session_completed() from anon, authenticated;
