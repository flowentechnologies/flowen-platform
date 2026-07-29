-- ============================================================================
-- Persistent audit log table + webhook idempotency
-- ============================================================================

-- 1. Durable audit log (replaces the in-memory buffer)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id            TEXT        PRIMARY KEY,
    timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
    severity      TEXT        NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL','SECURITY_ALERT')),
    category      TEXT        NOT NULL,
    actor_id      TEXT        NOT NULL,
    actor_role    TEXT        NOT NULL,
    action        TEXT        NOT NULL,
    resource_id   TEXT,
    ip_address    TEXT,
    user_agent    TEXT,
    metadata      JSONB,
    hash          TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor     ON public.audit_logs (actor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category  ON public.audit_logs (category, timestamp DESC);

-- Admins can read all; users cannot read audit_logs directly.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );
-- Audit writes come from the service role (server-side) only.

-- 2. Webhook idempotency — prevents double-processing on Stripe retries
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
    event_id    TEXT        PRIMARY KEY,
    event_type  TEXT        NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
