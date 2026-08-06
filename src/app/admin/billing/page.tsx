import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { assertAdmin } from '@/lib/admin/guard';
import { StripeModeToggle } from '@/components/admin/StripeModeToggle';
import { SubscriptionActions } from './SubscriptionRow';
import { RefundButton } from './RefundButton';

// ── Formatters ────────────────────────────────────────────────────────────────

function formatCurrency(pence: number, currency = 'gbp') {
  return (pence / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  });
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusCls(status: string) {
  const map: Record<string, string> = {
    active:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    trialing:   'bg-sky-500/10 text-sky-400 border-sky-500/30',
    past_due:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
    canceled:   'bg-red-500/10 text-red-400 border-red-500/30',
    unpaid:     'bg-red-500/10 text-red-400 border-red-500/30',
    succeeded:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    failed:     'bg-red-500/10 text-red-400 border-red-500/30',
    refunded:   'bg-slate-700/50 text-slate-400 border-slate-600/30',
  };
  return map[status] ?? 'bg-slate-700/50 text-slate-400 border-slate-600/30';
}

// ── MRR calculation ───────────────────────────────────────────────────────────

function monthlyNormalisedPence(price: Stripe.Price): number {
  const amount = price.unit_amount ?? 0;
  const interval = price.recurring?.interval ?? 'month';
  const count = price.recurring?.interval_count ?? 1;
  if (interval === 'year')  return Math.round(amount / (count * 12));
  if (interval === 'month') return Math.round(amount / count);
  if (interval === 'week')  return Math.round((amount / count) * 52 / 12);
  if (interval === 'day')   return Math.round((amount / count) * 365 / 12);
  return amount;
}

