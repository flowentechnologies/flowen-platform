-- Explee hot-lead sync: extends crm_contacts with the enrichment fields
-- Explee's /autogtm/hot-leads endpoint returns, and a 'sales_lead' category
-- so these don't get lumped in with 'other'. One row per lead, keyed on the
-- existing email unique constraint (crm_contacts_email_key) so the sync
-- cron can upsert idempotently without a separate dedup table.

alter table crm_contacts
  add column if not exists job_title      text,
  add column if not exists company_domain text,
  add column if not exists linkedin_url   text,
  add column if not exists country        text,
  add column if not exists phone          text,
  add column if not exists why_hot        text,       -- the lead's qualifying reply, verbatim
  add column if not exists became_hot_at  timestamptz, -- when Explee flagged them hot
  add column if not exists explee_person_id text;      -- Explee's stable id, for traceability/debugging

alter table crm_contacts drop constraint crm_contacts_category_check;
alter table crm_contacts add constraint crm_contacts_category_check
  check (category in ('investor','grant','nhs_partner','press','affiliate','vendor','sales_lead','other'));

-- Drives the sync cron's watermark query (max(became_hot_at) where
-- source='explee') so it needs no separate cursor-state table.
create index if not exists crm_contacts_explee_became_hot_idx
  on crm_contacts(became_hot_at) where source = 'explee';
