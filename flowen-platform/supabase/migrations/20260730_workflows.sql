CREATE TYPE workflow_status AS ENUM ('active', 'paused', 'draft');
CREATE TYPE workflow_run_status AS ENUM ('success', 'failed', 'skipped');

CREATE TABLE workflow_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  trigger_type  TEXT NOT NULL, -- 'user_event' | 'schedule' | 'manual' | 'webhook'
  trigger_config JSONB,
  steps         JSONB NOT NULL DEFAULT '[]',
  status        workflow_status NOT NULL DEFAULT 'draft',
  last_run_at   TIMESTAMPTZ,
  run_count     INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id    UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  status         workflow_run_status NOT NULL,
  triggered_by   TEXT NOT NULL DEFAULT 'manual',
  context        JSONB,
  result         JSONB,
  error          TEXT,
  duration_ms    INT,
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  finished_at    TIMESTAMPTZ
);

CREATE INDEX idx_workflow_runs ON workflow_runs(workflow_id, started_at DESC);
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

-- Seed predefined workflows
INSERT INTO workflow_definitions (name, description, trigger_type, trigger_config, steps, status) VALUES
('Onboarding Sequence', 'Welcome email + 3-day check-in + 7-day milestone nudge after signup', 'user_event',
  '{"event": "onboarding_complete"}',
  '[{"step": 1, "action": "send_email", "template": "sendWelcomeEmail", "delay_hours": 0},
    {"step": 2, "action": "send_email", "template": "check_in_3d", "delay_hours": 72},
    {"step": 3, "action": "send_email", "template": "milestone_7d", "delay_hours": 168}]',
  'active'),
('Churn Prevention', 'Re-engagement email when user has not practised in 7 days', 'schedule',
  '{"cron": "0 9 * * *", "condition": "inactive_7d"}',
  '[{"step": 1, "action": "identify_inactive_users", "threshold_days": 7},
    {"step": 2, "action": "send_email", "template": "re_engagement"}]',
  'paused'),
('Founding Conversion', 'Notify waitlist when founding seat becomes available', 'manual',
  '{}',
  '[{"step": 1, "action": "query_waitlist", "limit": 10},
    {"step": 2, "action": "send_email", "template": "founding_offer"}]',
  'draft'),
('NHS Escalation Alert', 'Alert admin when clinical metric exceeds threshold', 'user_event',
  '{"event": "session_complete", "condition": "severity_score > 0.8"}',
  '[{"step": 1, "action": "send_admin_alert", "channel": "email"},
    {"step": 2, "action": "create_ticket", "priority": "high", "category": "clinical"}]',
  'paused'),
('Subscription Dunning', 'Re-attempt failed payment + notify user', 'webhook',
  '{"event": "invoice.payment_failed"}',
  '[{"step": 1, "action": "wait", "delay_hours": 24},
    {"step": 2, "action": "send_email", "template": "sendPaymentFailedUser"},
    {"step": 3, "action": "wait", "delay_hours": 72},
    {"step": 4, "action": "retry_payment"}]',
  'active'),
('Trial Expiry Nudge', 'Upgrade prompt 3 days before founding pre-order window closes', 'schedule',
  '{"cron": "0 10 * * *", "condition": "trial_ending_3d"}',
  '[{"step": 1, "action": "identify_trial_ending"},
    {"step": 2, "action": "send_email", "template": "upgrade_nudge"}]',
  'draft');
