/**
 * bookkeeping-stripe-sync
 *
 * Proposes a bookkeeping_drafts row (draft_type='stripe_sync') for every
 * recent successful Stripe charge that doesn't already have a matching Xero
 * invoice — the "sync Stripe payments to Xero" capability. This is a
 * deterministic 1:1 mapping (no LLM judgement call involved, so no
 * confidence scoring beyond a flat high default), but it still lands as a
 * draft, not a direct write: /api/admin/bookkeeping/drafts is the only code
 * path allowed to actually create anything in Xero, same discipline as
 * every other AI-assisted action in this codebase.
 *
 * Skips cleanly (ok:true, skipped:true) if Xero isn't connected yet — see
 * /admin/bookkeeping.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logging';
import { adminDb as db } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe';
import { getValidXeroAccess, findXeroInvoiceByReference } from '@/lib/xero';

const LOOKBACK_DAYS = 3;

async function handle(_req: NextRequest): Promise<NextResponse> {
  const xeroAccess = await getValidXeroAccess();
  if (!xeroAccess) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Xero not connected — visit /admin/bookkeeping' });
  }

  const { client: stripe } = await getStripeClient();
  const since = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 60 * 60;

  const charges = await stripe.charges.list({
    limit: 100,
    created: { gte: since },
    expand: ['data.customer'],
  });

  const supabase = db();
  let proposed = 0;
  let skippedExistingDraft = 0;
  let skippedExistingXeroInvoice = 0;
  let skippedNotSucceeded = 0;
  const errors: { chargeId: string; error: string }[] = [];

  for (const charge of charges.data) {
    if (charge.status !== 'succeeded' || charge.refunded) {
      skippedNotSucceeded++;
      continue;
    }

    try {
      const { data: existingDraft } = await supabase
        .from('bookkeeping_drafts')
        .select('id')
        .eq('draft_type', 'stripe_sync')
        .eq('source_ref', charge.id)
        .neq('status', 'rejected')
        .maybeSingle();
      if (existingDraft) { skippedExistingDraft++; continue; }

      const existingInvoice = await findXeroInvoiceByReference(charge.id);
      if (existingInvoice) { skippedExistingXeroInvoice++; continue; }

      const customer = typeof charge.customer === 'object' && charge.customer && !charge.customer.deleted
        ? charge.customer
        : null;
      const contactName = customer?.name || customer?.email || charge.billing_details?.email || charge.billing_details?.name || `Stripe customer ${charge.customer ?? charge.id}`;
      const contactEmail = customer?.email || charge.billing_details?.email || undefined;
      const amount = charge.amount / 100;
      const date = new Date(charge.created * 1000).toISOString().slice(0, 10);

      const proposedPayload = {
        contactName,
        contactEmail,
        reference: charge.id,
        description: charge.description || 'Flowen subscription payment',
        amount,
        currency: charge.currency,
        accountCode: process.env.XERO_SALES_ACCOUNT_CODE ?? '',
        bankAccountCode: process.env.XERO_BANK_ACCOUNT_CODE ?? '',
        date,
      };

      const { error: insertErr } = await supabase.from('bookkeeping_drafts').insert({
        draft_type: 'stripe_sync',
        source_ref: charge.id,
        title: `${contactName} — ${charge.currency.toUpperCase()} ${amount.toFixed(2)}`,
        summary: `Create a Xero invoice + payment for this Stripe charge (${date}).`,
        proposed_payload: proposedPayload,
        confidence_pct: 95,
        model: null,
      });
      if (insertErr) throw new Error(insertErr.message);
      proposed++;
    } catch (err) {
      errors.push({ chargeId: charge.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    checked: charges.data.length,
    proposed,
    skipped_existing_draft: skippedExistingDraft,
    skipped_existing_xero_invoice: skippedExistingXeroInvoice,
    skipped_not_succeeded: skippedNotSucceeded,
    errors,
  });
}

export const GET = withCronLogging('bookkeeping-stripe-sync', handle);
export const POST = withCronLogging('bookkeeping-stripe-sync', handle);
