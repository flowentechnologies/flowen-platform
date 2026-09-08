-- Which version of the pitch deck an investor link opens to, and which PDF
-- "Download PDF" generates for it: 'detailed' (the full data-heavy canvas —
-- the existing default, unchanged behaviour for every pre-existing link) or
-- 'simple' (the plain-language explainer already built into deck.html as
-- its "Simple View" toggle, now also selectable as the link's opening state
-- and its own dedicated PDF instead of always downloading the detailed one).
alter table deck_invites
  add column if not exists variant text not null default 'detailed'
  check (variant in ('detailed', 'simple'));
