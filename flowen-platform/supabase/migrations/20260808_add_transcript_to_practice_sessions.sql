-- Add transcript column to practice_sessions
-- Stores the Web Speech API final transcript from each practice session.
-- Applied to production via Supabase MCP on 2026-08-08; this file captures
-- it in version control so fresh deployments replicate the schema correctly.

ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS transcript TEXT;

COMMENT ON COLUMN practice_sessions.transcript IS
  'Full text transcript of the session produced by the Web Speech API (finalTranscript). '
  'NULL when captions were not active or not supported by the browser. '
  'Capped at 20,000 characters server-side.';
