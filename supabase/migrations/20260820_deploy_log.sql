-- Deploy log: tracks every production deployment for idempotency and history.
-- Used by POST /api/webhooks/vercel-deploy (not notification_log, which requires user_id).

CREATE TABLE IF NOT EXISTS deploy_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id text        NOT NULL UNIQUE,
  commit_sha    text,
  branch        text,
  build_secs    int,
  feat_items    int         NOT NULL DEFAULT 0,
  users_emailed int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Admins can read; no public/anon access
ALTER TABLE deploy_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_deploy_log"
  ON deploy_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );
