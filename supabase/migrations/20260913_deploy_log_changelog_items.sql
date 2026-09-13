-- deploy_log recorded every production deploy (187 rows, 156 real
-- feat/fix/improved items) but only ever stored a COUNT (feat_items) —
-- never the actual titles. That's exactly why the AI-drafted investor
-- update had nothing concrete to say about "what shipped this month" and
-- defaulted to a generic "no major product changes" filler: the prompt
-- asked for it, the data never supplied it.
alter table deploy_log add column if not exists changelog_items jsonb;

comment on column deploy_log.changelog_items is
  'The actual parsed feat:/fix:/perf:/security:/policy: items from this deploy''s commit message — [{type, title, description}]. Null for deploys with no user-facing items (chore/docs/refactor/etc). Lets investor-update drafting (and anything else) describe real shipped work instead of just a count.';
