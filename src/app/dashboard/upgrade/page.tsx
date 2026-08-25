'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Cycle = 'monthly' | 'yearly';

const PLANS: Record<Cycle, { monthly: number; billing: string; total: string; discount: string }> = {
  monthly: { monthly: 35.96, billing: 'billed monthly',   total: '£35.96/mo',           discount: '' },
  yearly:  { monthly: 19.96, billing: 'billed annually',  total: '£239.52/year',         discount: 'Save 44%' },
};

const FEATURES = [
  'Unlimited practice sessions',
  'AI speech coach feedback after every session',
  'Full 5-stage guided fluency programme',
  'Fluency analytics — disfluency trends & charts',
  'Downloadable progress reports',
  'SLP-assigned treatment plans & secure messaging',
  'Session recordings for clinician review',
  'Priority email support',
];

const TRUST = [
  { icon: '🛡️', text: 'DCB0129 NHS Clinical Safety certified' },
  { icon: '🔒', text: 'UK GDPR compliant — data stays in the EU' },
  { icon: '↩️', text: 'Cancel any time — no lock-in' },
];

export default function UpgradePage() {
  const router = useRouter();
  const [cycle, setCycle]       = useState<Cycle>('yearly');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const plan = PLANS[cycle];

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ interval: cycle }),
      });
      if (res.status === 401) { router.push('/auth/login?next=/dashboard/upgrade'); return; }
      const body = await res.json() as { url?: string; error?: string };
      if (!res.ok || !body.url) { setError(body.error ?? 'Checkout failed — please try again.'); return; }
      window.location.href = body.url;
    } catch {
      setError('Could not reach checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-10">

      {/* Header */}
      <div className="space-y-2">
        <p className="text-xs font-mono uppercase tracking-widest text-emerald-400">Upgrade</p>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Unlock unlimited access
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
          Start a 7-day free trial today — no charge until day 8, cancel any time.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="inline-flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl gap-1">
        {(['monthly', 'yearly'] as Cycle[]).map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCycle(c)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              cycle === c
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {c === 'monthly' ? 'Monthly' : 'Annual'}
            {c === 'yearly' && (
              <span className="ml-1.5 text-[10px] font-bold text-emerald-500">BEST VALUE</span>
            )}
          </button>
        ))}
      </div>

      {/* Plan card */}
      <div className="bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-2xl overflow-hidden shadow-sm shadow-emerald-500/10">
        {/* Price bar */}
        <div className="bg-emerald-500/5 border-b border-emerald-500/20 px-8 py-6 flex items-end gap-3">
          <span className="text-5xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            £{plan.monthly.toFixed(2)}
          </span>
          <div className="pb-1.5">
            <p className="text-sm text-slate-500 dark:text-slate-400">/month</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{plan.billing}</p>
          </div>
          {plan.discount && (
            <span className="ml-auto pb-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              {plan.discount}
            </span>
          )}
        </div>

        {/* Features */}
        <ul className="px-8 py-6 space-y-3">
          {FEATURES.map(f => (
            <li key={f} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="px-8 pb-8 space-y-3">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold text-sm transition-all shadow-md shadow-emerald-500/20"
          >
            {loading ? 'Redirecting to checkout…' : 'Start 7-day free trial →'}
          </button>
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            {plan.total} after trial &nbsp;·&nbsp; Cancel before day 8 to pay nothing
          </p>
        </div>
      </div>

      {/* Trust signals */}
      <div className="grid sm:grid-cols-3 gap-3">
        {TRUST.map(t => (
          <div key={t.text} className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{t.icon}</span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* Testimonial */}
      <blockquote className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-5 space-y-2">
        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed italic">
          &ldquo;After 8 weeks with Flowen I went from dreading calls to leading them. The AI feedback after each session is genuinely useful — not generic.&rdquo;
        </p>
        <footer className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <span className="text-emerald-500 text-[11px] font-bold">JR</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">James R.</p>
            <p className="text-[11px] text-slate-400">Flowen member · 14-day streak</p>
          </div>
          <div className="ml-auto flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-3 h-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
            ))}
          </div>
        </footer>
      </blockquote>

      {/* Back link */}
      <div className="text-center">
        <Link href="/dashboard" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          ← Back to dashboard
        </Link>
      </div>

    </div>
  );
}
