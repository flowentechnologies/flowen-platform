CREATE TABLE IF NOT EXISTS slp_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_slp_messages_pair ON slp_messages(from_user_id, to_user_id, created_at DESC);
CREATE INDEX idx_slp_messages_to ON slp_messages(to_user_id, read_at) WHERE read_at IS NULL;

ALTER TABLE slp_messages ENABLE ROW LEVEL SECURITY;

-- Users can see messages they sent or received
CREATE POLICY "users_own_messages" ON slp_messages
  FOR ALL USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
