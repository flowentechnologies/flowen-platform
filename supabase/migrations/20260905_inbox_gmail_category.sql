-- Surfaces Gmail's own native inbox categorization (the Primary/Social/
-- Promotions/Updates/Forums tabs, plus Spam) alongside the existing
-- alias/vendor-driven `category` column. These answer different questions:
-- `category` = "which business function" (billing/press/security/...),
-- `gmail_category` = "what kind of mail is this, per Gmail's own ML"
-- (primary/social/promotions/updates/forums/spam). Both are useful filters
-- in /admin/inbox independently.
alter table inbox_items
  add column if not exists gmail_category text
    check (gmail_category in ('primary','social','promotions','updates','forums','spam'));

create index if not exists inbox_items_gmail_category_idx on inbox_items(gmail_category);
