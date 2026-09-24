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
 * There is one Stripe account for the whole Flowen group, not one per
 * entity, so — unlike bookkeeping-categorize and
 * bookkeeping-expense-from-email, which genuinely run once per connected
 * entity — this books every charge against a single configured entity
 * (XERO_STRIPE_SYNC_ENTITY, defaulting to 'group') rather than looping over
 * all of them. Which entity actually recognises subscription revenue is a
 * business/accounting decision (e.g. the trading subsidiary rather than the
 * holding company) — change the env var once that's settled; this only
 * fixes the plumbing so it's a one-line config change, not a code change.
 *
 * Skips cleanly (ok:true, skipped:true) if that entity doesn't have Xero
 * connected yet — see /admin/bookkeeping.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logging';
import { adminDb as db } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe';
import { getValidXeroAccess, findXeroInvoiceByReference } from '@/lib/xero';
import { isXeroEntitySlug, type XeroEntitySlug } from '@/lib/flowen-entities';

const LOOKBACK_DAYS = 3;
const DEFAULT_ENTITY: XeroEntitySlug = 'group';

async function handle(_req: NextRequest): Promise<NextResponse> {
  const configuredEntity = process.env.XERO_STRIPE_SYNC_ENTITY;
  const entity: XeroEntitySlug = configuredEntity && isXeroEntitySlug(configuredEntity) ? configuredEntity : DEFAULT_ENTITY;

  const xeroAccess = await getValidXeroAccess(entity);
  if (!xeroAccess) {
    return NextResponse.json({ ok: true, skipped: true, reason: `Xero not connected for ${entity} — visit /admin/bookkeeping` });
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
        .eq('entity', entity)
        .neq('status', 'rejected')
        .maybeSingle();
      if (existingDraft) { skippedExistingDraft++; continue; }

      const existingInvoice = await findXeroInvoiceByReference(entity, charge.id);
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
        entity,
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
    entity,
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
