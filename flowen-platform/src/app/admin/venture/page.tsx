import { assertAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { VentureClient } from './VentureClient';
import type { VentureData } from '@/app/api/admin/venture/route';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function fetchData(): Promise<VentureData> {
  const client       = db();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [
    investorsRes,
    configRes,
    totalUsersRes,
    newUsersRes,
    foundingRes,
    waitlistRes,
    onboardedRes,
  ] = await Promise.all([
    client.from('investors').select('*').order('created_at', { ascending: false }),
    client.from('venture_config').select('*').eq('id', 1).maybeSingle(),
    client.from('profiles').select('*', { count: 'exact', head: true }),
    client.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    client.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'founding'),
    client.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    client.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true),
  ]);

  // MRR from Stripe
  let mrrPence = 0;
  try {
    const active = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      expand: ['data.items.data.price'],
    });
    for (const sub of active.data) {
      const price = sub.items.data[0]?.price as {
        unit_amount: number | null;
        recurring: { interval: string; interval_count: number } | null;
      } | undefined;
      if (!price) continue;
      const amount   = price.unit_amount ?? 0;
      const interval = price.recurring?.interval ?? 'month';
      const cnt      = price.recurring?.interval_count ?? 1;
      mrrPence += interval === 'year' ? Math.round(amount / (cnt * 12)) : Math.round(amount / cnt);
    }
  } catch { /* stripe unavailable */ }

  const totalUsers   = totalUsersRes.count   ?? 0;
  const onboarded    = onboardedRes.count     ?? 0;
  const onboardedPct = totalUsers > 0 ? Math.round((onboarded / totalUsers) * 100) : 0;

  return {
    investors: investorsRes.error ? [] : (investorsRes.data ?? []),
    config:    configRes.error    ? null : (configRes.data ?? null),
    kpis: {
      totalUsers,
      newUsersWeek:  newUsersRes.count  ?? 0,
      foundingCount: foundingRes.count  ?? 0,
      waitlistTotal: waitlistRes.count  ?? 0,
      mrrPence,
      onboardedPct,
    },
  };
}

export default async function VenturePage() {
  await assertAdmin();
  const data = await fetchData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Venture Intelligence</h1>
        <p className="text-sm text-slate-500 font-mono mt-1">Round management, investor pipeline, and KPI board</p>
      </div>
      <VentureClient initialData={data} />
    </div>
  );
}
