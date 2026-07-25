CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.system_error_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    environment VARCHAR(50) DEFAULT 'production' NOT NULL,
    source VARCHAR(100) NOT NULL,
    error_code VARCHAR(100),
    message TEXT NOT NULL,
    stack_trace TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON public.system_error_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.system_error_logs (resolved);
