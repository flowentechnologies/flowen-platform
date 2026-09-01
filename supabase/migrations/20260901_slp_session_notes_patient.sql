-- Fix slp_session_notes to support general (non-session) notes and per-patient filtering.
--
-- Problems with the original schema:
--   1. session_id NOT NULL → inserting a "general" note (no specific session) requires a
--      sentinel UUID that violates the FK constraint on practice_sessions.
--   2. No patient_user_id column → queries can't filter notes by patient, so every SLT
--      would see all their notes across all patients on every patient detail page.
--   3. UNIQUE(session_id, slp_user_id) → prevents multiple notes per session, which is
--      too restrictive; SLTs need to append notes over time.

-- 1. Allow general notes by making session_id nullable
ALTER TABLE slp_session_notes
  ALTER COLUMN session_id DROP NOT NULL;

-- 2. Add patient_user_id to scope notes to a specific patient
ALTER TABLE slp_session_notes
  ADD COLUMN IF NOT EXISTS patient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Drop the old unique constraint that prevents multiple notes per session
ALTER TABLE slp_session_notes
  DROP CONSTRAINT IF EXISTS slp_session_notes_session_id_slp_user_id_key;

-- 4. Index for efficient per-patient lookups
CREATE INDEX IF NOT EXISTS slp_session_notes_patient_slp_idx
  ON slp_session_notes(patient_user_id, slp_user_id, created_at DESC);

-- 5. Back-fill patient_user_id from practice_sessions for existing rows that have a session_id
UPDATE slp_session_notes sn
SET patient_user_id = ps.user_id
FROM practice_sessions ps
WHERE sn.session_id = ps.id
  AND sn.patient_user_id IS NULL;

-- 6. Null out the sentinel session_id rows (if any were created via the '00000...' hack)
UPDATE slp_session_notes
SET session_id = NULL
WHERE session_id = '00000000-0000-0000-0000-000000000000';
