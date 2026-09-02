-- Cross-platform social publishing queue (distinct from social_posts, which
-- is post-performance analytics for the marketing dashboard). Instagram and
-- Facebook rows are auto-published by /api/cron/social-publish via the Meta
-- Graph API. LinkedIn rows are semi-automated: they sit at
-- status='manual_pending' and surface in /admin/social for the admin to
-- copy-paste and mark manual_done — LinkedIn Company Page auto-posting
-- requires Marketing Developer Platform approval, which is enterprise-gated
-- and was not pursued.

create table if not exists social_publish_queue (
  id uuid primary key default gen_random_uuid(),
  series text not null,
  day_num integer,
  platform text not null,
  caption text not null,
  hashtags text not null default '',
  asset_path text not null,
  asset_public_url text,
  scheduled_at timestamptz not null,
  status text not null default 'pending',
  published_at timestamptz,
  external_post_id text,
  error_message text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_publish_queue_platform_check check (platform in ('instagram', 'facebook', 'linkedin')),
  constraint social_publish_queue_status_check check (status in ('pending', 'published', 'failed', 'manual_pending', 'manual_done', 'skipped'))
);

create index if not exists idx_social_publish_queue_due
  on social_publish_queue (platform, status, scheduled_at);

alter table social_publish_queue enable row level security;
-- No policies added: table is only ever accessed via the service-role client
-- (adminDb) from the cron route and the admin dashboard, never from the
-- browser/anon key. Deny-by-default is intentional.
