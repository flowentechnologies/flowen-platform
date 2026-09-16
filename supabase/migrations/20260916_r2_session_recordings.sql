-- Cloudflare R2 storage — first bucket migrated: practice session audio
-- recordings (session-recordings). This is the highest-volume, highest-egress
-- bucket, so it's the pilot; other buckets (training-data, assets, data-room,
-- backups) stay on Supabase Storage for now.
--
-- Existing rows already have a Supabase Storage path in audio_storage_path
-- and must keep working — we don't backfill/migrate historical files, we
-- just start writing new recordings to R2. audio_storage_provider tells the
-- read path (GET /api/practice/sessions/:id/recording) which storage backend
-- to generate a signed URL from.

alter table practice_sessions
  add column if not exists audio_storage_provider text not null default 'supabase';

alter table practice_sessions
  drop constraint if exists practice_sessions_audio_storage_provider_check;

alter table practice_sessions
  add constraint practice_sessions_audio_storage_provider_check
  check (audio_storage_provider in ('supabase', 'r2'));

comment on column practice_sessions.audio_storage_provider is
  'Which storage backend audio_storage_path lives in. Existing rows default to supabase (Supabase Storage session-recordings bucket); new uploads write r2 (Cloudflare R2) once STORAGE_R2_* env vars are configured. See src/lib/r2.ts.';
