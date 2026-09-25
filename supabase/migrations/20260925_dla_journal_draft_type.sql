-- Adds 'dla_journal' to bookkeeping_drafts.draft_type — a manual journal
-- crediting an entity's director's loan account (a Current Liability account,
-- confirmed not bank-type) against one or more expense accounts, for
-- personally-paid expenses reimbursed via the DLA rather than the company's
-- own bank feed. Distinct from every existing draft_type: stripe_sync and
-- expense_from_email create bills/invoices against a bank or trade contact;
-- this creates a Xero ManualJournal directly, since a Current Liability
-- account can't be the "paid from" account on a bill payment.
alter table bookkeeping_drafts drop constraint if exists bookkeeping_drafts_draft_type_check;
alter table bookkeeping_drafts add constraint bookkeeping_drafts_draft_type_check
  check (draft_type in ('stripe_sync', 'categorize', 'vat_reconciliation', 'expense_from_email', 'dla_journal'));
