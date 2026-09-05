-- CRM: deal value + activity timeline (calls/notes/stage changes, not just
-- a bare last_contact_at timestamp).
alter table crm_contacts
  add column if not exists deal_value_pence bigint,
  add column if not exists deal_currency text default 'gbp';

create table if not exists crm_activities (
  id             uuid primary key default gen_random_uuid(),
  crm_contact_id uuid not null references crm_contacts(id) on delete cascade,
  type           text not null check (type in ('email_inbound','email_outbound','call','meeting','note','stage_change')),
  body           text,
  occurred_at    timestamptz not null default now(),
  created_by     uuid references profiles(id), -- null for auto-logged (email sync, stage change)
  created_at     timestamptz not null default now()
);
alter table crm_activities enable row level security;
create index if not exists crm_activities_contact_idx on crm_activities(crm_contact_id, occurred_at desc);

-- Notifications: priority (so security/billing doesn't look the same as a
-- promotions-tab email) — computed at insert time by the sync worker.
alter table admin_notifications
  add column if not exists priority text not null default 'normal'
    check (priority in ('high','normal','low'));

-- Admin-scoped read policy so the browser can subscribe to Realtime on this
-- table directly (service-role bypasses RLS already; this is additive, for
-- the authenticated admin user's own client-side subscription). Insert/
-- update/delete stay service-role only — no policy added for those.
create policy "admins can read notifications" on admin_notifications
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

alter publication supabase_realtime add table admin_notifications;
