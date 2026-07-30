-- Data Room: private document vault with investor invite system

-- Private storage bucket for data room files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'data-room',
  'data-room',
  false,
  52428800, -- 50 MB per file
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/msword',
    'image/png',
    'image/jpeg',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Document metadata catalogue
CREATE TABLE data_room_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL CHECK (category IN ('financial', 'legal', 'clinical', 'technical', 'corporate', 'regulatory')),
  filename     TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  file_size    BIGINT,
  mime_type    TEXT,
  version      TEXT NOT NULL DEFAULT 'v1',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Investor access invites
CREATE TABLE data_room_invites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_name    TEXT NOT NULL,
  investor_email   TEXT NOT NULL,
  token            TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  access_level     TEXT NOT NULL DEFAULT 'standard' CHECK (access_level IN ('standard', 'full')),
  expires_at       TIMESTAMPTZ NOT NULL,
  last_accessed_at TIMESTAMPTZ,
  access_count     INT NOT NULL DEFAULT 0,
  revoked          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Admin-only; service role bypasses RLS
ALTER TABLE data_room_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_room_invites   ENABLE ROW LEVEL SECURITY;

-- Storage RLS: no public access; service role handles all operations
CREATE POLICY "No public access to data-room"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'data-room' AND false);
