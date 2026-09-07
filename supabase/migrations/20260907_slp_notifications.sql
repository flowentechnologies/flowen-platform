-- SLT-facing real-time notifications: new patient message, session completed.
--
-- Two clinician systems coexist in this codebase (role='clinician', the
-- older one actually in use — the only real slp_assignments row today is
-- for a role='clinician' profile — and role='slp', a newer /slp/* portal
-- with zero real users yet). Both key off the same slp_assignments /
-- slp_messages / practice_sessions tables via slp_user_id, so this table
-- and its triggers work for either role without needing to know which
-- portal the recipient will actually view it in.
create table slp_notifications (
  id           uuid primary key default gen_random_uuid(),
  slp_user_id  uuid not null references profiles(id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  link         text,
  priority     text not null default 'normal',
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index idx_slp_notifications_recipient on slp_notifications(slp_user_id, read_at);

alter table slp_notifications enable row level security;

create policy "clinicians read their own notifications"
  on slp_notifications for select
  using (auth.uid() = slp_user_id);

create policy "clinicians update their own notifications"
  on slp_notifications for update
  using (auth.uid() = slp_user_id);

alter publication supabase_realtime add table slp_notifications;

-- Trigger 1: a message arrives for a clinician/SLT recipient.
create or replace function notify_slp_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_role text;
  sender_name    text;
begin
  select role into recipient_role from profiles where id = new.to_user_id;
  if recipient_role in ('clinician', 'slp') then
    select coalesce(display_name, email) into sender_name from profiles where id = new.from_user_id;
    insert into slp_notifications (slp_user_id, type, title, body, link, priority)
    values (
      new.to_user_id,
      'new_message',
      'New message from ' || coalesce(sender_name, 'a patient'),
      left(new.content, 140),
      '/dashboard/messages',
      'normal'
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_slp_new_message
  after insert on slp_messages
  for each row execute function notify_slp_new_message();

-- Trigger 2: a patient completes a practice session — notify their
-- assigned clinician(s) via slp_assignments.
create or replace function notify_slp_session_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  patient_name text;
  assignment   record;
begin
  select coalesce(display_name, email) into patient_name from profiles where id = new.user_id;
  for assignment in
    select slp_user_id from slp_assignments where patient_user_id = new.user_id
  loop
    insert into slp_notifications (slp_user_id, type, title, body, link, priority)
    values (
      assignment.slp_user_id,
      'session_completed',
      coalesce(patient_name, 'A patient') || ' completed a practice session',
      'Stage ' || new.stage_id || ' - ' || round((new.duration_seconds / 60.0)::numeric, 1) || ' min - '
        || coalesce(new.total_blocks_detected, 0) || ' blocks detected',
      '/dashboard/clinician',
      'normal'
    );
  end loop;
  return new;
end;
$$;

create trigger trg_notify_slp_session_completed
  after insert on practice_sessions
  for each row execute function notify_slp_session_completed();
