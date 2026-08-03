'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

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

  const handleFoundingSeat = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: cycle }),
      });
      const { url, error } = await res.json();
      if (error || !url) { setCheckoutLoading(false); return; }
      window.location.href = url;
    } catch {
      setCheckoutLoading(false);
    }
  };

  return (
    <section className="py-16 px-4 max-w-7xl mx-auto text-slate-100">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
          Flexible Deployment & Early Access
        </h2>
        <div className="inline-flex items-center gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-2xl shadow-xl">
          <label htmlFor="billing-cycle-select" className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-2">
            Billing Interval:
          </label>
          <select
            id="billing-cycle-select"
            value={cycle}
            onChange={(e) => setCycle(e.target.value as BillingCycle)}
            className="bg-slate-800 text-white font-medium text-sm rounded-xl px-4 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="monthly">Monthly (£35.96/mo • 10% off)</option>
            <option value="quarterly">Quarterly (£29.97/mo • 25% off)</option>
            <option value="six_months">6 Months (£23.97/mo • 40% off)</option>
            <option value="yearly">Yearly (£19.96/mo • 50% off)</option>
          </select>
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
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 text-xs font-extrabold tracking-wider uppercase px-4 py-1 rounded-full">
            {currentFounding.discountBadge} INFRASTRUCTURE SLOT
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mt-2 mb-2">Founding Member</h3>
            <div className="my-4">
              <span className="text-4xl font-extrabold text-white">£{currentFounding.monthlyEquivalent.toFixed(2)}</span>
              <span className="text-slate-400 text-sm">/mo</span>
              <div className="text-xs text-emerald-400 font-medium mt-1">{currentFounding.billingPeriodText}</div>
            </div>
          </div>
          <button
            onClick={handleFoundingSeat}
            disabled={checkoutLoading}
            className="w-full py-3.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkoutLoading ? 'Redirecting…' : 'Secure Founding Seat'}
          </button>
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
