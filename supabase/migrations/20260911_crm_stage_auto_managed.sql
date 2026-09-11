-- Tracks whether crm_contacts.stage is currently being kept in sync with
-- Explee's own outreach signals (deriveExpleeStage, explee-outreach-sync),
-- or whether a human has taken manual control of it via the CRM UI.
--
-- Without this, an automatic re-sort based on a contact's latest Explee
-- reply would silently clobber a stage a human deliberately set — e.g.
-- moving a contact to "won" after closing a deal, only for the next sync
-- to bounce it back to "in_discussion" because that's what Explee's last
-- classification says. Once a human explicitly changes stage (see
-- PATCH /api/admin/crm), this flips to false and the contact is left
-- alone by every future sync.
alter table crm_contacts
  add column if not exists stage_auto_managed boolean not null default true;

comment on column crm_contacts.stage_auto_managed is
  'true while stage is kept in sync with Explee''s own outreach signals; set to false the moment a human manually changes stage via the CRM UI, and never touched by automation again.';
