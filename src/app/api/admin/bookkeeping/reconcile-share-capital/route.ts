/**
 * POST /api/admin/bookkeeping/reconcile-share-capital
 *
 * Turns the already-signed share capital set-off resolutions into real
 * bookkeeping_drafts — one 'share_capital_setoff' draft per entity, for the
 * shares issued at/after incorporation that were satisfied by way of set-off
 * against Howard's director's loan account rather than a cash payment:
 *
 *   Group                 10,000 × £0.01   £100.00   (resolution 24 Sep 2026)
 *   IP / Labs / Speech    1 × £1.00        £1.00     (resolutions 25 Sep 2026)
 *
 * These figures come straight from the signed resolutions (scratchpad
 * sole-director-resolution-setoff*.html), not a guess.
 *
 * Direction note: the resolutions' own wording says "debit share capital
 * (unpaid), credit director's loan account" — but that's backwards from
 * standard set-off accounting (using up a credit balance you're owed should
 * *debit* the liability, not credit it further). This route posts the
 * direction that actually clears the debtor and reduces the DLA credit
 * balance — debit DLA, credit Share Capital (Unpaid) — via
 * createXeroShareCapitalSetoff(). Flagged clearly in each draft's summary so
 * the accountant can confirm or correct on review before/via approval; nothing
 * is invented if a "Share Capital (Unpaid)" account can't be found —the draft
 * is created with an empty account code, and the existing PATCH validation
 * blocks approval until an admin fills it in.
 *
 * Runs server-side deliberately, same as reconcile-dla: needs a live Xero
 * token, and XERO_CLIENT_ID/SECRET are Vercel-only secrets.
 *
 * Idempotent — dedupes on (draft_type, source_ref, entity). Nothing is
 * applied to Xero here; that only happens when a human approves the
 * resulting draft in /admin/bookkeeping.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { listChartOfAccounts } from '@/lib/xero';
import type { XeroEntitySlug } from '@/lib/flowen-entities';

const DLA_ACCOUNT_CODE = '835';
const JOURNAL_DATE = '2026-09-25';

const SETOFFS: Record<XeroEntitySlug, { amount: number; shares: string; resolutionDate: string }> = {
  group: { amount: 100.00, shares: '10,000 Ordinary shares of £0.01 each', resolutionDate: '24 Sep 2026' },
  ip: { amount: 1.00, shares: '1 Ordinary share of £1.00', resolutionDate: '25 Sep 2026' },
  labs: { amount: 1.00, shares: '1 Ordinary share of £1.00', resolutionDate: '25 Sep 2026' },
  'speech-technologies': { amount: 1.00, shares: '1 Ordinary share of £1.00', resolutionDate: '25 Sep 2026' },
};

/** Finds the entity's "Share Capital (Unpaid)" account. Prefers a name
 *  containing both "share capital" and "unpaid"; falls back to any single
 *  unambiguous "share capital" match. Returns '' (not a guess) if there's no
 *  match or more than one candidate — the draft is still created, just with
 *  an empty account code that PATCH's approval validation will block on
 *  until an admin fills it in from the real chart of accounts. */
function findShareCapitalAccountCode(accounts: { Code: string; Name: string }[]): { code: string; note: string } {
  const byName = (needle: string) => accounts.filter(a => a.Name.toLowerCase().includes(needle));
  const unpaid = byName('share capital').filter(a => a.Name.toLowerCase().includes('unpaid'));
  if (unpaid.length === 1) return { code: unpaid[0].Code, note: `Matched "${unpaid[0].Name}" (${unpaid[0].Code})` };
  const anyShareCapital = byName('share capital');
  if (anyShareCapital.length === 1) return { code: anyShareCapital[0].Code, note: `Matched "${anyShareCapital[0].Name}" (${anyShareCapital[0].Code}) — no "(Unpaid)" variant found, confirm this is the right account` };
  if (anyShareCapital.length > 1) return { code: '', note: `${anyShareCapital.length} accounts contain "share capital" (${anyShareCapital.map(a => `${a.Name} ${a.Code}`).join(', ')}) — ambiguous, admin must pick one before approving` };
  return { code: '', note: 'No account containing "share capital" found in the chart of accounts — admin must add/select one before approving' };
}

export async function POST(): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const supabase = db();
  const results: Record<string, unknown>[] = [];

  for (const [entity, setoff] of Object.entries(SETOFFS) as [XeroEntitySlug, typeof SETOFFS[XeroEntitySlug]][]) {
    const sourceRef = `share-capital-setoff-${entity}`;
    const { data: existingDraft } = await supabase
      .from('bookkeeping_drafts')
      .select('id, status')
      .eq('draft_type', 'share_capital_setoff')
      .eq('source_ref', sourceRef)
      .neq('status', 'rejected')
      .maybeSingle();
    if (existingDraft) {
      results.push({ entity, skipped: `draft already exists (${existingDraft.id}, ${existingDraft.status})` });
      continue;
    }

    try {
      const accounts = await listChartOfAccounts(entity);
      const { code: shareCapitalAccountCode, note } = findShareCapitalAccountCode(accounts);

      const narration = `Share capital set-off — ${setoff.shares} treated as fully paid via set-off against director's loan account, per sole-director resolution dated ${setoff.resolutionDate}`;

      const { data: inserted, error: insertErr } = await supabase.from('bookkeeping_drafts').insert({
        draft_type: 'share_capital_setoff',
        entity,
        source_ref: sourceRef,
        title: `Share capital set-off — £${setoff.amount.toFixed(2)} (${setoff.shares})`,
        summary: `${note}. Direction posted here is debit DLA / credit Share Capital (Unpaid) — the standard way to clear the unpaid-share debtor using an existing DLA credit balance. Note this is the OPPOSITE direction from the literal wording in the signed resolution ("debit share capital (unpaid), credit director's loan account") — flagged for accountant confirmation before/at approval, not silently assumed correct.`,
        proposed_payload: {
          narration,
          date: JOURNAL_DATE,
          dlaAccountCode: DLA_ACCOUNT_CODE,
          shareCapitalAccountCode,
          amount: setoff.amount,
        },
        confidence_pct: shareCapitalAccountCode ? 60 : 20, // capped well below auto-confidence — direction and account both need a human look
        model: 'claude-sonnet-4-6',
      }).select('id').single();

      if (insertErr) throw new Error(insertErr.message);
      results.push({ entity, draftId: inserted.id, amount: setoff.amount, shareCapitalAccountCode: shareCapitalAccountCode || '(needs admin input)' });
    } catch (err) {
      results.push({ entity, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, admin: admin.email, results });
}
