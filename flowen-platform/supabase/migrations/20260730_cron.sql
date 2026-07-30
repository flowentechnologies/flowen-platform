CREATE TYPE cron_run_status AS ENUM ('running', 'success', 'failed', 'skipped');
CREATE TABLE cron_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       TEXT NOT NULL,
  status       cron_run_status NOT NULL DEFAULT 'running',
  triggered_by TEXT NOT NULL DEFAULT 'schedule', -- 'schedule' | 'manual:admin@...'
  duration_ms  INT,
  result       JSONB,
  error        TEXT,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  finished_at  TIMESTAMPTZ
);
CREATE INDEX idx_cron_runs_job ON cron_runs(job_id, started_at DESC);
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
