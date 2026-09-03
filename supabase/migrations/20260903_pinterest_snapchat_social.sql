-- Extend social_publish_queue to support Pinterest (full auto-publish) and
-- Snapchat (manual, like LinkedIn — Snap's organic Public Profile API is
-- allowlist-only and requires Snap to manually approve an app's client ID
-- via a business contact; no self-serve path exists).
alter table social_publish_queue drop constraint social_publish_queue_platform_check;
alter table social_publish_queue add constraint social_publish_queue_platform_check
  check (platform in ('instagram', 'facebook', 'linkedin', 'pinterest', 'snapchat'));

-- Pinterest OAuth tokens require periodic rotation (access token expires
-- every 30 days; refresh token is a rolling 60-day window, refreshed daily
-- by a dedicated cron well within margin) — unlike Meta's non-expiring Page
-- token, these can't live as static Vercel env vars and need a place a
-- server-side cron can update in place.
create table if not exists social_platform_tokens (
  platform text primary key,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  board_id text,
  updated_at timestamptz not null default now()
);
alter table social_platform_tokens enable row level security;
-- No policies added: service-role client only (adminDb), same as social_publish_queue.
