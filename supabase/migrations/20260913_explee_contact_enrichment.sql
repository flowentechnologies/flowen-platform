-- Fields Explee's real OpenAPI spec (api-1.yaml) revealed we weren't
-- capturing: ThreadResponse carries can_reply/reply_blocked_reason (the
-- compliance gate for the reply feature) plus a LeadProfile with the
-- team-shared note Explee's own AutoGTM inbox shows — none of it landed
-- anywhere before, even though explee-outreach-sync already fetches this
-- exact response for every contact whose thread changed.
--
-- job_title/company/company_domain/linkedin_url/country/phone are NOT
-- duplicated here — those already exist on crm_contacts (populated today
-- only for Explee-flagged hot leads, via explee-hot-leads); the sync now
-- also fills them in for every contact, hot or not, using the same columns.
alter table explee_contacts
  add column if not exists can_reply boolean,
  add column if not exists reply_blocked_reason text,
  add column if not exists needs_reply boolean not null default false,
  add column if not exists explee_note text,
  add column if not exists explee_note_updated_at timestamptz,
  add column if not exists explee_note_updated_by text,
  add column if not exists profile_synced_at timestamptz;

comment on column explee_contacts.needs_reply is
  'True when this person is in Explee''s own tab=need_reply set for its campaign — a real reply awaiting a human answer, not a heuristic we derived ourselves. Recomputed every sync run from a dedicated per-campaign fetch.';
comment on column explee_contacts.can_reply is
  'Whether POST .../reply is currently allowed for this contact (Explee''s compliance gate) — false once unsubscribed, or if they never replied at all.';
comment on column explee_contacts.explee_note is
  'The team-shared free-text note Explee''s own AutoGTM inbox shows for this lead (GET/POST .../note) — distinct from crm_contacts.notes, which is Flowen''s own CRM note field.';
comment on column explee_contacts.profile_synced_at is
  'When this row last had its LeadProfile (job title/company/LinkedIn/country/phone/note) fetched via the thread endpoint. Null means never — used to prioritise a bounded backfill batch each run rather than a one-off script, since normal syncing only re-fetches a thread when sent/reply activity actually changed.';

create index if not exists explee_contacts_needs_reply_idx on explee_contacts (needs_reply) where needs_reply = true;
create index if not exists explee_contacts_profile_synced_at_idx on explee_contacts (profile_synced_at) where profile_synced_at is null;
