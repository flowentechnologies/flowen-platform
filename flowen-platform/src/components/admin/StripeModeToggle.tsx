'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { StripeMode } from '@/lib/stripe-mode';

export function StripeModeToggle({ initialMode }: { initialMode: StripeMode }) {
  const [mode, setMode]   = useState(initialMode);
  const [isPending, start] = useTransition();
  const router             = useRouter();

  async function toggle() {
    const next: StripeMode = mode === 'live' ? 'test' : 'live';

    // Optimistic update
    setMode(next);

    const res = await fetch('/api/admin/stripe-mode', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mode: next }),
    });

    if (!res.ok) {
      // Revert on failure
      setMode(mode);
      return;
    }

    // Refresh server data without a full page reload
    start(() => router.refresh());
  }

  const isLive = mode === 'live';

  return (
    <div className="flex items-center gap-3">
      {/* Mode badge */}
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border select-none ${
        isLive
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      }`}>
        STRIPE {isLive ? 'LIVE' : 'TEST'}
      </span>

      {/* Toggle switch */}
      <button
        onClick={toggle}
        disabled={isPending}
        title={`Switch to ${isLive ? 'test' : 'live'} mode`}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: isLive ? '#10b981' : '#d97706' }}
      >
        <span className="sr-only">Switch Stripe mode</span>
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            isLive ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>

      {isPending && (
        <span className="text-[10px] font-mono text-slate-500 animate-pulse">switching…</span>
      )}
    </div>
  );
}
