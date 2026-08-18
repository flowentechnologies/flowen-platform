import { assertAdmin } from '@/lib/admin/guard';
import AffiliateClient from './AffiliateClient';
import type { AffiliateWithStats, AffiliatePayout } from '@/app/api/admin/affiliate/route';
import { adminDb } from '@/lib/supabase/admin';

export default async function AffiliatePage() {
  await assertAdmin();

  const db = adminDb();

  const [affiliatesRes, clicksRes, conversionsRes, commissionsRes, payoutsRes] = await Promise.all([
    db.from('affiliates').select('*').order('created_at', { ascending: false }),
    db.from('affiliate_clicks').select('affiliate_id'),
    db.from('affiliate_conversions').select('affiliate_id, amount_pence'),
    db.from('affiliate_commissions').select('affiliate_id, amount_pence, status'),
    db.from('affiliate_payouts').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  const affiliates  = affiliatesRes.data  ?? [];
  const clicks      = (clicksRes.data      ?? []) as { affiliate_id: string }[];
  const conversions = (conversionsRes.data ?? []) as { affiliate_id: string; amount_pence: number | null }[];
  const commissions = (commissionsRes.data ?? []) as { affiliate_id: string; amount_pence: number; status: string }[];
  const payouts     = (payoutsRes.data     ?? []) as AffiliatePayout[];

  const affiliatesWithStats: AffiliateWithStats[] = affiliates.map(a => {
    const myClicks      = clicks.filter(c => c.affiliate_id === a.id).length;
    const myConversions = conversions.filter(c => c.affiliate_id === a.id).length;
    const myComm        = commissions.filter(c => c.affiliate_id === a.id);
    return {
      ...a,
      click_count:        myClicks,
      conversion_count:   myConversions,
      total_earned_pence: myComm.reduce((s, c) => s + c.amount_pence, 0),
      total_paid_pence:   myComm.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount_pence, 0),
      pending_pence:      myComm.filter(c => c.status === 'pending' || c.status === 'approved').reduce((s, c) => s + c.amount_pence, 0),
    };
  });

  const summary = {
    total_affiliates:     affiliates.length,
    active_affiliates:    affiliates.filter(a => a.status === 'active').length,
    pending_affiliates:   affiliates.filter(a => a.status === 'pending').length,
    total_clicks:         clicks.length,
    total_conversions:    conversions.length,
    total_earned_pence:   commissions.reduce((s, c) => s + c.amount_pence, 0),
    total_paid_pence:     commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount_pence, 0),
    pending_payout_pence: commissions.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount_pence, 0),
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Affiliate Program</h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xl">
            Manage referral partners — SLTs, SEND schools, healthcare influencers — track conversions, commissions, and payouts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            REFERRALS
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            COMMISSIONS
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            PAYOUTS
          </span>
        </div>
      </div>

      <AffiliateClient
        initialAffiliates={affiliatesWithStats}
        initialPayouts={payouts}
        initialSummary={summary}
      />
    </div>
  );
}
