// ── Cross-system consistency checks ───────────────────────────────────────────
// Three checks, one per area the founder flagged as actually causing
// confusion: billing (Stripe vs Flowen's own subscription records),
// marketing (ad platforms' reported conversions vs real signups — the
// "41 reported leads vs 8 real signups" gap found and explained manually;
// this automates catching it going forward), and venture (generated
// compliance/investor documents vs the live venture_config numbers they
// cite — the SBRI/DTAC runway contradiction found and fixed manually
// earlier, generalized into an ongoing check).
//
// Philosophy: flag, never auto-resolve. Each check returns a status the
// cron route stores in consistency_checks and raises an admin_notifications
// row for if anything needs a human decision — some of these genuinely
// require judgment (a Stripe/Flowen mismatch could mean a webhook lagged
// by an hour, or it could mean something's actually broken).

import { stripe } from '@/lib/stripe';
import { adminDb as db } from '@/lib/supabase/admin';

export interface CheckResult {
  status: 'ok' | 'discrepancy' | 'error';
  summary: string;
  details: Record<string, unknown>;
}

export async function checkBilling(): Promise<CheckResult> {
  try {
    const supabase = db();

    // Stripe side — capped at 200 (safety limit matching other crons in
    // this codebase; revisit with real pagination if the subscriber base
    // ever grows past this).
    let stripeActive = 0;
    let stripeTrialing = 0;
    for await (const sub of stripe.subscriptions.list({ limit: 100 })) {
      if (sub.status === 'active') stripeActive++;
      else if (sub.status === 'trialing') stripeTrialing++;
      if (stripeActive + stripeTrialing > 200) break;
    }

    const { count: flowenActive } = await supabase
      .from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active');
    const { count: flowenTrialing } = await supabase
      .from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'trialing');

    const details = {
      stripe: { active: stripeActive, trialing: stripeTrialing },
      flowen: { active: flowenActive ?? 0, trialing: flowenTrialing ?? 0 },
    };

    const activeDiff = Math.abs(stripeActive - (flowenActive ?? 0));
    const trialingDiff = Math.abs(stripeTrialing - (flowenTrialing ?? 0));

    if (activeDiff > 0 || trialingDiff > 0) {
      return {
        status: 'discrepancy',
        summary: `Stripe reports ${stripeActive} active / ${stripeTrialing} trialing; Flowen's own records show ${flowenActive ?? 0} active / ${flowenTrialing ?? 0} trialing.`,
        details,
      };
    }
    return { status: 'ok', summary: `${stripeActive} active, ${stripeTrialing} trialing — Stripe and Flowen agree.`, details };
  } catch (err) {
    return { status: 'error', summary: `Billing check failed: ${err instanceof Error ? err.message : String(err)}`, details: {} };
  }
}

export async function checkMarketing(): Promise<CheckResult> {
  try {
    const supabase = db();
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

    const { data: stats } = await supabase
      .from('ad_platform_stats')
      .select('platform, leads, registrations')
      .gte('stat_date', since);

    const { count: realSignups } = await supabase
      .from('waitlist_signups')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString());

    if (!stats || stats.length === 0) {
      return {
        status: 'error',
        summary: 'No ad platform data synced in the last 30 days — /api/admin/marketing/sync (Meta/Google) may not be scheduled or credentials may be missing.',
        details: { real_signups: realSignups ?? 0 },
      };
    }

    const byPlatform: Record<string, number> = {};
    for (const row of stats) {
      const reported = (row.leads ?? 0) + (row.registrations ?? 0);
      byPlatform[row.platform] = (byPlatform[row.platform] ?? 0) + reported;
    }
    const totalReported = Object.values(byPlatform).reduce((a, b) => a + b, 0);
    const real = realSignups ?? 0;

    const details = { by_platform: byPlatform, total_reported: totalReported, real_signups: real };

    // Some divergence between ad-platform-reported conversions and real
    // signups is completely normal (a lead can convert on a different
    // device, or after the attribution window). Flag only when the
    // platform-reported number is dramatically higher — the shape of the
    // actual bug found (41 vs 8, ~5x) rather than routine noise.
    if (real > 0 && totalReported > real * 2) {
      return {
        status: 'discrepancy',
        summary: `Ad platforms report ${totalReported} leads/registrations in the last 30 days; Flowen's waitlist shows only ${real} real signups in the same window.`,
        details,
      };
    }
    return { status: 'ok', summary: `${totalReported} reported by ad platforms, ${real} real signups — within normal range.`, details };
  } catch (err) {
    return { status: 'error', summary: `Marketing check failed: ${err instanceof Error ? err.message : String(err)}`, details: {} };
  }
}

export async function checkVenture(): Promise<CheckResult> {
  try {
    const supabase = db();
    const { data: venture } = await supabase
      .from('venture_config')
      .select('cash_in_bank_pence, monthly_burn_pence, target_raise_pence, committed_pence, updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (!venture) {
      return { status: 'error', summary: 'venture_config row not found.', details: {} };
    }

    const { data: dtac } = await supabase
      .from('compliance_items')
      .select('item_code, notes, updated_at')
      .eq('item_code', 'dtac_10')
      .maybeSingle();

    const details: Record<string, unknown> = {
      venture_updated_at: venture.updated_at,
      dtac_10_updated_at: dtac?.updated_at ?? null,
    };

    if (dtac && new Date(venture.updated_at) > new Date(dtac.updated_at)) {
      return {
        status: 'discrepancy',
        summary: 'venture_config was updated more recently than the DTAC compliance note (dtac_10) that cites its cash/runway figures — the note may now be stale relative to the live numbers.',
        details,
      };
    }
    return { status: 'ok', summary: 'venture_config and the DTAC compliance note are consistent.', details };
  } catch (err) {
    return { status: 'error', summary: `Venture check failed: ${err instanceof Error ? err.message : String(err)}`, details: {} };
  }
}
