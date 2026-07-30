CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  key_prefix   TEXT NOT NULL, -- first 8 chars for display
  key_hash     TEXT NOT NULL UNIQUE, -- sha256 of full key
  scopes       TEXT[] NOT NULL DEFAULT '{}',
  expires_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
