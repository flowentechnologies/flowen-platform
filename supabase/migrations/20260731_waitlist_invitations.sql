alter table waitlist_signups
  add column if not exists invited_at        timestamptz,
  add column if not exists invite_token      text unique,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists converted_at      timestamptz;

create index if not exists idx_waitlist_invite_token on waitlist_signups(invite_token)
  where invite_token is not null;
