-- Public bucket for CDN assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets', 'assets', true, 52428800,
  ARRAY['image/png','image/jpeg','image/gif','image/webp','image/svg+xml',
        'audio/mpeg','audio/wav','audio/ogg',
        'video/mp4','video/webm',
        'application/pdf','text/plain','text/csv',
        'application/zip']
) ON CONFLICT (id) DO NOTHING;

CREATE TABLE asset_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  folder       TEXT NOT NULL DEFAULT 'general',
  filename     TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  public_url   TEXT NOT NULL,
  file_size    BIGINT,
  mime_type    TEXT,
  tags         TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE asset_files ENABLE ROW LEVEL SECURITY;

-- Public read for CDN assets
CREATE POLICY "Public read asset_files" ON asset_files FOR SELECT USING (true);
