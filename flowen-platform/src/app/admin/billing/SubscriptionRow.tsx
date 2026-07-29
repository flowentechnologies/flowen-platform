'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Props {
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
  onCancelled: (subId: string) => void;
}

export function SubscriptionActions({ subscriptionId, cancelAtPeriodEnd, onCancelled }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [markedCancelled, setMarkedCancelled] = useState(cancelAtPeriodEnd);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function post(action: string) {
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch('/api/admin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, subscriptionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      if (action === 'cancel_subscription') {
        setMarkedCancelled(true);
        setToast('Set to cancel at period end');
      } else {
        onCancelled(subscriptionId);
        setToast('Subscription cancelled immediately');
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div className="relative" ref={ref}>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border bg-slate-900 border-slate-700 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={loading || markedCancelled}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? '…' : markedCancelled ? 'Cancelling' : 'Actions'}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
          <button
            type="button"
            onClick={() => post('cancel_subscription')}
            className="w-full text-left px-4 py-2.5 text-xs text-amber-300 hover:bg-slate-800 transition-colors"
          >
            Cancel at period end
          </button>
          <button
            type="button"
            onClick={() => post('cancel_immediately')}
            className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-slate-800 transition-colors border-t border-slate-800"
          >
            Cancel immediately
          </button>
        </div>
      )}
    </div>
  );
}
