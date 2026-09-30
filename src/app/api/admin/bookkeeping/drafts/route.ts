/**
 * /api/admin/bookkeeping/drafts
 *
 * POST   — create one pending vendor DLA draft; never writes to Xero.
 * GET    — list proposed bookkeeping actions (default: status=pending).
 * PATCH  — the ONLY route in this codebase that can turn a bookkeeping
 *          draft into an actual Xero write. Requires an explicit admin
 *          action per draft: {id, action: 'approve' | 'reject' | 'save', payload?}.
 *          'approve' dispatches to the right src/lib/xero.ts write function
 *          by draft_type — there is no confidence threshold that skips
 *          this, ever: every draft type requires manual approval here,
 *          same discipline as /api/admin/drafts for Gmail sends.
 *
 *          'payload' lets the admin edit the proposed_payload before it's
 *          applied (e.g. filling in a Xero account code the drafting cron
 *          left blank) — same pattern as editing subject/body_text on an
 *          email draft before approving.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/admin/audit';
import { createXeroInvoiceAndPayment, categorizeBankTransaction, createXeroBill, createXeroManualJournal, createXeroShareCapitalSetoff, listChartOfAccounts } from '@/lib/xero';
import { isXeroEntitySlug } from '@/lib/flowen-entities';

interface StripeSyncPayload {
  contactName: string; contactEmail?: string; reference: string; description: string;
  amount: number; currency: string; accountCode: string; bankAccountCode: string; date: string;
}
interface CategorizePayload { bankTransactionId: string; accountCode: string }
interface ExpenseFromEmailPayload {
  contactName: string; reference: string; description: string; amount: number; currency: string; accountCode: string; date: string;
}
interface DlaJournalPayload {
  narration: string; date: string; dlaAccountCode: string;
  lines: { accountCode: string; description: string; amount: number }[];
}
interface VendorDlaPayload {
  vendor: string; description: string; amount: number; currency: string; date: string;
  dlaAccountCode: string; expenseAccountCode: string; gbpAmount: number | null;
  evidenceUrl: string; reference: string; vatReview: true; vatNote: string;
}
interface ShareCapitalSetoffPayload {
  narration: string; date: string; dlaAccountCode: string; shareCapitalAccountCode: string; amount: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending';
  const draftType = searchParams.get('draft_type');
  const entity = searchParams.get('entity');

  let query = db()
    .from('bookkeeping_drafts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'all') query = query.eq('status', status);
  if (draftType) query = query.eq('draft_type', draftType);
  if (entity) query = query.eq('entity', entity);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drafts: data, admin: admin.email });
}

/** Create a pending proposal only. Never calls Xero. The GBP journal amount and
 * expense-side chart account remain mandatory approval-time decisions. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  let input: Record<string, unknown>;
  try { input = await req.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const text = (key: string) => typeof input[key] === 'string' ? (input[key] as string).trim() : '';
  const entity = text('entity');
  const vendor = text('vendor');
  const description = text('description');
  const reference = text('reference');
  const date = text('date');
  const currency = text('currency').toUpperCase();
  const dlaAccountCode = text('dlaAccountCode') || '835';
  const expenseAccountCode = text('expenseAccountCode');
  const evidenceUrl = text('evidenceUrl');
  const vatNote = text('vatNote');
  const amount = input.amount;
  const gbpAmount = input.gbpAmount;
  if (!isXeroEntitySlug(entity) || !vendor || vendor.length > 120 || !description || description.length > 500 ||
      !reference || reference.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date ||
      !/^[A-Z]{3}$/.test(currency) || typeof amount !== 'number' || !Number.isFinite(amount) ||
      amount <= 0 || Math.abs(Math.round(amount * 100) - amount * 100) > 1e-7 || !/^\d{2,10}$/.test(dlaAccountCode) ||
      (expenseAccountCode && !/^\d{2,10}$/.test(expenseAccountCode)) ||
      (gbpAmount != null && (typeof gbpAmount !== 'number' || !Number.isFinite(gbpAmount) || gbpAmount <= 0 || Math.abs(Math.round(gbpAmount * 100) - gbpAmount * 100) > 1e-7)) ||
      (currency === 'GBP' && gbpAmount != null && gbpAmount !== amount) ||
      input.vatReview !== true || vatNote.length > 500) {
    return NextResponse.json({ error: 'Invalid vendor DLA draft fields' }, { status: 400 });
  }
  try {
    const url = new URL(evidenceUrl);
    if (url.protocol !== 'https:' || !url.hostname || evidenceUrl.length > 2048) throw new Error();
  } catch { return NextResponse.json({ error: 'A valid HTTPS evidence URL is required' }, { status: 400 }); }

  const sourceRef = `manual-vendor-dla:${entity}:${reference}`;
  const supabase = db();
  const { data: existing, error: lookupError } = await supabase.from('bookkeeping_drafts')
    .select('id, status').eq('entity', entity).eq('draft_type', 'vendor_dla')
    .eq('source_ref', sourceRef).neq('status', 'rejected').limit(1);
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (existing?.length) return NextResponse.json({ error: 'A draft with this entity and reference already exists', draftId: existing[0].id }, { status: 409 });

  const payload: VendorDlaPayload = { vendor, description, reference, date, currency,
    amount, dlaAccountCode, expenseAccountCode, gbpAmount: currency === 'GBP' ? amount : (gbpAmount ?? null),
    evidenceUrl, vatReview: true, vatNote };
  const { data: draft, error } = await supabase.from('bookkeeping_drafts').insert({
    draft_type: 'vendor_dla', entity, source_ref: sourceRef, status: 'pending',
    title: `${vendor} — ${currency} ${amount.toFixed(2)} (DLA draft)`,
    summary: `${description} | ${reference} | VAT/account review required${vatNote ? `: ${vatNote}` : ''}`,
    proposed_payload: payload,
  }).select('id, status, entity, proposed_payload').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAuditEvent({ action: 'bookkeeping.vendor_dla_draft_created', actor_id: admin.id,
    metadata: { draft_id: draft.id, entity, reference } });
  return NextResponse.json({ draft }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as {
    id?: string;
    action?: 'approve' | 'reject' | 'save';
    payload?: Record<string, unknown>; // optional edit before applying
  };
  if (!body.id || !['approve', 'reject', 'save'].includes(body.action ?? '')) {
    return NextResponse.json({ error: 'id and a valid action are required' }, { status: 400 });
  }

  const supabase = db();
  const { data: draft, error: fetchErr } = await supabase
    .from('bookkeeping_drafts').select('*').eq('id', body.id).single();
  if (fetchErr || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }
  if (draft.status !== 'pending') {
    return NextResponse.json({ error: `Draft already ${draft.status}` }, { status: 409 });
  }
  if (!isXeroEntitySlug(draft.entity)) {
    return NextResponse.json({ error: `Draft has an invalid entity: ${draft.entity}` }, { status: 500 });
  }
  const entity = draft.entity;

  // Saving a pending vendor draft is separate from approval and never calls Xero.
  if (body.action === 'save') {
    if (draft.draft_type !== 'vendor_dla') {
      return NextResponse.json({ error: 'Save is only supported for vendor DLA drafts' }, { status: 400 });
    }
    const edits = body.payload;
    const allowed = new Set(['expenseAccountCode', 'gbpAmount', 'evidenceUrl', 'vatNote']);
    if (!edits || typeof edits !== 'object' || Array.isArray(edits) ||
        !Object.keys(edits).length || Object.keys(edits).some(key => !allowed.has(key))) {
      return NextResponse.json({ error: 'Only expense account, GBP amount, evidence URL and VAT note may be edited' }, { status: 400 });
    }
    const payload = { ...draft.proposed_payload, ...edits } as VendorDlaPayload;
    if (typeof payload.expenseAccountCode !== 'string' ||
        (payload.expenseAccountCode !== '' && !/^\d{2,10}$/.test(payload.expenseAccountCode)) ||
        (payload.gbpAmount !== null && (typeof payload.gbpAmount !== 'number' ||
          !Number.isFinite(payload.gbpAmount) || payload.gbpAmount <= 0 ||
          Math.abs(Math.round(payload.gbpAmount * 100) - payload.gbpAmount * 100) > 1e-7)) ||
        (payload.currency === 'GBP' && payload.gbpAmount !== payload.amount) ||
        typeof payload.vatNote !== 'string' || payload.vatNote.length > 500) {
      return NextResponse.json({ error: 'Use a valid expense account code and positive GBP amount with at most two decimals; GBP sources must keep their source amount' }, { status: 400 });
    }
    try {
      const url = new URL(payload.evidenceUrl);
      if (typeof payload.evidenceUrl !== 'string' || payload.evidenceUrl.length > 2048 ||
          url.protocol !== 'https:' || !url.hostname) throw new Error();
    } catch { return NextResponse.json({ error: 'A valid HTTPS evidence URL is required' }, { status: 400 }); }

    // Include the pending guard in the write so a reviewed draft cannot be edited.
    const { data: saved, error: saveError } = await supabase.from('bookkeeping_drafts')
      .update({ proposed_payload: payload })
      .eq('id', body.id).eq('status', 'pending')
      .select('id, status, proposed_payload').maybeSingle();
    if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });
    if (!saved) return NextResponse.json({ error: 'Draft is no longer pending' }, { status: 409 });
    await logAuditEvent({ action: 'bookkeeping.vendor_dla_draft_edited', actor_id: admin.id,
      metadata: { draft_id: body.id, entity, fields: Object.keys(edits) } });
    return NextResponse.json({ draft: saved });
  }

  if (body.action === 'reject') {
    await supabase.from('bookkeeping_drafts').update({
      status: 'rejected', reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
    }).eq('id', body.id);
    await logAuditEvent({ action: 'bookkeeping.draft_rejected', actor_id: admin.id, metadata: { draft_id: body.id, draft_type: draft.draft_type } });
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  // action === 'approve' — the actual Xero write, dispatched by draft_type.
  const payload = { ...draft.proposed_payload, ...(body.payload ?? {}) };
  const wasEdited = Boolean(body.payload && Object.keys(body.payload).length > 0);

  try {
    let xeroResult: Record<string, unknown>;

    switch (draft.draft_type as string) {
      case 'stripe_sync': {
        const p = payload as StripeSyncPayload;
        if (!p.accountCode || !p.bankAccountCode) {
          return NextResponse.json({ error: 'accountCode and bankAccountCode must be set before approving' }, { status: 400 });
        }
        const result = await createXeroInvoiceAndPayment(entity, p);
        xeroResult = result;
        break;
      }
      case 'categorize': {
        const p = payload as CategorizePayload;
        if (!p.accountCode) {
          return NextResponse.json({ error: 'accountCode must be set before approving' }, { status: 400 });
        }
        await categorizeBankTransaction(entity, p.bankTransactionId, p.accountCode);
        xeroResult = { bankTransactionId: p.bankTransactionId, accountCode: p.accountCode };
        break;
      }
      case 'expense_from_email': {
        const p = payload as ExpenseFromEmailPayload;
        if (!p.accountCode) {
          return NextResponse.json({ error: 'accountCode must be set before approving' }, { status: 400 });
        }
        const result = await createXeroBill(entity, p);
        xeroResult = result;
        break;
      }
      case 'dla_journal': {
        const p = payload as DlaJournalPayload;
        if (!p.dlaAccountCode || !p.lines?.length || p.lines.some(l => !l.accountCode)) {
          return NextResponse.json({ error: 'dlaAccountCode and every line\'s accountCode must be set before approving' }, { status: 400 });
        }
        const result = await createXeroManualJournal(entity, p);
        xeroResult = result;
        break;
      }
      case 'vendor_dla': {
        const p = payload as VendorDlaPayload;
        // Manual journals post in the Xero organisation's GBP base currency.
        // Never re-label a source USD number as GBP or infer an exchange rate.
        const gbp = Number(p.gbpAmount);
        if (!p.expenseAccountCode || !p.dlaAccountCode || !Number.isFinite(gbp) || gbp <= 0 ||
            Math.abs(Math.round(gbp * 100) - gbp * 100) > 1e-7 || !p.vatReview || !p.evidenceUrl) {
          return NextResponse.json({ error: 'GBP card amount, expense account, DLA account and evidence/VAT review are required before approval' }, { status: 400 });
        }
        if (p.currency === 'GBP' && gbp !== Number(p.amount)) {
          return NextResponse.json({ error: 'GBP draft source amount and journal amount disagree' }, { status: 400 });
        }
        const accounts = await listChartOfAccounts(entity);
        if (!accounts.some(a => a.Code === p.expenseAccountCode && a.Class === 'EXPENSE') ||
            !accounts.some(a => a.Code === p.dlaAccountCode && a.Type === 'CURRLIAB')) {
          return NextResponse.json({ error: 'Expense or DLA code not found in the selected Xero entity chart' }, { status: 400 });
        }
        const result = await createXeroManualJournal(entity, {
          narration: `${p.vendor} ${p.reference} — ${p.description}; source ${p.currency} ${p.amount}; evidence ${p.evidenceUrl}; VAT review: ${p.vatNote || 'pending accountant review'}`,
          date: p.date, dlaAccountCode: p.dlaAccountCode,
          lines: [{ accountCode: p.expenseAccountCode, description: `${p.vendor} ${p.reference} — ${p.description}`, amount: gbp }],
        });
        xeroResult = result;
        break;
      }
      case 'share_capital_setoff': {
        const p = payload as ShareCapitalSetoffPayload;
        if (!p.dlaAccountCode || !p.shareCapitalAccountCode || !p.amount) {
          return NextResponse.json({ error: 'dlaAccountCode, shareCapitalAccountCode, and amount must be set before approving' }, { status: 400 });
        }
        const result = await createXeroShareCapitalSetoff(entity, p);
        xeroResult = result;
        break;
      }
      case 'vat_reconciliation': {
        // No single Xero write corresponds to "approve a reconciliation" —
        // this records the prepared reconciliation as final, for handing to
        // the accountant, rather than posting anything itself.
        xeroResult = { recorded: true, note: 'Reconciliation recorded — no direct Xero write for this draft type.' };
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown draft_type: ${draft.draft_type}` }, { status: 400 });
    }

    await supabase.from('bookkeeping_drafts').update({
      status: 'applied',
      proposed_payload: payload,
      xero_result: xeroResult,
      reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
      applied_at: new Date().toISOString(),
    }).eq('id', body.id);

    await logAuditEvent({
      action: 'bookkeeping.draft_applied', actor_id: admin.id,
      metadata: { draft_id: body.id, draft_type: draft.draft_type, edited: wasEdited },
    });

    return NextResponse.json({ ok: true, status: 'applied', xero_result: xeroResult });
  } catch (err) {
    // Logged server-side, not just returned to the client, so a failed
    // approval shows up in Vercel runtime logs with its real message
    // instead of only a bare 500 status line.
    console.error('[bookkeeping/drafts] approve failed', { draftId: body.id, draftType: draft.draft_type, entity, err });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Apply failed' }, { status: 500 });
  }
}
