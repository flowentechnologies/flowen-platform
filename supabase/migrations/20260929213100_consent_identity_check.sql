-- Require each consent decision to be bound to a visitor or signed-in user.
-- Guarded (no native ADD CONSTRAINT IF NOT EXISTS in Postgres) because this
-- constraint was already applied directly to production ahead of this PR's
-- merge, under a different migration name/timestamp — see PR #74 discussion.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'consent_records_identity_check'
  ) then
    alter table public.consent_records
      add constraint consent_records_identity_check
      check (anonymous_id is not null or user_id is not null);
  end if;
end $$;
