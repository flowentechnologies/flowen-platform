create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  sent_at timestamptz not null default now(),
  metadata jsonb
);
create index if not exists notification_log_user_type_sent
  on notification_log(user_id, type, sent_at desc);
