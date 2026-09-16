-- Xero integration + bookkeeping AI agent — same shape as the Gmail
-- integration (xero_oauth_tokens mirrors gmail_oauth_tokens) and the
-- inbox AI-draft-then-approve pattern (bookkeeping_drafts mirrors
-- ai_drafts): every proposed bookkeeping action lands here with
-- status='pending' and is NEVER written to Xero automatically — the only
-- code path that can call Xero's write API is the explicit admin approval
-- in /api/admin/bookkeeping/drafts (PATCH), same discipline as
-- /api/admin/drafts for Gmail sends.

create table if not exists xero_oauth_tokens (
  id            text primary key default 'org',
  tenant_id     text,          -- Xero organisation ("tenant") this token is scoped to
  tenant_name   text,
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,
  scope         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table xero_oauth_tokens enable row level security;
comment on table xero_oauth_tokens is
  'Single-row OAuth token for the connected Xero organisation, refreshed by getValidXeroAccessToken(). No RLS policies — service-role (adminDb) access only, same as gmail_oauth_tokens.';

create table if not exists bookkeeping_drafts (
  id                uuid primary key default gen_random_uuid(),
  draft_type        text not null check (draft_type in (
                       'stripe_sync', 'categorize', 'vat_reconciliation', 'expense_from_email'
                     )),
  status            text not null default 'pending' check (status in (
                       'pending', 'approved', 'rejected', 'applied'
                     )),
  -- What this draft is "about" on the source side — a Stripe invoice/charge
  -- id, a Xero bank transaction id, a vendor_invoices.id, etc. Used both for
  -- display and to skip re-proposing something already drafted.
  source_ref        text,
  title             text not null,
  summary           text,
  -- The exact payload that would be sent to Xero's API if approved — e.g. a
  -- draft Invoice/Payment/BankTransaction body. Rendered read-only (and
  -- editable before approval, same as ai_drafts.subject/body_text) in
  -- /admin/bookkeeping.
  proposed_payload  jsonb not null,
  confidence_pct    int,
  model             text,
  xero_result       jsonb,
  reviewed_by       uuid references profiles(id),
  reviewed_at       timestamptz,
  applied_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists bookkeeping_drafts_status_idx on bookkeeping_drafts (status);
create index if not exists bookkeeping_drafts_type_ref_idx on bookkeeping_drafts (draft_type, source_ref);

alter table bookkeeping_drafts enable row level security;
comment on table bookkeeping_drafts is
  'Proposed bookkeeping actions (Stripe->Xero sync, bank transaction categorisation, VAT/intercompany reconciliation, expense-from-email) awaiting admin approval. Mirrors ai_drafts: status starts pending, and only an explicit PATCH .../approve in /api/admin/bookkeeping/drafts is allowed to write to Xero.';
