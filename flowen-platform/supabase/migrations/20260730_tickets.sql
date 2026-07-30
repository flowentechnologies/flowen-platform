-- Support tickets + GDPR request queue

CREATE TYPE ticket_status   AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE ticket_category AS ENUM ('general', 'billing', 'technical', 'clinical', 'account', 'bug');

CREATE TABLE support_tickets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  status           ticket_status    NOT NULL DEFAULT 'open',
  priority         ticket_priority  NOT NULL DEFAULT 'normal',
  category         ticket_category  NOT NULL DEFAULT 'general',
  user_email       TEXT NOT NULL,
  user_name        TEXT,
  assigned_to      TEXT,
  internal_notes   TEXT,
  first_response_at TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  sla_due_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticket_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  from_admin  BOOLEAN NOT NULL DEFAULT false,
  author      TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE gdpr_request_type   AS ENUM ('access', 'erasure', 'portability', 'rectification', 'restriction');
CREATE TYPE gdpr_request_status AS ENUM ('pending', 'acknowledged', 'in_progress', 'completed', 'rejected');

CREATE TABLE gdpr_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,
  user_email      TEXT NOT NULL,
  user_name       TEXT,
  request_type    gdpr_request_type   NOT NULL,
  status          gdpr_request_status NOT NULL DEFAULT 'pending',
  details         TEXT,
  internal_notes  TEXT,
  sla_due_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  acknowledged_at TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_status   ON support_tickets(status);
CREATE INDEX idx_tickets_sla      ON support_tickets(sla_due_at) WHERE status NOT IN ('resolved','closed');
CREATE INDEX idx_gdpr_status      ON gdpr_requests(status);
CREATE INDEX idx_ticket_messages  ON ticket_messages(ticket_id, created_at);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_requests   ENABLE ROW LEVEL SECURITY;
