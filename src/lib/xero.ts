// ── Xero API helper ────────────────────────────────────────────────────────────
// Single-organisation OAuth integration (one Xero "tenant"), mirroring the
// Gmail integration's shape (src/lib/gmail.ts): a single row of tokens,
// refreshed on demand, with every write gated behind the bookkeeping_drafts
// approval flow in /api/admin/bookkeeping/drafts — nothing in this file is
// ever called except from that route or the read-only drafting crons.
//
// Required OAuth scopes (configured on the Xero app at developer.xero.com) —
// see src/app/api/admin/xero/connect/route.ts for the authoritative list and
// why it uses Xero's post-March-2026 granular scopes rather than the old
// broad accounting.transactions.
//
// SECURITY: every function here is server-only. Never import this from a
// client component — it reads/writes the raw OAuth tokens via adminDb().

import { adminDb as db } from '@/lib/supabase/admin';

const TOKEN_URL = 'https://identity.xero.com/connect/token';
const CONNECTIONS_URL = 'https://api.xero.com/connections';
const API_BASE = 'https://api.xero.com/api.xro/2.0';

export interface XeroTokenRow {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
}

// ── Token management ───────────────────────────────────────────────────────────

export async function getStoredXeroTokens(): Promise<XeroTokenRow | null> {
  const { data, error } = await db()
    .from('xero_oauth_tokens')
    .select('*')
    .eq('id', 'org')
    .maybeSingle();
  if (error || !data) return null;
  return data as XeroTokenRow;
}

/** Returns a valid (non-expired) access token + tenant id, refreshing first
 *  if needed. Every Xero API call below goes through this. Returns null if
 *  Xero has never been connected, or refresh fails (needs reconnect via
 *  /api/admin/xero/connect). */
export async function getValidXeroAccess(): Promise<{ accessToken: string; tenantId: string } | null> {
  const row = await getStoredXeroTokens();
  if (!row || !row.tenant_id) return null;

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const stillValid = expiresAt > Date.now() + 60_000; // 60s safety margin
  if (stillValid) return { accessToken: row.access_token, tenantId: row.tenant_id };

  if (!row.refresh_token) return null; // can't refresh — needs reconnect

  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const body = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    console.error('[xero] token refresh failed:', body.error);
    return null;
  }

  const expires_at = new Date(Date.now() + (body.expires_in ?? 1800) * 1000).toISOString();
  await db().from('xero_oauth_tokens').update({
    access_token: body.access_token,
    // Xero rotates refresh tokens on every use — the old one stops working.
    refresh_token: body.refresh_token ?? row.refresh_token,
    expires_at,
    updated_at: new Date().toISOString(),
  }).eq('id', 'org');

  return { accessToken: body.access_token, tenantId: row.tenant_id };
}

/** Xero issues a token scoped to the user, not a specific organisation —
 *  the actual tenant(s) it can access are discovered via a separate call
 *  after the OAuth exchange. Called once from the callback route. */
export async function fetchXeroConnections(accessToken: string): Promise<{ tenantId: string; tenantName: string }[]> {
  const res = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Xero connections fetch failed: ${res.status}`);
  const body = await res.json() as { tenantId: string; tenantName: string; tenantType: string }[];
  return body.filter(c => c.tenantType === 'ORGANISATION').map(c => ({ tenantId: c.tenantId, tenantName: c.tenantName }));
}

async function xeroFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const access = await getValidXeroAccess();
  if (!access) throw new Error('Xero not connected — visit /admin/bookkeeping to connect.');
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${access.accessToken}`,
      'Xero-tenant-id': access.tenantId,
      Accept: 'application/json',
    },
  });
}

// ── Read helpers (used by drafting crons — never write anything) ───────────────

export interface XeroInvoiceSummary {
  InvoiceID: string;
  InvoiceNumber?: string;
  Reference?: string;
  Status: string;
  Total: number;
}

