-- Tracks the dedup lists this app has built on Explee — one immutable
-- snapshot per "Refresh" click on /admin/prospecting, built from the
-- current CRM contact base. Explee's own dedup lists can't be modified
-- once created (per its docs: create a new one per batch, consolidate
-- periodically) — this table just remembers the latest one's id so
-- new prospecting searches can pass it in exclude_lists automatically,
-- without the admin having to track the id themselves.
create table if not exists explee_dedup_lists (
  id           text primary key, -- Explee's own list id
  kind         text not null check (kind in ('people', 'companies')),
  source       text not null default 'crm_contacts',
  total        integer not null,
  invalid_count integer not null default 0,
  created_by   text,
  created_at   timestamptz not null default now()
);

comment on table explee_dedup_lists is
  'Immutable Explee dedup lists this app has created — the most recent kind=''people'' row is automatically passed as exclude_lists on every new prospecting search, so results already in the CRM are excluded and never charged.';
