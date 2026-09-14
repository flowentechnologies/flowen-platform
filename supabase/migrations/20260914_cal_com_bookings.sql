-- Cal.com booking webhook integration — every BOOKING_CREATED event lands
-- here, gets linked to (or creates) a CRM contact by the attendee's email,
-- and raises an admin notification, the same "external event -> CRM +
-- bell" pattern already used for Explee and Gmail.
create table if not exists cal_bookings (
  id                uuid primary key default gen_random_uuid(),
  uid               text unique not null, -- Cal.com's own booking uid
  trigger_event     text not null,
  event_type_title  text,
  organizer_email   text,
  attendee_email    text,
  attendee_name     text,
  start_time        timestamptz,
  end_time          timestamptz,
  status            text,
  crm_contact_id    uuid references crm_contacts(id) on delete set null,
  raw_payload       jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists cal_bookings_attendee_email_idx on cal_bookings (attendee_email);

comment on table cal_bookings is
  'Raw log of Cal.com webhook deliveries (currently BOOKING_CREATED only) — one row per booking, uid-deduplicated so a webhook retry never double-processes.';

-- 'booking_new' joins the existing admin_notifications type set.
alter table admin_notifications drop constraint if exists admin_notifications_type_check;
alter table admin_notifications add constraint admin_notifications_type_check
  check (type = any (array['inbox_new', 'draft_pending', 'vendor_invoice', 'crm_new', 'system', 'booking_new']));
