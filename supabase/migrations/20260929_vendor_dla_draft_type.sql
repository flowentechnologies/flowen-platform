-- Allow manual vendor-cost proposals; Xero write still requires an explicit approval.
alter table bookkeeping_drafts drop constraint if exists bookkeeping_drafts_draft_type_check;
alter table bookkeeping_drafts add constraint bookkeeping_drafts_draft_type_check
  check (draft_type in ('stripe_sync', 'categorize', 'vat_reconciliation', 'expense_from_email', 'dla_journal', 'share_capital_setoff', 'vendor_dla'));
