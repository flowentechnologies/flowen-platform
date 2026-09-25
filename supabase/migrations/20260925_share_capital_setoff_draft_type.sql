-- Adds 'share_capital_setoff' to bookkeeping_drafts.draft_type — a manual
-- journal recording share capital as paid up by way of set-off against the
-- director's loan account, per the signed sole-director resolutions
-- (Group £100/10,000 shares, IP/Labs/Speech Technologies £1 each, all
-- incorporated 21 Sep 2026, resolutions dated 24-25 Sep 2026).
--
-- Distinct from dla_journal: dla_journal always CREDITS the DLA (the company
-- reimbursing Howard for expenses he personally paid, increasing what it
-- owes him). This is the opposite polarity — DEBITING the DLA (using up
-- Howard's existing credit balance as consideration for the shares, which
-- reduces what the company owes him) and CREDITING the Share Capital
-- (Unpaid) debtor to clear it. Sharing draft_type 'dla_journal' would have
-- meant either hardcoding the wrong direction or overloading its payload's
-- sign convention silently — a new type keeps the direction explicit and
-- reviewable per-draft.
alter table bookkeeping_drafts drop constraint if exists bookkeeping_drafts_draft_type_check;
alter table bookkeeping_drafts add constraint bookkeeping_drafts_draft_type_check
  check (draft_type in ('stripe_sync', 'categorize', 'vat_reconciliation', 'expense_from_email', 'dla_journal', 'share_capital_setoff'));
