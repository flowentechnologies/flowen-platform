'use client';

import { useState, useEffect } from 'react';

interface Invoice {
  id: string;
  vendor_name: string;
  amount_pence: number | null;
  currency: string;
  invoice_date: string | null;
  description: string | null;
  created_at: string;
  inbox_items: { subject: string; from_address: string; received_at: string } | null;
}

function formatAmount(pence: number | null, currency: string): string {
  if (pence == null) return '—';
  return (pence / 100).toLocaleString('en-GB', { style: 'currency', currency: currency.toUpperCase() });
}

export function VendorInvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totalPence, setTotalPence] = useState(0);
  const [byVendor, setByVendor] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/vendor-invoices')
      .then(res => res.json())
      .then((data: { invoices: Invoice[]; total_pence: number; by_vendor: Record<string, number> }) => {
        setInvoices(data.invoices);
        setTotalPence(data.total_pence);
        setByVendor(data.by_vendor);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vendor Invoices</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Billing from vendors and service providers, extracted automatically from synced email (Vercel, Supabase, Stripe, Anthropic, etc.).
          Separate from <a href="/admin/billing" className="underline">Billing</a>, which is Flowen&apos;s own customer subscription revenue.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-2xl font-black text-slate-900 dark:text-white">{formatAmount(totalPence, 'gbp')}</p>
              <p className="text-xs text-slate-400 mt-1">Total tracked spend</p>
            </div>
            {Object.entries(byVendor).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([vendor, pence]) => (
              <div key={vendor} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{formatAmount(pence, 'gbp')}</p>
                <p className="text-xs text-slate-400 mt-1">{vendor}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {invoices.length === 0 && <p className="text-sm text-slate-400">No vendor invoices synced yet.</p>}
            {invoices.map(inv => (
              <div key={inv.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{inv.vendor_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{inv.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{formatAmount(inv.amount_pence, inv.currency)}</p>
                  <p className="text-[10px] text-slate-400">{new Date(inv.created_at).toLocaleDateString('en-GB')}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
