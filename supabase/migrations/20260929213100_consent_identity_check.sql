-- Require each consent decision to be bound to a visitor or signed-in user.
alter table public.consent_records
  add constraint consent_records_identity_check
  check (anonymous_id is not null or user_id is not null);
