import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReferralTopReferrer {
  name:          string;
  code:          string;
  clicks:        number;
  signups:       number;
  subscriptions: number;
}

export interface ReferralStats {
  totalReferrers:    number;
  activeReferrers:   number; // has at least one click
  totalClicks:       number;
  totalSignups:      number;
  totalSubscriptions: number;
  clickToSignupPct:  number;
  signupToSubPct:    number;
  topReferrers:      ReferralTopReferrer[];
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();

  // All user referral affiliates (created when users visit /dashboard/refer)
  const { data: affiliates } = await client
    .from('affiliates')
    .select('id, name, code')
    .eq('channel', 'user_referral');

  const EMPTY: ReferralStats = {
    totalReferrers: 0, activeReferrers: 0, totalClicks: 0,
    totalSignups: 0, totalSubscriptions: 0,
    clickToSignupPct: 0, signupToSubPct: 0,
    topReferrers: [],
  };

  if (!affiliates?.length) return NextResponse.json(EMPTY);

  const affiliateIds = affiliates.map(a => a.id);

  // Fetch clicks + conversions in parallel
  const [clicksRes, conversionsRes] = await Promise.all([
    client
      .from('affiliate_clicks')
      .select('affiliate_id')
      .in('affiliate_id', affiliateIds),
    client
      .from('affiliate_conversions')
      .select('affiliate_id, event_type')
      .in('affiliate_id', affiliateIds),
  ]);

  const clicks      = clicksRes.data      ?? [];
  const conversions = conversionsRes.data ?? [];

  // Aggregate per affiliate
  type Agg = { clicks: number; signups: number; subscriptions: number };
  const byId = new Map<string, Agg>();
  for (const a of affiliates) byId.set(a.id, { clicks: 0, signups: 0, subscriptions: 0 });

  for (const c of clicks) {
    const e = byId.get(c.affiliate_id);
    if (e) e.clicks++;
  }
  for (const c of conversions) {
    const e = byId.get(c.affiliate_id);
    if (!e) continue;
    if (c.event_type === 'signup') e.signups++;
    if (c.event_type === 'subscription' || c.event_type === 'renewal') e.subscriptions++;
  }

  const totalClicks         = clicks.length;
  const totalSignups        = conversions.filter(c => c.event_type === 'signup').length;
  const totalSubscriptions  = conversions.filter(c =>
    c.event_type === 'subscription' || c.event_type === 'renewal'
  ).length;
  const activeReferrers     = [...byId.values()].filter(v => v.clicks > 0).length;

  const topReferrers: ReferralTopReferrer[] = affiliates
    .map(a => ({ name: a.name, code: a.code, ...byId.get(a.id)! }))
    .sort((a, b) => b.signups - a.signups || b.clicks - a.clicks)
    .slice(0, 5);

  const stats: ReferralStats = {
    totalReferrers:    affiliates.length,
    activeReferrers,
    totalClicks,
    totalSignups,
    totalSubscriptions,
    clickToSignupPct:  totalClicks   > 0 ? Math.round((totalSignups       / totalClicks)   * 100) : 0,
    signupToSubPct:    totalSignups  > 0 ? Math.round((totalSubscriptions  / totalSignups)  * 100) : 0,
    topReferrers,
  };

  return NextResponse.json(stats);
}
