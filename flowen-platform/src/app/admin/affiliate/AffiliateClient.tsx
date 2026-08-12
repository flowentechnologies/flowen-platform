'use client';

import React, { useState, useMemo, useTransition } from 'react';
import type {
  AffiliateWithStats, AffiliatePayout, AffiliateTier, AffiliateStatus, ConversionEvent,
} from '@/app/api/admin/affiliate/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(pence: number, compact = false): string {
  const p = pence / 100;
  if (compact) {
    if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(1)}m`;
    if (p >= 1_000)     return `£${(p / 1_000).toFixed(1)}k`;
    return `£${p.toFixed(0)}`;
  }
  if (p >= 1_000) return `£${p.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `£${p.toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function api(payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/affiliate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<AffiliateTier, { label: string; badge: string; commission: number; months: number }> = {
  standard: { label: 'Standard',  badge: 'bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-600',            commission: 7.5, months: 3  },
  premium:  { label: 'Premium',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',       commission: 10,  months: 6  },
  partner:  { label: 'Partner',   badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',    commission: 15,  months: 12 },
};

const STATUS_CONFIG: Record<AffiliateStatus, { label: string; dot: string; badge: string }> = {
  pending:   { label: 'Pending',   dot: 'bg-amber-500',  badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30'    },
  active:    { label: 'Active',    dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  suspended: { label: 'Suspended', dot: 'bg-orange-500', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30'  },
  rejected:  { label: 'Rejected',  dot: 'bg-red-500',    badge: 'bg-red-500/10 text-red-400 border-red-500/30'           },
};

const CHANNELS = ['SLT community', 'SEND school', 'NHS referral', 'social', 'podcast', 'email list', 'other'];

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, kind }: { msg: string; kind: 'ok' | 'err' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-mono shadow-xl border ${
      kind === 'ok' ? 'bg-emerald-950 border-emerald-800 text-emerald-300' : 'bg-red-950 border-red-800 text-red-300'
    }`}>{msg}</div>
  );
}

// ── Summary hero ──────────────────────────────────────────────────────────────

interface Summary {
  total_affiliates:     number;
  active_affiliates:    number;
  pending_affiliates:   number;
  total_clicks:         number;
  total_conversions:    number;
  total_earned_pence:   number;
  total_paid_pence:     number;
  pending_payout_pence: number;
}

