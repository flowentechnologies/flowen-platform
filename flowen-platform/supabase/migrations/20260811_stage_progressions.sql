-- Stage progressions log
-- Records each time a user auto-advances to a new programme week.
-- Written by /api/practice/sessions when evaluateAutoAdvance returns advanced=true.

CREATE TABLE IF NOT EXISTS stage_progressions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_week      INTEGER     NOT NULL CHECK (from_week >= 1),
  to_week        INTEGER     NOT NULL CHECK (to_week > from_week),
  sessions_count INTEGER     NOT NULL DEFAULT 0,
  avg_bpm        NUMERIC(6,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stage_progressions_user_id_idx ON stage_progressions(user_id);
CREATE INDEX IF NOT EXISTS stage_progressions_created_at_idx ON stage_progressions(created_at DESC);

ALTER TABLE stage_progressions ENABLE ROW LEVEL SECURITY;

-- Users can view their own progression history; only service role can write.
CREATE POLICY "users_view_own_progressions"
  ON stage_progressions FOR SELECT
  USING (auth.uid() = user_id);