/** Looks up an existing Xero invoice by its Reference field, which the
 *  Stripe sync always sets to the Stripe invoice/charge id — the dedupe
 *  check that stops the same Stripe payment being proposed twice. */
export async function findXeroInvoiceByReference(reference: string): Promise<XeroInvoiceSummary | null> {
  const res = await xeroFetch(`/Invoices?where=${encodeURIComponent(`Reference=="${reference}"`)}`);
  if (!res.ok) throw new Error(`Xero invoice lookup failed: ${res.status} ${await res.text()}`);
  const body = await res.json() as { Invoices?: XeroInvoiceSummary[] };
  return body.Invoices?.[0] ?? null;
}

export interface XeroContactSummary {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
}

/** Finds a Xero contact by exact name match — used to reuse an existing
 *  customer contact rather than creating a duplicate on every sync. */
export async function findXeroContactByName(name: string): Promise<XeroContactSummary | null> {
  const res = await xeroFetch(`/Contacts?where=${encodeURIComponent(`Name=="${name.replace(/"/g, '\\"')}"`)}`);
  if (!res.ok) throw new Error(`Xero contact lookup failed: ${res.status} ${await res.text()}`);
  const body = await res.json() as { Contacts?: XeroContactSummary[] };
  return body.Contacts?.[0] ?? null;
}

export interface XeroBankTransaction {
  BankTransactionID: string;
  Type: string;
  Contact?: { Name?: string };
  Reference?: string;
  Total: number;
  Date: string;
  IsReconciled: boolean;
  LineItems: { Description?: string; AccountCode?: string }[];
}

/** Unreconciled bank feed lines — the categorisation cron's input. */
export async function listUnreconciledBankTransactions(): Promise<XeroBankTransaction[]> {
  const res = await xeroFetch(`/BankTransactions?where=${encodeURIComponent('IsReconciled==false')}&order=Date DESC`);
  if (!res.ok) throw new Error(`Xero bank transactions fetch failed: ${res.status} ${await res.text()}`);
  const body = await res.json() as { BankTransactions?: XeroBankTransaction[] };
  return body.BankTransactions ?? [];
}

export interface XeroAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type: string;
  Class: string;
}

/** The chart of accounts — what the categorisation cron picks an
 *  AccountCode from. */
export async function listChartOfAccounts(): Promise<XeroAccount[]> {
  const res = await xeroFetch('/Accounts?where=Status=="ACTIVE"');
  if (!res.ok) throw new Error(`Xero accounts fetch failed: ${res.status} ${await res.text()}`);
  const body = await res.json() as { Accounts?: XeroAccount[] };
  return body.Accounts ?? [];
}

// ── Write (only ever called from the approve action in
//    /api/admin/bookkeeping/drafts — never from a cron) ────────────────────────

/** Creates the contact (if it doesn't already exist by name) and an ACCREC
 *  invoice + payment for a Stripe subscription payment. Used by the
 *  'stripe_sync' draft type. */
