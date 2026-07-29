'use client';

import React, { useState } from 'react';

interface Props {
  chargeId: string;
  maxAmount: number; // in pence
  currency: string;
}

export function RefundButton({ chargeId, maxAmount, currency }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbol = currency === 'gbp' ? '£' : currency === 'usd' ? '$' : currency.toUpperCase() + ' ';

  async function submit() {
    setLoading(true);
    setError(null);
    const pence = amount ? Math.round(parseFloat(amount) * 100) : undefined;
    if (pence !== undefined && (isNaN(pence) || pence <= 0 || pence > maxAmount)) {
      setError('Invalid amount');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/admin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'issue_refund', chargeId, amount: pence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setDone(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  if (done) return <span className="text-xs text-emerald-400 font-mono">Refunded</span>;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
      >
        Refund
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-10 p-4 space-y-3">
          <p className="text-xs text-slate-400">
            Partial or full refund (max {symbol}{(maxAmount / 100).toFixed(2)})
          </p>
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder={`${symbol}${(maxAmount / 100).toFixed(2)} (full)`}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
          />
          {error && <p className="text-[10px] text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="flex-1 py-1.5 text-xs font-medium bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); setAmount(''); }}
              className="flex-1 py-1.5 text-xs font-medium border border-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