function intervalLabel(price: Stripe.Price): string {
  const interval = price.recurring?.interval ?? 'month';
  const count = price.recurring?.interval_count ?? 1;
  if (count === 1) return `per ${interval}`;
  if (interval === 'month' && count === 3)  return 'per quarter';
  if (interval === 'month' && count === 6)  return 'per 6 months';
  if (interval === 'year'  && count === 1)  return 'per year';
  return `every ${count} ${interval}s`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface SubRow {
  id: string;
  customerEmail: string;
  customerName: string;
  status: string;
  amount: number;
  currency: string;
  interval: string;
  mrr: number;
  periodEnd: number;
  cancelAtPeriodEnd: boolean;
  created: number;
}

interface ChargeRow {
  id: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: string;
  refunded: boolean;
  created: number;
  description: string | null;
}

export default async function BillingPage() {
  await assertAdmin();

  let activeSubs: SubRow[]  = [];
  let pastDueSubs: SubRow[] = [];
  let recentCharges: ChargeRow[] = [];
  let recentRefunds: Stripe.Refund[] = [];
  let stripeError: string | null = null;

  const { client: stripe, mode } = await getStripeClient();
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  try {
    const [activeRes, pastDueRes, chargesRes, refundsRes] = await Promise.all([
      stripe.subscriptions.list({
        status: 'active',
        expand: ['data.customer', 'data.items.data.price'],
        limit: 100,
      }),
      stripe.subscriptions.list({
        status: 'past_due',
        expand: ['data.customer', 'data.items.data.price'],
        limit: 20,
      }),
      stripe.charges.list({ limit: 25, expand: ['data.customer'] }),
      stripe.refunds.list({ limit: 10 }),
    ]);

    function mapSubs(data: Stripe.Subscription[]): SubRow[] {
      return data.map(sub => {
        const cust = sub.customer as Stripe.Customer | null;
        const item = sub.items.data[0];
        const price = item?.price as Stripe.Price | undefined;
        return {
          id:                sub.id,
          customerEmail:     cust?.email ?? '—',
          customerName:      cust?.name  ?? '',
          status:            sub.status,
          amount:            price?.unit_amount ?? 0,
          currency:          price?.currency ?? 'gbp',
          interval:          price ? intervalLabel(price) : '—',
          mrr:               price ? monthlyNormalisedPence(price) : 0,
          periodEnd:         (sub.items.data[0]?.current_period_end ?? 0),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          created:           sub.created as number,
        };
      });
    }

    activeSubs  = mapSubs(activeRes.data);
    pastDueSubs = mapSubs(pastDueRes.data);

    recentCharges = chargesRes.data.map(ch => {
      const cust = ch.customer as Stripe.Customer | null;
      return {
        id:            ch.id,
        customerEmail: cust?.email ?? ch.billing_details?.email ?? '—',
        amount:        ch.amount,
        currency:      ch.currency,
        status:        ch.status,
        refunded:      ch.refunded,
        created:       ch.created as number,
        description:   ch.description,
      };
    });

    recentRefunds = refundsRes.data;
  } catch (err) {
    stripeError = err instanceof Error ? err.message : 'Stripe API error';
  }

  const mrrPence = activeSubs.reduce((s, sub) => s + sub.mrr, 0);
  const arrPence = mrrPence * 12;

  const monthCharges = recentCharges.filter(c => c.created >= monthStart && c.status === 'succeeded');
  const monthRevenuePence = monthCharges.reduce((s, c) => s + c.amount, 0);

  const monthRefunds = recentRefunds.filter(r => (r.created as number) >= monthStart);
  const refundPence  = monthRefunds.reduce((s, r) => s + r.amount, 0);

  // Cycle breakdown
  const cycleMap: Record<string, number> = {};
  for (const sub of activeSubs) {
    cycleMap[sub.interval] = (cycleMap[sub.interval] ?? 0) + 1;
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Billing</h1>
          <p className="text-slate-400 text-sm mt-1">Revenue, subscriptions, payments, refunds</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {stripeError && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border bg-red-500/10 text-red-400 border-red-500/30">
              ERROR
            </span>
          )}
          <StripeModeToggle initialMode={mode} />
        </div>
      </div>

      {stripeError && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl px-6 py-4 text-sm text-red-400 font-mono">
          {stripeError}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'MRR',                value: formatCurrency(mrrPence),         sub: 'Monthly recurring',       color: 'text-emerald-400' },
          { label: 'ARR',                value: formatCurrency(arrPence),          sub: 'Annual run rate',         color: 'text-emerald-300' },
          { label: 'Active Subscribers', value: activeSubs.length.toString(),      sub: `${pastDueSubs.length} past due`, color: 'text-white' },
          { label: 'This Month Revenue', value: formatCurrency(monthRevenuePence), sub: `${formatCurrency(refundPence)} refunded`, color: 'text-sky-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">{kpi.label}</p>
            <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Cycle breakdown */}
      {Object.keys(cycleMap).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-4">Billing Cycle Breakdown</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(cycleMap).map(([cycle, count]) => (
              <div key={cycle} className="flex items-center gap-2 bg-slate-800 rounded-xl px-4 py-2.5">
                <span className="text-slate-400 text-xs font-mono">{cycle}</span>
                <span className="text-white font-bold text-sm">{count}</span>
                <span className="text-slate-500 text-[10px]">
                  ({((count / activeSubs.length) * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active subscriptions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Active Subscriptions</h2>
          <span className="text-xs font-mono text-slate-500">{activeSubs.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 border-b border-slate-800">
              <tr>
                {['Customer', 'Plan', 'MRR', 'Status', 'Renews', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {activeSubs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">No active subscriptions</td></tr>
              ) : activeSubs.map(sub => (
                <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs text-white font-medium">{sub.customerEmail}</p>
                    {sub.customerName && <p className="text-[10px] text-slate-500 font-mono">{sub.customerName}</p>}
                    {sub.cancelAtPeriodEnd && (
                      <span className="text-[10px] text-amber-400 font-mono">cancelling</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-300 font-mono whitespace-nowrap">{formatCurrency(sub.amount, sub.currency)}</p>
                    <p className="text-[10px] text-slate-500">{sub.interval}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-emerald-400 whitespace-nowrap">
                    {formatCurrency(sub.mrr, sub.currency)}/mo
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${statusCls(sub.status)}`}>
                      {sub.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                    {formatDate(sub.periodEnd)}
                  </td>
                  <td className="px-4 py-3">
                    <SubscriptionActions
                      subscriptionId={sub.id}
                      cancelAtPeriodEnd={sub.cancelAtPeriodEnd}
                      onCancelled={() => {}}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Past due / dunning */}
      {pastDueSubs.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/20 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-white">Past Due — Dunning</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {pastDueSubs.length} AT RISK
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>
                  {['Customer', 'Plan', 'MRR', 'Renewal', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pastDueSubs.map(sub => (
                  <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs text-white font-medium">{sub.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300 font-mono whitespace-nowrap">
                      {formatCurrency(sub.amount, sub.currency)} {sub.interval}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-amber-400 whitespace-nowrap">
                      {formatCurrency(sub.mrr, sub.currency)}/mo
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {formatDate(sub.periodEnd)}
                    </td>
                    <td className="px-4 py-3">
                      <SubscriptionActions
                        subscriptionId={sub.id}
                        cancelAtPeriodEnd={sub.cancelAtPeriodEnd}
                        onCancelled={() => {}}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent payments */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white">Recent Payments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 border-b border-slate-800">
              <tr>
                {['Customer', 'Amount', 'Status', 'Date', 'Charge ID', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentCharges.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">No payment history</td></tr>
              ) : recentCharges.map(ch => (
                <tr key={ch.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-white font-medium">{ch.customerEmail}</td>
                  <td className="px-4 py-3 text-xs font-mono text-white whitespace-nowrap">
                    {formatCurrency(ch.amount, ch.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${statusCls(ch.refunded ? 'refunded' : ch.status)}`}>
                      {ch.refunded ? 'refunded' : ch.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                    {formatDate(ch.created)}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-slate-600 font-mono">{ch.id}</td>
                  <td className="px-4 py-3">
                    {!ch.refunded && ch.status === 'succeeded' && (
                      <RefundButton
                        chargeId={ch.id}
                        maxAmount={ch.amount}
                        currency={ch.currency}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent refunds */}
      {recentRefunds.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white">Recent Refunds</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>
                  {['Refund ID', 'Amount', 'Status', 'Reason', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentRefunds.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-[10px] text-slate-500 font-mono">{r.id}</td>
                    <td className="px-4 py-3 text-xs font-mono text-white whitespace-nowrap">
                      {formatCurrency(r.amount, r.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${statusCls(r.status ?? 'succeeded')}`}>
                        {r.status ?? 'succeeded'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.reason ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {formatDate(r.created as number)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
