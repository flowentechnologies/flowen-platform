-- Multi-entity Xero support. The Flowen group is 4 companies (Flowen Group
-- Ltd, Flowen IP Ltd, Flowen Speech Technologies Ltd, Flowen Labs Limited —
-- slugs 'group' / 'ip' / 'speech-technologies' / 'labs', see
-- src/lib/flowen-entities.ts), each its own Xero organisation. Until now
-- xero_oauth_tokens held exactly one fixed row (id='org') and every
-- bookkeeping draft was implicitly "the" org — this migration turns that
-- single row into one-per-entity and tags every draft with which entity it
-- targets.

-- id was always the literal string 'org' — repurpose it as the entity slug
-- rather than adding a parallel column.
alter table xero_oauth_tokens rename column id to entity;
alter table xero_oauth_tokens alter column entity drop default;
update xero_oauth_tokens set entity = 'group' where entity = 'org';
alter table xero_oauth_tokens add constraint xero_oauth_tokens_entity_check
  check (entity in ('group', 'ip', 'speech-technologies', 'labs'));
comment on table xero_oauth_tokens is
  'One row per connected Flowen group company (entity = group/ip/speech-technologies/labs — see src/lib/flowen-entities.ts), refreshed by getValidXeroAccess(entity). No RLS policies — service-role (adminDb) access only, same as gmail_oauth_tokens.';

-- Every draft now records which company's Xero it was proposed against.
-- Backfill to 'group' (the only entity that existed before this migration),
-- then drop the default so every new insert must say explicitly which
-- entity it's for — no silent single-entity assumption going forward.
alter table bookkeeping_drafts add column if not exists entity text not null default 'group'
  check (entity in ('group', 'ip', 'speech-technologies', 'labs'));
alter table bookkeeping_drafts alter column entity drop default;
create index if not exists bookkeeping_drafts_entity_idx on bookkeeping_drafts (entity);

-- The type+ref dedupe lookup in every drafting cron now scopes by entity too
-- (belt-and-braces — Xero ids are per-organisation GUIDs already, but this
-- keeps the index aligned with how the crons actually query).
drop index if exists bookkeeping_drafts_type_ref_idx;
create index if not exists bookkeeping_drafts_type_ref_entity_idx on bookkeeping_drafts (draft_type, source_ref, entity);
