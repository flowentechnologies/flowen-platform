'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { pixelInitiateCheckout, pixelViewContent } from '@/lib/pixel';
import { createClient } from '@/lib/supabase/client';

// Monthly and yearly are the two primary options; quarterly/6-month are kept in
// the billingDetails map for the Stripe checkout but not surfaced as primary choices
// — they confused users and buried the price anchor.
type BillingCycle = 'monthly' | 'quarterly' | 'six_months' | 'yearly';

export default function PricingSection() {
  const [cycle, setCycle] = useState<BillingCycle>('yearly');

  const billingDetails = {
    monthly: { discountBadge: '10% OFF', monthlyEquivalent: 35.96, billingPeriodText: 'billed monthly', totalText: '£35.96 per month' },
    quarterly: { discountBadge: '25% OFF', monthlyEquivalent: 29.97, billingPeriodText: 'billed quarterly', totalText: '£89.91 billed every 3 months' },
    six_months: { discountBadge: '40% OFF', monthlyEquivalent: 23.97, billingPeriodText: 'billed every 6 months', totalText: '£143.82 billed every 6 months' },
    yearly: { discountBadge: '50% DISCOUNT', monthlyEquivalent: 19.96, billingPeriodText: 'billed annually', totalText: '£239.52 billed annually' },
  };

  const currentFounding = billingDetails[cycle];
  const router = useRouter();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);

  // 'loading' | 'unauthenticated' | 'standard' | 'founding'
  const [userTier, setUserTier] = useState<string>('loading');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setUserTier('unauthenticated'); return; }
      const { data } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();
      setUserTier(data?.tier ?? 'standard');
    });
  }, []);

  const handleFoundingSeat = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    pixelInitiateCheckout({
      content_ids: ['founding_member'],
      num_items: 1,
      value: currentFounding.monthlyEquivalent,
      currency: 'GBP',
    });
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: cycle }),
      });

      // Unauthenticated — send to login and come back
      if (res.status === 401) {
        router.push('/auth/login?next=/pricing');
        return;
      }

      const body = await res.json() as { url?: string; error?: string };

      if (!res.ok || !body.url) {
        setCheckoutError(body.error ?? 'Checkout failed — please try again.');
        setCheckoutLoading(false);
        return;
      }

      window.location.href = body.url;
    } catch {
      setCheckoutError('Could not connect to checkout. Please try again.');
      setCheckoutLoading(false);
    }
  };

  // ViewContent fires once when pricing section mounts
  React.useEffect(() => {
    pixelViewContent({ content_name: 'pricing', content_category: 'founding_member', currency: 'GBP' });
  }, []);

  return (
    <section className="py-16 px-4 max-w-7xl mx-auto text-slate-100">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
          Flexible Deployment & Early Access
        </h2>

        {/* Billing toggle — Monthly vs Yearly */}
        <div className="inline-flex items-center bg-slate-900 border border-slate-800 p-1 rounded-2xl shadow-xl gap-1">
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              cycle === 'monthly'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Monthly
            <span className="ml-1.5 text-[11px] text-slate-500 font-normal">£35.96</span>
          </button>
          <button
            type="button"
            onClick={() => setCycle('yearly')}
            className={`relative px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              cycle === 'yearly'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Annual
            <span className={`ml-1.5 text-[11px] font-normal ${cycle === 'yearly' ? 'text-slate-950/70' : 'text-slate-500'}`}>£19.96/mo</span>
            <span className={`absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide ${
              cycle === 'yearly'
                ? 'bg-slate-950 text-emerald-400'
                : 'bg-emerald-500 text-slate-950'
            }`}>
              SAVE 44%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between">
          <div>
            <div className="inline-block px-3 py-1 bg-slate-800 text-slate-300 text-xs font-semibold tracking-wider uppercase rounded-full mb-4">
              Open Account
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Waitlist Standard</h3>
            <div className="flex items-baseline gap-1 my-4">
              <span className="text-4xl font-extrabold text-white">£0</span>
            </div>
            <p className="text-slate-400 text-sm mb-6">Baseline early access allocation without ongoing subscription commitments.</p>
          </div>
          <button
            onClick={() => router.push('/waitlist')}
            className="w-full py-3.5 px-6 rounded-xl bg-slate-800 text-white font-semibold border border-slate-700 text-sm hover:bg-slate-700 transition-colors"
          >
            Join free waitlist
          </button>
        </div>

        <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/30 border-2 border-emerald-500/80 rounded-3xl p-8 flex flex-col justify-between relative scale-105 z-10">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 text-xs font-extrabold tracking-wider uppercase px-4 py-1 rounded-full whitespace-nowrap">
            {currentFounding.discountBadge} · FOUNDING COHORT
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mt-2 mb-1">Founding Member</h3>
            {/* Scarcity indicator */}
            <p className="text-xs text-emerald-400/80 font-medium mb-3">Early cohort · Price locked for life when you join</p>
            <div className="my-3">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">£{currentFounding.monthlyEquivalent.toFixed(2)}</span>
                <span className="text-slate-400 text-sm">/mo</span>
                {cycle === 'yearly' && (
                  <span className="ml-2 text-xs line-through text-slate-600">£35.96</span>
                )}
              </div>
              <div className="text-xs text-emerald-400 font-medium mt-1">{currentFounding.billingPeriodText}</div>
            </div>
            {/* Feature list */}
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span>Sub-80ms real-time speech biofeedback</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span>3D avatar & viseme alignment</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span>Personal fluency progress metrics</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span>NHS & Access to Work eligible</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span>Price locked — yours for life at this rate</li>
            </ul>
          </div>
          {userTier === 'founding' ? (
            <>
              <div className="w-full py-3.5 px-6 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-sm text-center mt-6">
                ✓ Current plan
              </div>
              <button
                onClick={() => router.push('/dashboard/billing')}
                className="w-full mt-2 py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors border border-slate-700"
              >
                Manage subscription →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleFoundingSeat}
                disabled={checkoutLoading || userTier === 'loading'}
                className="w-full mt-6 py-4 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all hover:scale-[1.02] active:scale-100 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {checkoutLoading ? 'Redirecting to checkout…' : '🚀 Start 7-day free trial →'}
              </button>
              <p className="text-center text-xs text-slate-500 mt-2">
                No charge today · {currentFounding.totalText} after trial · Cancel any time
              </p>
            </>
          )}
          {checkoutError && (
            <p className="mt-2 text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2 text-center">
              {checkoutError}
            </p>
          )}
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between">
          <div>
            <div className="inline-block px-3 py-1 bg-sky-950 text-sky-400 text-xs font-semibold tracking-wider uppercase rounded-full mb-4">
              Pledge Allocation
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Sponsored Entry</h3>
            <div className="my-4">
              <span className="text-4xl font-extrabold text-white">£0</span>
              <span className="text-slate-400 text-xs font-medium"> via institution</span>
            </div>
          </div>
          <a
            href="mailto:hello@flowen.digital?subject=Sponsored%20Entry%20Eligibility"
            className="block w-full py-3.5 px-6 rounded-xl bg-slate-800 text-sky-300 font-semibold border border-slate-700 text-sm text-center hover:bg-slate-700 transition-colors"
          >
            Verify Eligibility
          </a>
        </div>
      </div>
    </section>
  );
}
