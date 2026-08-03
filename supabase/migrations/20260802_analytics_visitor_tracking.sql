-- Visitor sessions (one row per browser session / anonymous visitor)
create table visitor_sessions (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  user_id        uuid references auth.users(id) on delete set null,
  converted      boolean not null default false,
  country        text,
  city           text,
  region         text,
  landing_page   text,
  referrer       text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_term       text,
  utm_content    text,
  page_view_count integer not null default 0
);

-- Per-page event log
create table page_views (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  session_id   uuid not null references visitor_sessions(id) on delete cascade,
  path         text not null,
  referrer     text,
  country      text,
  city         text
);

-- Indexes for common query patterns
create index idx_visitor_sessions_created_at  on visitor_sessions (created_at desc);
create index idx_visitor_sessions_last_seen   on visitor_sessions (last_seen_at desc);
create index idx_visitor_sessions_converted   on visitor_sessions (converted) where converted = true;
create index idx_visitor_sessions_country     on visitor_sessions (country);
create index idx_visitor_sessions_utm_source  on visitor_sessions (utm_source);
create index idx_page_views_session_id        on page_views (session_id);
create index idx_page_views_created_at        on page_views (created_at desc);
create index idx_page_views_path              on page_views (path);

-- RLS: no direct user access — only service role reads/writes
alter table visitor_sessions enable row level security;
alter table page_views        enable row level security;

create policy "no_direct_access_visitor_sessions"
  on visitor_sessions for all using (false);

create policy "no_direct_access_page_views"
  on page_views for all using (false);
