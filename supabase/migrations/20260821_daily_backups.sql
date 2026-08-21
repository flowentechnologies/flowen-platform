-- Fix deploy_log RLS (was fully exposed to anon/authenticated roles)
ALTER TABLE public.deploy_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON public.deploy_log
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Backup run log — tracks every daily backup cron execution
CREATE TABLE IF NOT EXISTS public.backup_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT        NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  tables_backed TEXT[]      NOT NULL DEFAULT '{}',
  total_rows    BIGINT      NOT NULL DEFAULT 0,
  storage_bytes BIGINT      NOT NULL DEFAULT 0,
  duration_ms   INTEGER     NOT NULL DEFAULT 0,
  error         TEXT,
  storage_path  TEXT
);

ALTER TABLE public.backup_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON public.backup_log
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Private backups Storage bucket (created separately via SQL on storage schema)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backups',
  'backups',
  false,
  104857600,  -- 100 MB per file cap
  ARRAY['application/gzip', 'application/json', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;