function SummaryHero({ summary }: { summary: Summary }) {
  const convRate = summary.total_clicks > 0
    ? ((summary.total_conversions / summary.total_clicks) * 100).toFixed(1)
    : '—';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'Active Affiliates',  value: String(summary.active_affiliates),    sub: `${summary.pending_affiliates} pending`,              accent: 'text-emerald-400' },
        { label: 'Total Conversions',  value: String(summary.total_conversions),    sub: `${summary.total_clicks} clicks · ${convRate}% CVR`,  accent: 'text-sky-400'     },
        { label: 'Total Earned',       value: fmtGBP(summary.total_earned_pence, true), sub: `${fmtGBP(summary.total_paid_pence, true)} paid out`, accent: 'text-amber-400' },
        { label: 'Pending Payout',     value: fmtGBP(summary.pending_payout_pence, true), sub: 'approved, awaiting payment',                   accent: 'text-purple-400' },
      ].map(s => (
        <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1.5">{s.label}</p>
          <p className={`text-3xl font-black tabular-nums ${s.accent}`}>{s.value}</p>
          <p className="text-[11px] text-slate-600 font-mono mt-1">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Affiliate form ────────────────────────────────────────────────────────────

interface AffForm {
  name: string; email: string; code: string; tier: AffiliateTier; status: AffiliateStatus;
  commission_pct: string; recurring_months: string; channel: string; website: string; notes: string;
}

const BLANK_AFF: AffForm = {
  name: '', email: '', code: '', tier: 'standard', status: 'pending',
  commission_pct: '7.5', recurring_months: '3', channel: '', website: '', notes: '',
};

function affiliateToForm(a: AffiliateWithStats): AffForm {
  return {
    name: a.name, email: a.email, code: a.code, tier: a.tier, status: a.status,
    commission_pct: String(a.commission_pct), recurring_months: String(a.recurring_months),
    channel: a.channel ?? '', website: a.website ?? '', notes: a.notes ?? '',
  };
}

const inputCls = 'w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-colors';
const labelCls = 'block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1.5';

function AffiliateModal({
  initial, onSave, onClose,
}: { initial?: AffiliateWithStats; onSave: (a: AffiliateWithStats) => void; onClose: () => void }) {
  const [form, setForm] = useState<AffForm>(initial ? affiliateToForm(initial) : { ...BLANK_AFF });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof AffForm) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill tier defaults
  function applyTier(tier: AffiliateTier) {
    const t = TIER_CONFIG[tier];
    setForm(f => ({ ...f, tier, commission_pct: String(t.commission), recurring_months: String(t.months) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setErr('Name and email required'); return; }
    setSaving(true); setErr('');
    const payload = {
      action: initial ? 'update_affiliate' : 'add_affiliate',
      ...(initial ? { id: initial.id } : {}),
      name: form.name.trim(), email: form.email.trim(),
      code: form.code.trim() || undefined,
      tier: form.tier, status: form.status,
      commission_pct: parseFloat(form.commission_pct) || 20,
      recurring_months: parseInt(form.recurring_months, 10) || 3,
      channel: form.channel || null,
      website: form.website || null,
      notes: form.notes || null,
    };
    const res = await api(payload);
    setSaving(false);
    if (res.error) { setErr(res.error as string); return; }
    onSave(res.affiliate as AffiliateWithStats);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur-md">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{initial ? 'Edit Affiliate' : 'Add Affiliate'}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 px-6 py-5 space-y-4">
          {/* Tier quick-select */}
          <div>
            <p className={labelCls}>Tier</p>
            <div className="flex gap-2">
              {(['standard','premium','partner'] as AffiliateTier[]).map(t => (
                <button key={t} type="button" onClick={() => applyTier(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    form.tier === t ? TIER_CONFIG[t].badge : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}>
                  {TIER_CONFIG[t].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Name</label>
              <input value={form.name} onChange={e => set('name')(e.target.value)} className={inputCls} placeholder="Jane Williams" required />
            </div>
            <div><label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={e => set('email')(e.target.value)} className={inputCls} placeholder="jane@example.com" required />
            </div>
            <div><label className={labelCls}>Referral Code</label>
              <input value={form.code} onChange={e => set('code')(e.target.value.toUpperCase())} className={`${inputCls} font-mono tracking-wide`} placeholder="Auto-generated" />
            </div>
            <div><label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status')(e.target.value)} className={inputCls}>
                {(['pending','active','suspended','rejected'] as AffiliateStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
            <div><label className={labelCls}>Commission %</label>
              <input type="number" min="0" max="100" step="0.5" value={form.commission_pct} onChange={e => set('commission_pct')(e.target.value)} className={inputCls} />
            </div>
            <div><label className={labelCls}>Recurring Months</label>
              <input type="number" min="1" max="24" value={form.recurring_months} onChange={e => set('recurring_months')(e.target.value)} className={inputCls} />
            </div>
            <div><label className={labelCls}>Channel</label>
              <select value={form.channel} onChange={e => set('channel')(e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Website</label>
              <input value={form.website} onChange={e => set('website')(e.target.value)} className={inputCls} placeholder="https://…" />
            </div>
          </div>

          <div><label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes')(e.target.value)} rows={3}
              className={`${inputCls} resize-none`} placeholder="Context, audience size, any special terms…" />
          </div>

          {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Affiliate'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm font-bold rounded-xl border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

// ── Referral link card ────────────────────────────────────────────────────────

function ReferralLinkCard({ affiliate }: { affiliate: AffiliateWithStats }) {
  const [copied, setCopied] = useState(false);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.flowen.ai';
  const link = `${baseUrl}?ref=${affiliate.code}`;

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-xs font-mono">
      <span className="text-slate-500 truncate flex-1">{link}</span>
      <button type="button" onClick={copyLink}
        className={`shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all ${
          copied ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}>
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  );
}

// ── Affiliate row ─────────────────────────────────────────────────────────────

function AffiliateRow({
  affiliate, onEdit, onStatusChange, onDelete, onAddConversion, onCreatePayout,
}: {
  affiliate: AffiliateWithStats;
  onEdit: () => void;
  onStatusChange: (status: AffiliateStatus) => void;
  onDelete: () => void;
  onAddConversion: () => void;
  onCreatePayout: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_CONFIG[affiliate.status];
  const tc = TIER_CONFIG[affiliate.tier];
  const hasPending = affiliate.pending_pence > 0;

  return (
    <>
      <tr className="border-t border-slate-200 dark:border-slate-800/60 hover:bg-slate-800/20 transition-colors group">
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{affiliate.name}</p>
              <p className="text-[10px] font-mono text-slate-500">{affiliate.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5">
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${tc.badge}`}>{tc.label}</span>
        </td>
        <td className="px-4 py-3.5">
          <span className="font-mono text-xs text-slate-600 dark:text-slate-300 tracking-wide">{affiliate.code}</span>
        </td>
        <td className="px-4 py-3.5">
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${sc.badge}`}>{sc.label}</span>
        </td>
        <td className="px-4 py-3.5 text-right tabular-nums text-slate-400 text-xs">{affiliate.click_count}</td>
        <td className="px-4 py-3.5 text-right tabular-nums text-slate-600 dark:text-slate-300 text-xs font-bold">{affiliate.conversion_count}</td>
        <td className="px-4 py-3.5 text-right tabular-nums text-amber-400 text-xs font-bold">{fmtGBP(affiliate.total_earned_pence, true)}</td>
        <td className="px-4 py-3.5 text-right tabular-nums text-xs">
          {hasPending
            ? <span className="text-purple-400 font-bold">{fmtGBP(affiliate.pending_pence, true)}</span>
            : <span className="text-slate-600">—</span>}
        </td>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => setExpanded(v => !v)}
              className="px-2 py-1 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              {expanded ? 'Hide' : 'View'}
            </button>
            <button type="button" onClick={onEdit}
              className="px-2 py-1 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              Edit
            </button>
            <button type="button" onClick={onDelete}
              className="px-2 py-1 text-[10px] font-mono rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 hover:text-red-400 transition-colors">
              ✕
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-slate-100 dark:bg-slate-950/60 border-t border-slate-200/60 dark:border-slate-800/40 px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <ReferralLinkCard affiliate={affiliate} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { l: 'Commission', v: `${affiliate.commission_pct}%` },
                    { l: 'Recurring',  v: `${affiliate.recurring_months} mo` },
                    { l: 'Channel',    v: affiliate.channel ?? '—' },
                  ].map(x => (
                    <div key={x.l} className="bg-white dark:bg-slate-900 rounded-xl p-2.5">
                      <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-0.5">{x.l}</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{x.v}</p>
                    </div>
                  ))}
                </div>
                {affiliate.notes && (
                  <p className="text-xs text-slate-500 italic">{affiliate.notes}</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Quick actions</p>
                <div className="flex flex-wrap gap-2">
                  {affiliate.status === 'pending' && (
                    <button type="button" onClick={() => onStatusChange('active')}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white transition-colors">
                      ✓ Approve
                    </button>
                  )}
                  {affiliate.status === 'active' && (
                    <button type="button" onClick={() => onStatusChange('suspended')}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 transition-colors">
                      Suspend
                    </button>
                  )}
                  {affiliate.status === 'suspended' && (
                    <button type="button" onClick={() => onStatusChange('active')}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white transition-colors">
                      Reactivate
                    </button>
                  )}
                  {affiliate.status !== 'rejected' && (
                    <button type="button" onClick={() => onStatusChange('rejected')}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors">
                      Reject
                    </button>
                  )}
                  <button type="button" onClick={onAddConversion}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-colors">
                    + Conversion
                  </button>
                  {hasPending && (
                    <button type="button" onClick={onCreatePayout}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-colors">
                      💸 Create payout ({fmtGBP(affiliate.pending_pence, true)})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Conversion modal ──────────────────────────────────────────────────────────

function ConversionModal({
  affiliate, onSave, onClose,
}: { affiliate: AffiliateWithStats; onSave: () => void; onClose: () => void }) {
  const [eventType, setEventType] = useState<ConversionEvent>('signup');
  const [amountPounds, setAmountPounds] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const commPct = affiliate.commission_pct;
  const amtPence = Math.round(parseFloat(amountPounds || '0') * 100);
  const commPence = Math.round(amtPence * (commPct / 100));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await api({
      action: 'add_conversion',
      affiliate_id: affiliate.id,
      event_type: eventType,
      amount_pence: amtPence || null,
      notes: notes || null,
    });
    setSaving(false);
    onSave();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Record Conversion</h3>
          <p className="text-xs text-slate-500 mb-5">Affiliate: <span className="text-slate-900 dark:text-white">{affiliate.name}</span></p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Event Type</label>
              <select value={eventType} onChange={e => setEventType(e.target.value as ConversionEvent)} className={inputCls}>
                <option value="signup">Sign-up</option>
                <option value="subscription">New Subscription</option>
                <option value="renewal">Renewal</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Revenue Amount (£)</label>
              <input type="number" min="0" step="0.01" value={amountPounds} onChange={e => setAmountPounds(e.target.value)}
                className={inputCls} placeholder="0.00" />
              {amtPence > 0 && (
                <p className="text-[10px] font-mono text-emerald-400 mt-1">
                  Commission: {fmtGBP(commPence)} ({commPct}%)
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Optional context" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Record'}
              </button>
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 text-sm font-bold rounded-xl border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ── Payouts table ─────────────────────────────────────────────────────────────

const PAYOUT_STATUS: Record<string, string> = {
  pending:    'bg-amber-500/10 text-amber-400 border-amber-500/30',
  processing: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  paid:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  failed:     'bg-red-500/10 text-red-400 border-red-500/30',
};

function PayoutsTab({
  payouts, affiliates, onMarkPaid,
}: {
  payouts: AffiliatePayout[];
  affiliates: AffiliateWithStats[];
  onMarkPaid: (id: string, ref: string) => void;
}) {
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [payRef, setPayRef] = useState('');
  const byId = Object.fromEntries(affiliates.map(a => [a.id, a.name]));

  if (payouts.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
        <p className="text-sm text-slate-600 font-mono">No payouts yet</p>
        <p className="text-xs text-slate-700 font-mono mt-1">Create payouts from affiliate rows when commissions are approved</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            {['Date','Affiliate','Amount','Commissions','Method','Ref','Status',''].map(h => (
              <th key={h} className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {payouts.map(p => (
            <React.Fragment key={p.id}>
              <tr className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-white font-medium">{byId[p.affiliate_id] ?? '—'}</td>
                <td className="px-4 py-3 text-sm font-black text-amber-400">{fmtGBP(p.amount_pence)}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{p.commission_count}</td>
                <td className="px-4 py-3 text-xs text-slate-400 capitalize">{p.payment_method ?? '—'}</td>
                <td className="px-4 py-3 text-xs font-mono text-slate-500">{p.payment_ref ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${PAYOUT_STATUS[p.status] ?? ''}`}>
                    {p.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.status !== 'paid' && (
                    <button type="button" onClick={() => { setMarkingId(p.id); setPayRef(''); }}
                      className="opacity-0 group-hover:opacity-100 px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all">
                      Mark paid
                    </button>
                  )}
                  {p.status === 'paid' && p.paid_at && (
                    <span className="text-[10px] font-mono text-slate-600">{fmtDate(p.paid_at)}</span>
                  )}
                </td>
              </tr>
              {markingId === p.id && (
                <tr>
                  <td colSpan={8} className="px-4 py-3 bg-slate-100 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3 flex-wrap">
                      <input value={payRef} onChange={e => setPayRef(e.target.value)}
                        placeholder="Payment reference (optional)"
                        className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60" />
                      <button type="button" onClick={() => { onMarkPaid(p.id, payRef); setMarkingId(null); }}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white transition-colors">
                        Confirm paid
                      </button>
                      <button type="button" onClick={() => setMarkingId(null)}
                        className="px-3 py-1.5 text-xs font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Performance tab ───────────────────────────────────────────────────────────

function PerformanceTab({ affiliates }: { affiliates: AffiliateWithStats[] }) {
  const ranked = useMemo(() =>
    [...affiliates]
      .filter(a => a.status === 'active')
      .sort((a, b) => b.total_earned_pence - a.total_earned_pence),
    [affiliates],
  );
  const maxEarned = ranked[0]?.total_earned_pence ?? 1;

  if (ranked.length === 0) return (
    <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
      <p className="text-sm text-slate-600 font-mono">No active affiliates yet</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {ranked.map((a, i) => {
        const barW = maxEarned > 0 ? (a.total_earned_pence / maxEarned) * 100 : 0;
        const cvr = a.click_count > 0
          ? ((a.conversion_count / a.click_count) * 100).toFixed(1) + '%'
          : '—';
        return (
          <div key={a.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-slate-400">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{a.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${TIER_CONFIG[a.tier].badge}`}>{TIER_CONFIG[a.tier].label}</span>
                    {a.channel && <span className="text-[10px] font-mono text-slate-600">{a.channel}</span>}
                    <span className="text-[10px] font-mono text-slate-700">/{a.code}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 text-right flex-wrap">
                {[
                  { l: 'Earned',      v: fmtGBP(a.total_earned_pence, true), c: 'text-amber-400' },
                  { l: 'Conversions', v: String(a.conversion_count),          c: 'text-sky-400'   },
                  { l: 'CVR',         v: cvr,                                 c: 'text-emerald-400'},
                ].map(x => (
                  <div key={x.l}>
                    <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">{x.l}</p>
                    <p className={`text-sm font-black ${x.c}`}>{x.v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500/60 rounded-full transition-all" style={{ width: `${barW}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

type Tab = 'affiliates' | 'performance' | 'payouts';

interface Props {
  initialAffiliates: AffiliateWithStats[];
  initialPayouts:    AffiliatePayout[];
  initialSummary:    Summary;
}

export default function AffiliateClient({ initialAffiliates, initialPayouts, initialSummary }: Props) {
  const [affiliates, setAffiliates] = useState<AffiliateWithStats[]>(initialAffiliates);
  const [payouts,    setPayouts]    = useState<AffiliatePayout[]>(initialPayouts);
  const [summary,    setSummary]    = useState<Summary>(initialSummary);
  const [tab,        setTab]        = useState<Tab>('affiliates');
  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState<AffiliateWithStats | undefined>();
  const [convTarget, setConvTarget] = useState<AffiliateWithStats | undefined>();
  const [filterStatus, setFilterStatus] = useState<AffiliateStatus | 'all'>('all');
  const [filterTier,   setFilterTier]   = useState<AffiliateTier | 'all'>('all');
  const [search,       setSearch]       = useState('');
  const [seeding,      setSeeding]      = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [, startT] = useTransition();

  function showToast(msg: string, kind: 'ok' | 'err') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  }

  async function reload() {
    const res = await fetch('/api/admin/affiliate');
    const data = await res.json() as { affiliates: AffiliateWithStats[]; payouts: AffiliatePayout[]; summary: Summary };
    if (data.affiliates) { setAffiliates(data.affiliates); setPayouts(data.payouts); setSummary(data.summary); }
  }

  async function handleSeed() {
    if (!confirm('Seed with example affiliates? (SLT, SEND school, stammer blog)')) return;
    setSeeding(true);
    await api({ action: 'seed' });
    await reload();
    setSeeding(false);
    showToast('Example affiliates seeded', 'ok');
  }

  function handleSaveAffiliate(a: AffiliateWithStats) {
    setAffiliates(prev => {
      const idx = prev.findIndex(x => x.id === a.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], ...a }; return n; }
      return [a, ...prev];
    });
    setShowModal(false);
    setEditTarget(undefined);
    showToast('Affiliate saved', 'ok');
    void reload();
  }

  async function handleStatusChange(id: string, status: AffiliateStatus) {
    const res = await api({ action: 'update_affiliate', id, status });
    if (res.error) { showToast(res.error as string, 'err'); return; }
    setAffiliates(prev => prev.map(a => a.id === id ? { ...a, status, ...(status === 'active' ? { approved_at: new Date().toISOString() } : {}) } : a));
    showToast(`Affiliate ${status}`, 'ok');
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete affiliate? This removes all their data.')) return;
    startT(async () => {
      await api({ action: 'delete_affiliate', id });
      setAffiliates(prev => prev.filter(a => a.id !== id));
      showToast('Deleted', 'ok');
    });
  }

  async function handleCreatePayout(affiliateId: string) {
    if (!confirm('Create payout for all approved commissions for this affiliate?')) return;
    const res = await api({ action: 'create_payout', affiliate_id: affiliateId, payment_method: 'bank_transfer' });
    if (res.error) { showToast(res.error as string, 'err'); return; }
    showToast('Payout created', 'ok');
    await reload();
  }

  async function handleMarkPaid(id: string, ref: string) {
    const res = await api({ action: 'mark_payout_paid', id, payment_ref: ref || null });
    if (res.error) { showToast(res.error as string, 'err'); return; }
    setPayouts(prev => prev.map(p => p.id === id ? { ...p, status: 'paid', payment_ref: ref || null, paid_at: new Date().toISOString() } : p));
    showToast('Payout marked as paid', 'ok');
  }

  const filtered = useMemo(() => affiliates.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterTier   !== 'all' && a.tier   !== filterTier)   return false;
    if (search && !`${a.name} ${a.email} ${a.code} ${a.channel ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [affiliates, filterStatus, filterTier, search]);

  const pendingApprovals = affiliates.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {toast && <Toast msg={toast.msg} kind={toast.kind} />}

      <SummaryHero summary={summary} />

      {/* Pending approval banner */}
      {pendingApprovals > 0 && (
        <div className="flex items-center justify-between gap-4 bg-amber-500/8 border border-amber-500/25 rounded-2xl px-5 py-3.5 flex-wrap">
          <p className="text-sm text-amber-300 font-semibold">
            {pendingApprovals} affiliate{pendingApprovals > 1 ? 's' : ''} awaiting approval
          </p>
          <button type="button" onClick={() => { setTab('affiliates'); setFilterStatus('pending'); }}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors">
            Review now
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 w-fit">
        {([
          { id: 'affiliates',  label: 'Affiliates' },
          { id: 'performance', label: 'Performance' },
          { id: 'payouts',     label: 'Payouts' },
        ] as const).map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {t.label}
            {t.id === 'payouts' && payouts.filter(p => p.status === 'pending').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-purple-500 text-slate-900 dark:text-white">
                {payouts.filter(p => p.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Affiliates tab ─────────────────────────────────────────────── */}
      {tab === 'affiliates' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, code…"
              className="flex-1 min-w-[200px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-slate-600" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as AffiliateStatus | 'all')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none">
              <option value="all">All statuses</option>
              {(['pending','active','suspended','rejected'] as AffiliateStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            <select value={filterTier} onChange={e => setFilterTier(e.target.value as AffiliateTier | 'all')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none">
              <option value="all">All tiers</option>
              {(['standard','premium','partner'] as AffiliateTier[]).map(t => (
                <option key={t} value={t}>{TIER_CONFIG[t].label}</option>
              ))}
            </select>
            <button type="button" onClick={() => { setEditTarget(undefined); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-sm font-bold transition-colors">
              + Add affiliate
            </button>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-14 text-center space-y-3">
              <p className="text-slate-500 text-sm">{affiliates.length === 0 ? 'No affiliates yet' : 'No results'}</p>
              {affiliates.length === 0 && (
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <button type="button" onClick={() => { setEditTarget(undefined); setShowModal(true); }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-sm font-bold transition-colors">
                    Add first affiliate
                  </button>
                  <button type="button" onClick={handleSeed} disabled={seeding}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold transition-colors disabled:opacity-50">
                    {seeding ? 'Seeding…' : '⚡ Seed examples'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      {['Affiliate','Tier','Code','Status','Clicks','Conversions','Earned','Pending',''].map(h => (
                        <th key={h} className={`px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 ${
                          ['Clicks','Conversions','Earned','Pending'].includes(h) ? 'text-right' : 'text-left'
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(a => (
                      <AffiliateRow
                        key={a.id}
                        affiliate={a}
                        onEdit={() => { setEditTarget(a); setShowModal(true); }}
                        onStatusChange={s => handleStatusChange(a.id, s)}
                        onDelete={() => handleDelete(a.id)}
                        onAddConversion={() => setConvTarget(a)}
                        onCreatePayout={() => handleCreatePayout(a.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Performance tab ─────────────────────────────────────────────── */}
      {tab === 'performance' && <PerformanceTab affiliates={affiliates} />}

      {/* ── Payouts tab ─────────────────────────────────────────────────── */}
      {tab === 'payouts' && (
        <PayoutsTab payouts={payouts} affiliates={affiliates} onMarkPaid={handleMarkPaid} />
      )}

      {/* Modals */}
      {showModal && (
        <AffiliateModal
          initial={editTarget}
          onSave={handleSaveAffiliate}
          onClose={() => { setShowModal(false); setEditTarget(undefined); }}
        />
      )}
      {convTarget && (
        <ConversionModal
          affiliate={convTarget}
          onSave={async () => { setConvTarget(undefined); await reload(); showToast('Conversion recorded', 'ok'); }}
          onClose={() => setConvTarget(undefined)}
        />
      )}
    </div>
  );
}
