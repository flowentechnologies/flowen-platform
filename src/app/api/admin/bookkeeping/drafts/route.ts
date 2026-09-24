/**
 * /api/admin/bookkeeping/drafts
 *
 * GET    — list proposed bookkeeping actions (default: status=pending).
 * PATCH  — the ONLY route in this codebase that can turn a bookkeeping
 *          draft into an actual Xero write. Requires an explicit admin
 *          action per draft: {id, action: 'approve' | 'reject', payload?}.
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
import { createXeroInvoiceAndPayment, categorizeBankTransaction, createXeroBill } from '@/lib/xero';
import { isXeroEntitySlug } from '@/lib/flowen-entities';

interface StripeSyncPayload {
  contactName: string; contactEmail?: string; reference: string; description: string;
  amount: number; currency: string; accountCode: string; bankAccountCode: string; date: string;
}
interface CategorizePayload { bankTransactionId: string; accountCode: string }
interface ExpenseFromEmailPayload {
  contactName: string; reference: string; description: string; amount: number; currency: string; accountCode: string; date: string;
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

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as {
    id?: string;
    action?: 'approve' | 'reject';
    payload?: Record<string, unknown>; // optional edit before applying
  };
  if (!body.id || !body.action) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
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
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Apply failed' }, { status: 500 });
  }
}
