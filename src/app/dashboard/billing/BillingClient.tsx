'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { pixelPurchase } from '@/lib/pixel';
import posthog from 'posthog-js';

export interface BillingProps {
  hasSubscription: boolean;
  status: string | null;
  tierInterval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  tier: string | null;
  stripeCustomerId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function planName(tier: string | null): string {
  switch (tier) {
    case 'founding':         return 'Founding Member';
    case 'standard':         return 'Standard';
    case 'public_funds':     return 'Public Sector';
    case 'vocali_freemium':  return 'Free';
    default:                 return 'Free';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function intervalLabel(interval: string): string {
  switch (interval) {
    case 'monthly':    return 'Monthly';
    case 'quarterly':  return 'Quarterly';
    case 'six_months': return '6-Monthly';
    case 'yearly':
    case 'annual':     return 'Annual';
    default:           return interval.charAt(0).toUpperCase() + interval.slice(1);
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
        Active
      </span>
    );
  }
  if (status === 'trialing') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
        Trial
      </span>
    );
  }
  if (status === 'past_due') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
        Past due
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700">
      No subscription
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border-2 border-slate-600 border-t-white animate-spin"
      aria-hidden="true"
    />
  );
}

// ── Section A: Current Plan ───────────────────────────────────────────────────

function CurrentPlanCard({
  tier,
  status,
  tierInterval,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}: Pick<
  BillingProps,
  'tier' | 'status' | 'tierInterval' | 'currentPeriodEnd' | 'cancelAtPeriodEnd'
>) {
  const name = planName(tier);
  const renewsOrCancels = cancelAtPeriodEnd ? 'Cancels' : 'Renews';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
        Current Plan
      </p>

      <div className="flex flex-wrap items-start gap-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex-1 min-w-0">{name}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {tierInterval && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700">
              {intervalLabel(tierInterval)}
            </span>
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      {cancelAtPeriodEnd && currentPeriodEnd && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <svg
            className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-amber-300">
            Your subscription will cancel on{' '}
            <span className="font-semibold">{formatDate(currentPeriodEnd)}</span>. Reactivate
            in the billing portal below.
          </p>
        </div>
      )}

      {currentPeriodEnd && (
        <p className="text-sm text-slate-400">
          {renewsOrCancels}{' '}
          <span className="text-slate-600 dark:text-slate-300 font-medium">{formatDate(currentPeriodEnd)}</span>
        </p>
      )}
    </div>
  );
}

// ── Section B: Manage Billing ─────────────────────────────────────────────────

function ManageBillingCard({ hasSubscription, stripeCustomerId }: Pick<BillingProps, 'hasSubscription' | 'stripeCustomerId'>) {
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const openPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Failed to open billing portal. Please try again.');
        setLoading(false);
        return;
      }
      posthog.capture('billing_portal_opened');
      window.location.href = data.url;
    } catch {
      setError('Failed to open billing portal. Please try again.');
      setLoading(false);
    }
  };

  if (hasSubscription && stripeCustomerId) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
          Manage Billing
        </p>

        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Billing &amp; Payments</h2>
          <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
            Update your payment method, download invoices, or cancel your subscription via
            the Stripe billing portal.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={openPortal}
            disabled={loading}
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-white text-slate-950 text-sm font-bold hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <Spinner />
                Opening portal&hellip;
              </>
            ) : (
              'Open billing portal →'
            )}
          </button>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
        Manage Billing
      </p>

      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upgrade your plan</h2>
        <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
          You&apos;re currently on the free tier. Upgrade to unlock unlimited practice sessions
          and advanced analytics.
        </p>
      </div>

      <a
        href="/pricing"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold hover:bg-emerald-400 transition-colors"
      >
        View plans &rarr;
      </a>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function BillingClient({
  hasSubscription,
  status,
  tierInterval,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  tier,
  stripeCustomerId,
}: BillingProps) {
  const params = useSearchParams();
  const router = useRouter();
  const [trialBanner, setTrialBanner] = useState(false);

  useEffect(() => {
    if (params.get('success') === '1') {
      const isTrial = params.get('trial') === '1';

      // Meta Pixel — Purchase / Trial Start
      pixelPurchase({ value: 0, currency: 'GBP', content_ids: [tier ?? 'subscription'] });

      // Google Ads — Purchase conversion
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'conversion', {
          send_to: 'AW-18375319306/wyB9CP-pmt0cEIq-hLpE',
          currency: 'GBP',
        });
      }

      if (isTrial) setTrialBanner(true);
      router.replace('/dashboard/billing');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {trialBanner && (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-4">
          <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
          </svg>
          <div>
            <p className="text-sm font-bold text-emerald-300">Your 7-day free trial has started</p>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              You won&apos;t be charged until the trial ends. Cancel any time from this page.
            </p>
          </div>
          <button onClick={() => setTrialBanner(false)} className="ml-auto text-emerald-500 hover:text-emerald-300 shrink-0" aria-label="Dismiss">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
          </button>
        </div>
      )}
      <CurrentPlanCard
        tier={tier}
        status={status}
        tierInterval={tierInterval}
        currentPeriodEnd={currentPeriodEnd}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
      />
      <ManageBillingCard
        hasSubscription={hasSubscription}
        stripeCustomerId={stripeCustomerId}
      />
    </div>
  );
}
