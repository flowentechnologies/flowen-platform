-- Staff management: member metadata, invites, shift handoff log

CREATE TYPE staff_role AS ENUM ('owner', 'admin', 'developer', 'support', 'analyst', 'clinical', 'marketing');
CREATE TYPE staff_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE shift_period AS ENUM ('morning', 'afternoon', 'evening', 'night');

-- Extended metadata for staff/admin users (keyed to auth.users id)
CREATE TABLE staff_members (
  id          UUID PRIMARY KEY, -- matches auth.users id
  role        staff_role   NOT NULL DEFAULT 'admin',
  department  TEXT,
  title       TEXT,
  bio         TEXT,
  status      staff_status NOT NULL DEFAULT 'active',
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Pending staff invitations
CREATE TABLE staff_invites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  role             staff_role NOT NULL DEFAULT 'admin',
  department       TEXT,
  token            TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by_email TEXT NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at      TIMESTAMPTZ,
  revoked          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- On-call / shift handoff notes
CREATE TABLE handoff_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_email TEXT NOT NULL,
  author_name  TEXT,
  shift        shift_period NOT NULL DEFAULT 'morning',
  summary      TEXT NOT NULL,
  action_items TEXT,
  flags        TEXT[], -- ['urgent', 'billing', 'technical', etc.]
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staff_invites_email  ON staff_invites(email);
CREATE INDEX idx_handoff_created      ON handoff_notes(created_at DESC);

ALTER TABLE staff_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_invites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff_notes   ENABLE ROW LEVEL SECURITY;