export async function createXeroInvoiceAndPayment(payload: {
  contactName: string;
  contactEmail?: string;
  reference: string; // Stripe invoice/charge id — dedupe key
  description: string;
  amount: number; // major units (e.g. 19.96), not pence
  currency: string;
  accountCode: string; // revenue account, e.g. sales
  bankAccountCode: string; // the Xero bank account the payment landed in
  date: string; // YYYY-MM-DD
}): Promise<{ invoiceId: string; paymentId: string | null }> {
  let contactId = (await findXeroContactByName(payload.contactName))?.ContactID;
  if (!contactId) {
    const res = await xeroFetch('/Contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Contacts: [{ Name: payload.contactName, EmailAddress: payload.contactEmail }] }),
    });
    if (!res.ok) throw new Error(`Xero contact create failed: ${res.status} ${await res.text()}`);
    const body = await res.json() as { Contacts?: XeroContactSummary[] };
    contactId = body.Contacts?.[0]?.ContactID;
    if (!contactId) throw new Error('Xero contact create returned no ContactID');
  }

  const invRes = await xeroFetch('/Invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Invoices: [{
        Type: 'ACCREC',
        Contact: { ContactID: contactId },
        Date: payload.date,
        DueDate: payload.date,
        Reference: payload.reference,
        CurrencyCode: payload.currency.toUpperCase(),
        Status: 'AUTHORISED',
        LineItems: [{
          Description: payload.description,
          Quantity: 1,
          UnitAmount: payload.amount,
          AccountCode: payload.accountCode,
        }],
      }],
    }),
  });
  if (!invRes.ok) throw new Error(`Xero invoice create failed: ${invRes.status} ${await invRes.text()}`);
  const invBody = await invRes.json() as { Invoices?: { InvoiceID: string }[] };
  const invoiceId = invBody.Invoices?.[0]?.InvoiceID;
  if (!invoiceId) throw new Error('Xero invoice create returned no InvoiceID');

  const payRes = await xeroFetch('/Payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Payments: [{
        Invoice: { InvoiceID: invoiceId },
        Account: { Code: payload.bankAccountCode },
        Date: payload.date,
        Amount: payload.amount,
      }],
    }),
  });
  // A failed payment isn't fatal to the sync — the invoice itself is the
  // record that matters most; surface the payment failure but keep the
  // invoice, same as the rest of this codebase preferring a partial success
  // over losing the whole action.
  let paymentId: string | null = null;
  if (payRes.ok) {
    const payBody = await payRes.json() as { Payments?: { PaymentID: string }[] };
    paymentId = payBody.Payments?.[0]?.PaymentID ?? null;
  } else {
    console.error('[xero] payment create failed (invoice still created):', await payRes.text());
  }

  return { invoiceId, paymentId };
}

/** Applies a category to an existing bank transaction line. Used by the
 *  'categorize' draft type. Xero has no partial-update for line items, so
 *  this re-submits the transaction with the new AccountCode. */
export async function categorizeBankTransaction(bankTransactionId: string, accountCode: string): Promise<void> {
  const res = await xeroFetch('/BankTransactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BankTransactions: [{ BankTransactionID: bankTransactionId, LineItems: [{ AccountCode: accountCode }] }],
    }),
  });
  if (!res.ok) throw new Error(`Xero bank transaction categorise failed: ${res.status} ${await res.text()}`);
}

/** Creates an ACCPAY bill from a captured vendor invoice email. Used by the
 *  'expense_from_email' draft type. */
export async function createXeroBill(payload: {
  contactName: string;
  reference: string; // vendor_invoices.id — dedupe key
  description: string;
  amount: number;
  currency: string;
  accountCode: string; // expense account
  date: string;
}): Promise<{ invoiceId: string }> {
  let contactId = (await findXeroContactByName(payload.contactName))?.ContactID;
  if (!contactId) {
    const res = await xeroFetch('/Contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Contacts: [{ Name: payload.contactName }] }),
    });
    if (!res.ok) throw new Error(`Xero contact create failed: ${res.status} ${await res.text()}`);
    const body = await res.json() as { Contacts?: XeroContactSummary[] };
    contactId = body.Contacts?.[0]?.ContactID;
    if (!contactId) throw new Error('Xero contact create returned no ContactID');
  }

  const res = await xeroFetch('/Invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Invoices: [{
        Type: 'ACCPAY',
        Contact: { ContactID: contactId },
        Date: payload.date,
        DueDate: payload.date,
        Reference: payload.reference,
        CurrencyCode: payload.currency.toUpperCase(),
        Status: 'AUTHORISED',
        LineItems: [{
          Description: payload.description,
          Quantity: 1,
          UnitAmount: payload.amount,
          AccountCode: payload.accountCode,
        }],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Xero bill create failed: ${res.status} ${await res.text()}`);
  const body = await res.json() as { Invoices?: { InvoiceID: string }[] };
  const invoiceId = body.Invoices?.[0]?.InvoiceID;
  if (!invoiceId) throw new Error('Xero bill create returned no InvoiceID');
  return { invoiceId };
}
