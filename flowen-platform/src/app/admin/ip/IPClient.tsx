'use client';

import React, { useState, useTransition } from 'react';
import type { IPAsset, IPAssetType, ModelVersion } from '@/app/api/admin/ip/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtGBP(pence: number | null) {
  if (pence === null || pence === undefined) return null;
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(1)}m`;
  if (pounds >= 1_000) return `£${(pounds / 1_000).toFixed(0)}k`;
  return `£${pounds.toLocaleString('en-GB')}`;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function apiJson(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin/ip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

// ── Config ────────────────────────────────────────────────────────────────────

const ASSET_TYPES: { id: IPAssetType; label: string; accent: string; badge: string; bg: string; border: string }[] = [
  { id: 'ai_model',     label: 'AI Models',     accent: 'purple', badge: 'bg-purple-500/15 text-purple-300 border border-purple-500/30', bg: 'bg-purple-500/5',  border: 'border-purple-500/20' },
  { id: 'trademark',    label: 'Trademarks',    accent: 'amber',  badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',   bg: 'bg-amber-500/5',   border: 'border-amber-500/20' },
  { id: 'patent',       label: 'Patents',       accent: 'sky',    badge: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',         bg: 'bg-sky-500/5',     border: 'border-sky-500/20' },
  { id: 'trade_secret', label: 'Trade Secrets', accent: 'slate',  badge: 'bg-slate-600/30 text-slate-300 border border-slate-600/40',   bg: 'bg-slate-800/30',  border: 'border-slate-700/50' },
  { id: 'dataset',      label: 'Datasets',      accent: 'indigo', badge: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30', bg: 'bg-indigo-500/5',  border: 'border-indigo-500/20' },
  { id: 'copyright',    label: 'Copyright',     accent: 'slate',  badge: 'bg-slate-600/30 text-slate-300 border border-slate-600/40',   bg: 'bg-slate-800/30',  border: 'border-slate-700/50' },
  { id: 'domain',       label: 'Domains',       accent: 'slate',  badge: 'bg-slate-600/30 text-slate-300 border border-slate-600/40',   bg: 'bg-slate-800/30',  border: 'border-slate-700/50' },
];

const ASSET_TYPE_MAP = Object.fromEntries(ASSET_TYPES.map(t => [t.id, t]));

const JURISDICTIONS = ['UK', 'EU', 'US', 'Global', 'Multiple'];

const STATUSES = [
  { id: 'registered',   label: 'Registered',   color: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
  { id: 'pending',      label: 'Pending',       color: 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse' },
  { id: 'unregistered', label: 'Unregistered',  color: 'bg-slate-700/40 text-slate-400 border border-slate-700' },
  { id: 'licensed',     label: 'Licensed',      color: 'bg-sky-500/15 text-sky-300 border border-sky-500/30' },
  { id: 'expired',      label: 'Expired',       color: 'bg-red-500/15 text-red-300 border border-red-500/30' },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.id, s]));

const EMPTY_STATE_SUGGESTIONS = [
  { name: 'Disfluent ASR Engine v1.0', asset_type: 'ai_model' as IPAssetType, status: 'unregistered', jurisdiction: 'Global', description: 'Proprietary fine-tuned ASR model for disfluency detection and biofeedback' },
  { name: 'FLOWEN', asset_type: 'trademark' as IPAssetType, status: 'pending', jurisdiction: 'UK', description: 'Brand name trademark' },
  { name: '"Every word gets there." tagline', asset_type: 'trademark' as IPAssetType, status: 'unregistered', jurisdiction: 'UK', description: 'Registered tagline / slogan' },
  { name: 'Flowen dual-waveform logo', asset_type: 'trademark' as IPAssetType, status: 'unregistered', jurisdiction: 'UK', description: 'Distinctive dual-waveform gradient logomark' },
  { name: 'Disfluent Speech Training Dataset (100k+ clips)', asset_type: 'dataset' as IPAssetType, status: 'unregistered', jurisdiction: 'Global', description: 'Proprietary corpus of 100k+ labelled disfluent audio clips' },
  { name: 'flowen.digital', asset_type: 'domain' as IPAssetType, status: 'registered', jurisdiction: 'Global', description: 'Primary web domain' },
  { name: 'flowen.app', asset_type: 'domain' as IPAssetType, status: 'registered', jurisdiction: 'Global', description: 'App sub-domain' },
];

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, color: 'bg-slate-700 text-slate-400' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${cfg.color}`}>
      {cfg.label.toUpperCase()}
    </span>
  );
}

// ── Asset form (add / edit) ───────────────────────────────────────────────────

interface AssetFormValues {
  asset_type: IPAssetType;
  name: string;
  description: string;
  jurisdiction: string;
  status: string;
  filing_date: string;
  registration_number: string;
  renewal_date: string;
  estimated_value_pence: string;
  owner: string;
  notes: string;
}

const BLANK_ASSET_FORM: AssetFormValues = {
  asset_type: 'ai_model',
  name: '',
  description: '',
  jurisdiction: '',
  status: 'unregistered',
  filing_date: '',
  registration_number: '',
  renewal_date: '',
  estimated_value_pence: '',
  owner: 'Flowen Technologies Ltd',
  notes: '',
};

function AssetForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: AssetFormValues;
  onSave: (values: AssetFormValues) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<AssetFormValues>(initial);
  function field<K extends keyof AssetFormValues>(k: K, v: AssetFormValues[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60';
  const labelCls = 'block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5';

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Asset Type *</label>
          <select
            value={form.asset_type}
            onChange={e => field('asset_type', e.target.value as IPAssetType)}
            className={inputCls}
          >
            {ASSET_TYPES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select
            value={form.status}
            onChange={e => field('status', e.target.value)}
            className={inputCls}
          >
            {STATUSES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Name *</label>
        <input
          value={form.name}
          onChange={e => field('name', e.target.value)}
          placeholder="e.g. Disfluent ASR Engine v1.0"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <input
          value={form.description}
          onChange={e => field('description', e.target.value)}
          placeholder="Brief description"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Jurisdiction</label>
          <select
            value={form.jurisdiction}
            onChange={e => field('jurisdiction', e.target.value)}
            className={inputCls}
          >
            <option value="">— None —</option>
            {JURISDICTIONS.map(j => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Owner</label>
          <input
            value={form.owner}
            onChange={e => field('owner', e.target.value)}
            placeholder="Flowen Technologies Ltd"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Filing Date</label>
          <input
            type="date"
            value={form.filing_date}
            onChange={e => field('filing_date', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Registration No.</label>
          <input
            value={form.registration_number}
            onChange={e => field('registration_number', e.target.value)}
            placeholder="e.g. UK00003..."
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Renewal Date</label>
          <input
            type="date"
            value={form.renewal_date}
            onChange={e => field('renewal_date', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Estimated Value (£)</label>
        <input
          type="number"
          min="0"
          step="1"
          value={form.estimated_value_pence}
          onChange={e => field('estimated_value_pence', e.target.value)}
          placeholder="Value in pence (e.g. 500000 = £5,000)"
          className={inputCls}
        />
        {form.estimated_value_pence && (
          <p className="text-[10px] text-slate-500 mt-1 font-mono">
            = {fmtGBP(Number(form.estimated_value_pence))}
          </p>
        )}
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          value={form.notes}
          onChange={e => field('notes', e.target.value)}
          rows={2}
          placeholder="Internal notes, evidence locations, counsel references…"
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.name}
          className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Asset'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Asset card ────────────────────────────────────────────────────────────────

function AssetCard({
  asset,
  onEdit,
  onDelete,
  deleting,
}: {
  asset: IPAsset;
  onEdit: (a: IPAsset) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const typeCfg = ASSET_TYPE_MAP[asset.asset_type];
  const renewalDays = daysUntil(asset.renewal_date);
  const renewalAlert = renewalDays !== null && renewalDays <= 90 && renewalDays >= 0;
  const renewalExpired = renewalDays !== null && renewalDays < 0;

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 group transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <p className="text-sm font-bold text-white">{asset.name}</p>
            {asset.jurisdiction && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-700/60 text-slate-400">
                {asset.jurisdiction}
              </span>
            )}
            <StatusBadge status={asset.status} />
            {renewalAlert && !renewalExpired && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                RENEW IN {renewalDays}d
              </span>
            )}
            {renewalExpired && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-red-700/20 text-red-500 border border-red-700/30">
                RENEWAL OVERDUE
              </span>
            )}
          </div>

          {/* Description */}
          {asset.description && (
            <p className="text-xs text-slate-500 mb-2">{asset.description}</p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-600">
            {asset.filing_date && (
              <span>Filed: <span className="text-slate-400">{fmtDate(asset.filing_date)}</span></span>
            )}
            {asset.registration_number && (
              <span>Reg: <span className="text-slate-400">{asset.registration_number}</span></span>
            )}
            {asset.renewal_date && (
              <span className={renewalAlert && !renewalExpired ? 'text-red-400' : renewalExpired ? 'text-red-500' : ''}>
                Renews: <span>{fmtDate(asset.renewal_date)}</span>
              </span>
            )}
            {asset.estimated_value_pence !== null && (
              <span>Est. value: <span className="text-emerald-400 font-bold">{fmtGBP(asset.estimated_value_pence)}</span></span>
            )}
            <span>Owner: <span className="text-slate-400">{asset.owner}</span></span>
          </div>

          {asset.notes && (
            <p className="text-[10px] text-slate-600 mt-1.5 italic">{asset.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(asset)}
            className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(asset.id)}
            disabled={deleting}
            className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Asset type section ─────────────────────────────────────────────────────────

function AssetTypeSection({
  typeConfig,
  assets,
  onEdit,
  onDelete,
  deleting,
}: {
  typeConfig: typeof ASSET_TYPES[number];
  assets: IPAsset[];
  onEdit: (a: IPAsset) => void;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  const [open, setOpen] = useState(true);

  if (assets.length === 0) return null;

  return (
    <div className={`rounded-2xl border ${typeConfig.border} ${typeConfig.bg} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${typeConfig.badge}`}>
            {typeConfig.label.toUpperCase()}
          </span>
          <span className="text-xs text-slate-500 font-mono">{assets.length} asset{assets.length !== 1 ? 's' : ''}</span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {assets.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onEdit={onEdit}
              onDelete={onDelete}
              deleting={deleting === asset.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Investor summary card ─────────────────────────────────────────────────────

function InvestorSummaryCard({ assets, versions }: { assets: IPAsset[]; versions: ModelVersion[] }) {
  const [copied, setCopied] = useState(false);

  const trademarks = assets.filter(a => a.asset_type === 'trademark' && ['registered', 'pending'].includes(a.status));
  const tradeSecrets = assets.filter(a => a.asset_type === 'trade_secret');
  const prodVersion = versions.find(v => v.deployed && !v.deprecated);
  const totalClips = prodVersion?.training_clips ?? versions.reduce((max, v) => Math.max(max, v.training_clips ?? 0), 0);
  const totalValuePence = assets.reduce((sum, a) => sum + (a.estimated_value_pence ?? 0), 0);

  function buildSummary() {
    const lines: string[] = ['Flowen Technologies Ltd — IP Portfolio Summary', ''];

    if (trademarks.length > 0) {
      const names = trademarks.map(t => t.name).join(', ');
      lines.push(`• ${trademarks.length} registered/pending trademark(s) — ${names}`);
    }

    const modelLine = `• Proprietary Disfluent ASR Engine — ${versions.length} model version${versions.length !== 1 ? 's' : ''}${totalClips ? `, ${(totalClips / 1000).toFixed(0)}k training clips` : ''}${prodVersion?.latency_ms ? `, <${prodVersion.latency_ms}ms latency` : ''}`;
    lines.push(modelLine);

    if (tradeSecrets.length > 0) {
      const descs = tradeSecrets.map(t => t.description || t.name).join('; ');
      lines.push(`• ${tradeSecrets.length} trade secret(s) — ${descs}`);
    }

    if (totalValuePence > 0) {
      lines.push(`• Total estimated IP value: ${fmtGBP(totalValuePence)}`);
    }

    lines.push('');
    lines.push('Owner: Flowen Technologies Ltd');
    lines.push(`As of: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`);

    return lines.join('\n');
  }

  function copy() {
    navigator.clipboard.writeText(buildSummary());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/30 border border-purple-500/20 rounded-2xl p-6">
      {/* Decorative glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              INVESTOR SUMMARY
            </span>
          </div>
          <h3 className="text-base font-bold text-white">IP Portfolio — Flowen Technologies Ltd</h3>
          <p className="text-xs text-slate-500 mt-0.5">Condensed view for investor conversations and diligence</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className={`shrink-0 px-3.5 py-2 text-xs font-mono font-bold rounded-xl border transition-all ${
            copied
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
          }`}
        >
          {copied ? 'Copied ✓' : 'Copy for investor'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-950/60 rounded-xl p-3.5">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Trademarks</p>
          <p className="text-2xl font-black text-amber-400">{trademarks.length}</p>
          <p className="text-[10px] text-slate-600 mt-0.5 font-mono truncate">
            {trademarks.length > 0 ? trademarks.map(t => t.name).join(', ') : 'None registered'}
          </p>
        </div>
        <div className="bg-slate-950/60 rounded-xl p-3.5">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">ASR Versions</p>
          <p className="text-2xl font-black text-purple-400">{versions.length}</p>
          <p className="text-[10px] text-slate-600 mt-0.5 font-mono">
            {totalClips ? `${(totalClips / 1000).toFixed(0)}k training clips` : 'No data'}
          </p>
        </div>
        <div className="bg-slate-950/60 rounded-xl p-3.5">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Trade Secrets</p>
          <p className="text-2xl font-black text-slate-300">{tradeSecrets.length}</p>
          <p className="text-[10px] text-slate-600 mt-0.5 font-mono">
            {tradeSecrets.length > 0 ? tradeSecrets.map(t => t.name).join(', ') : 'None catalogued'}
          </p>
        </div>
        <div className="bg-slate-950/60 rounded-xl p-3.5">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Est. IP Value</p>
          <p className="text-2xl font-black text-emerald-400">
            {totalValuePence > 0 ? fmtGBP(totalValuePence) : '—'}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5 font-mono">across {assets.length} asset{assets.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Inline summary text */}
      {assets.length > 0 || versions.length > 0 ? (
        <div className="mt-4 bg-slate-950/50 rounded-xl px-4 py-3 font-mono text-[11px] text-slate-400 leading-relaxed whitespace-pre-line border border-slate-800/50">
          {buildSummary()}
        </div>
      ) : null}
    </div>
  );
}

// ── IP Register tab ───────────────────────────────────────────────────────────

function IPRegisterTab({ assets: initial, versions }: { assets: IPAsset[]; versions: ModelVersion[] }) {
  const [assets, setAssets] = useState<IPAsset[]>(initial);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<IPAsset | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const registeredCount = assets.filter(a => a.status === 'registered').length;
  const pendingCount = assets.filter(a => a.status === 'pending').length;
  const totalValuePence = assets.reduce((sum, a) => sum + (a.estimated_value_pence ?? 0), 0);
  const renewalAlerts = assets.filter(a => {
    const days = daysUntil(a.renewal_date);
    return days !== null && days <= 90 && days >= 0;
  });

  // ── Add asset ──────────────────────────────────────────────────────────────
  async function handleAddSave(form: AssetFormValues) {
    setSavingForm(true);
    setError(null);
    const res = await apiJson('add_asset', {
      ...form,
      estimated_value_pence: form.estimated_value_pence ? Number(form.estimated_value_pence) : null,
    });
    setSavingForm(false);
    if (res.error) { setError(res.error); return; }
    setAssets(prev => [res.data, ...prev]);
    setShowAddForm(false);
  }

  // ── Edit asset ─────────────────────────────────────────────────────────────
  async function handleEditSave(form: AssetFormValues) {
    if (!editingAsset) return;
    setSavingForm(true);
    setError(null);
    const res = await apiJson('update_asset', {
      id: editingAsset.id,
      ...form,
      estimated_value_pence: form.estimated_value_pence ? Number(form.estimated_value_pence) : null,
    });
    setSavingForm(false);
    if (res.error) { setError(res.error); return; }
    setAssets(prev => prev.map(a => a.id === editingAsset.id ? res.data : a));
    setEditingAsset(null);
  }

  // ── Delete asset ───────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await apiJson('delete_asset', { id });
    setDeletingId(null);
    if (res.error) { setError(res.error); return; }
    setAssets(prev => prev.filter(a => a.id !== id));
  }

  function editFormValues(a: IPAsset): AssetFormValues {
    return {
      asset_type: a.asset_type,
      name: a.name,
      description: a.description ?? '',
      jurisdiction: a.jurisdiction ?? '',
      status: a.status,
      filing_date: a.filing_date ?? '',
      registration_number: a.registration_number ?? '',
      renewal_date: a.renewal_date ?? '',
      estimated_value_pence: a.estimated_value_pence !== null ? String(a.estimated_value_pence) : '',
      owner: a.owner,
      notes: a.notes ?? '',
    };
  }

  return (
    <div className="space-y-6">
      {/* Investor summary card */}
      <InvestorSummaryCard assets={assets} versions={versions} />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Total Assets</p>
          <p className="text-3xl font-black text-white">{assets.length}</p>
        </div>
        <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-4">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Registered</p>
          <p className="text-3xl font-black text-amber-400">{registeredCount}</p>
        </div>
        <div className="bg-slate-900 border border-sky-500/20 rounded-2xl p-4">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Pending</p>
          <p className="text-3xl font-black text-sky-400">{pendingCount}</p>
        </div>
        <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-4">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Est. Value</p>
          <p className="text-2xl font-black text-emerald-400">
            {totalValuePence > 0 ? fmtGBP(totalValuePence) : '—'}
          </p>
        </div>
      </div>

      {/* Renewal alerts */}
      {renewalAlerts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-red-400 text-lg shrink-0">!</span>
          <div>
            <p className="text-xs font-bold text-red-300 font-mono">RENEWAL ALERTS</p>
            <p className="text-xs text-red-400/80 mt-0.5">
              {renewalAlerts.map(a => `${a.name} (${daysUntil(a.renewal_date)}d)`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Add asset button + form */}
      <div>
        {!showAddForm && !editingAsset && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            + Add Asset
          </button>
        )}

        {showAddForm && (
          <div className="mt-3">
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-3">New Asset</p>
            {error && <p className="text-xs text-red-400 font-mono mb-3">{error}</p>}
            <AssetForm
              initial={BLANK_ASSET_FORM}
              onSave={handleAddSave}
              onCancel={() => { setShowAddForm(false); setError(null); }}
              saving={savingForm}
            />
          </div>
        )}
      </div>

      {/* Edit form (inline, replaces card) */}
      {editingAsset && (
        <div>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-3">Editing: {editingAsset.name}</p>
          {error && <p className="text-xs text-red-400 font-mono mb-3">{error}</p>}
          <AssetForm
            initial={editFormValues(editingAsset)}
            onSave={handleEditSave}
            onCancel={() => { setEditingAsset(null); setError(null); }}
            saving={savingForm}
          />
        </div>
      )}

      {/* Asset sections grouped by type */}
      {assets.length === 0 ? (
        <div className="space-y-4">
          <div className="py-8 text-center border border-dashed border-slate-800 rounded-2xl">
            <p className="text-sm text-slate-600 font-mono mb-1">No IP assets catalogued yet</p>
            <p className="text-xs text-slate-700 font-mono">Add your first asset using the button above</p>
          </div>

          {/* Suggestions */}
          <div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Suggested assets to catalogue</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EMPTY_STATE_SUGGESTIONS.map((s, i) => (
                <div
                  key={i}
                  className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 flex items-start justify-between gap-3 opacity-60"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-300">{s.name}</p>
                    {s.description && <p className="text-[10px] text-slate-600 mt-0.5">{s.description}</p>}
                    <div className="flex gap-2 mt-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${ASSET_TYPE_MAP[s.asset_type]?.badge ?? ''}`}>
                        {ASSET_TYPE_MAP[s.asset_type]?.label}
                      </span>
                      <StatusBadge status={s.status} />
                      {s.jurisdiction && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-700/60 text-slate-400">
                          {s.jurisdiction}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-700 font-mono shrink-0">suggestion</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {ASSET_TYPES.map(typeCfg => {
            const typeAssets = assets.filter(a => a.asset_type === typeCfg.id);
            return (
              <AssetTypeSection
                key={typeCfg.id}
                typeConfig={typeCfg}
                assets={typeAssets}
                onEdit={a => { setEditingAsset(a); setShowAddForm(false); }}
                onDelete={handleDelete}
                deleting={deletingId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Version form ──────────────────────────────────────────────────────────────

interface VersionFormValues {
  model_name: string;
  version: string;
  description: string;
  training_clips: string;
  accuracy_pct: string;
  latency_ms: string;
  deployed: boolean;
  deployed_at: string;
  deprecated: boolean;
}

const BLANK_VERSION_FORM: VersionFormValues = {
  model_name: 'Disfluent ASR Engine',
  version: '',
  description: '',
  training_clips: '',
  accuracy_pct: '',
  latency_ms: '',
  deployed: false,
  deployed_at: '',
  deprecated: false,
};

function VersionForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: VersionFormValues;
  onSave: (values: VersionFormValues) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<VersionFormValues>(initial);
  function field<K extends keyof VersionFormValues>(k: K, v: VersionFormValues[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60';
  const labelCls = 'block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5';

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Model Name</label>
          <input value={form.model_name} onChange={e => field('model_name', e.target.value)} className={inputCls} placeholder="Disfluent ASR Engine" />
        </div>
        <div>
          <label className={labelCls}>Version * <span className="text-slate-600 normal-case">(semver, e.g. 1.2.0)</span></label>
          <input value={form.version} onChange={e => field('version', e.target.value)} className={inputCls} placeholder="1.0.0" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <input value={form.description} onChange={e => field('description', e.target.value)} className={inputCls} placeholder="What changed in this version" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Training Clips</label>
          <input type="number" min="0" value={form.training_clips} onChange={e => field('training_clips', e.target.value)} className={inputCls} placeholder="100000" />
        </div>
        <div>
          <label className={labelCls}>Accuracy %</label>
          <input type="number" min="0" max="100" step="0.01" value={form.accuracy_pct} onChange={e => field('accuracy_pct', e.target.value)} className={inputCls} placeholder="94.5" />
        </div>
        <div>
          <label className={labelCls}>Latency (ms)</label>
          <input type="number" min="0" value={form.latency_ms} onChange={e => field('latency_ms', e.target.value)} className={inputCls} placeholder="140" />
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.deployed}
            onChange={e => field('deployed', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-emerald-500"
          />
          <span className="text-sm text-slate-300 font-mono">Set as production (deployed)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.deprecated}
            onChange={e => field('deprecated', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-red-500"
          />
          <span className="text-sm text-slate-400 font-mono">Deprecated</span>
        </label>
      </div>

      {form.deployed && (
        <div>
          <label className={labelCls}>Deployed At</label>
          <input type="datetime-local" value={form.deployed_at} onChange={e => field('deployed_at', e.target.value)} className={inputCls} />
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.version}
          className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Version'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Model Registry tab ────────────────────────────────────────────────────────

function ModelRegistryTab({ versions: initial }: { versions: ModelVersion[] }) {
  const [versions, setVersions] = useState<ModelVersion[]>(initial);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVersion, setEditingVersion] = useState<ModelVersion | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const prodVersion = versions.find(v => v.deployed && !v.deprecated) ?? null;

  // ── Add version ─────────────────────────────────────────────────────────────
  async function handleAddSave(form: VersionFormValues) {
    setSavingForm(true);
    setError(null);
    const res = await apiJson('add_version', {
      model_name: form.model_name || 'Disfluent ASR Engine',
      version: form.version,
      description: form.description || null,
      training_clips: form.training_clips ? Number(form.training_clips) : null,
      accuracy_pct: form.accuracy_pct ? Number(form.accuracy_pct) : null,
      latency_ms: form.latency_ms ? Number(form.latency_ms) : null,
      deployed: form.deployed,
      deployed_at: form.deployed_at || null,
      deprecated: form.deprecated,
    });
    setSavingForm(false);
    if (res.error) { setError(res.error); return; }
    // If deployed, reset deployed on all others locally
    let updated = [...versions];
    if (form.deployed) {
      updated = updated.map(v => ({ ...v, deployed: false, deployed_at: null }));
    }
    setVersions([res.data, ...updated]);
    setShowAddForm(false);
  }

  // ── Edit version ─────────────────────────────────────────────────────────────
  async function handleEditSave(form: VersionFormValues) {
    if (!editingVersion) return;
    setSavingForm(true);
    setError(null);
    const res = await apiJson('update_version', {
      id: editingVersion.id,
      model_name: form.model_name || 'Disfluent ASR Engine',
      version: form.version,
      description: form.description || null,
      training_clips: form.training_clips ? Number(form.training_clips) : null,
      accuracy_pct: form.accuracy_pct ? Number(form.accuracy_pct) : null,
      latency_ms: form.latency_ms ? Number(form.latency_ms) : null,
      deployed: form.deployed,
      deployed_at: form.deployed_at || null,
      deprecated: form.deprecated,
    });
    setSavingForm(false);
    if (res.error) { setError(res.error); return; }
    let updated = versions.map(v => v.id === editingVersion.id ? res.data : v);
    if (form.deployed) {
      updated = updated.map(v => v.id === editingVersion.id ? v : { ...v, deployed: false, deployed_at: null });
    }
    setVersions(updated);
    setEditingVersion(null);
  }

  // ── Delete version ──────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const res = await apiJson('delete_version', { id });
      setDeletingId(null);
      if (res.error) { setError(res.error); return; }
      setVersions(prev => prev.filter(v => v.id !== id));
    });
  }

  function editFormValues(v: ModelVersion): VersionFormValues {
    return {
      model_name: v.model_name,
      version: v.version,
      description: v.description ?? '',
      training_clips: v.training_clips !== null ? String(v.training_clips) : '',
      accuracy_pct: v.accuracy_pct !== null ? String(v.accuracy_pct) : '',
      latency_ms: v.latency_ms !== null ? String(v.latency_ms) : '',
      deployed: v.deployed,
      deployed_at: v.deployed_at ? v.deployed_at.slice(0, 16) : '',
      deprecated: v.deprecated,
    };
  }

  function versionStatus(v: ModelVersion): { label: string; cls: string } {
    if (v.deployed && !v.deprecated) return { label: 'PRODUCTION', cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-pulse' };
    if (v.deprecated) return { label: 'DEPRECATED', cls: 'bg-slate-700/40 text-slate-500 border border-slate-700' };
    return { label: 'DEV', cls: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-white">Disfluent ASR Engine — Version Registry</h2>
        <p className="text-sm text-slate-500 mt-0.5">Proprietary fine-tuned speech model for disfluency detection and biofeedback</p>
      </div>

      {/* Production card */}
      {prodVersion ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900 border border-purple-500/30 rounded-2xl p-6">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-purple-600/15 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl font-black text-white font-mono">v{prodVersion.version}</span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  PRODUCTION
                </span>
              </div>
              <p className="text-sm text-slate-400">{prodVersion.model_name}</p>
              {prodVersion.description && (
                <p className="text-xs text-slate-500 mt-1">{prodVersion.description}</p>
              )}
              {prodVersion.deployed_at && (
                <p className="text-[10px] font-mono text-slate-600 mt-1">
                  Deployed: {fmtDate(prodVersion.deployed_at)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950/60 rounded-xl px-4 py-3 text-center">
                <p className="text-[9px] font-mono text-slate-500 uppercase mb-1">Training Clips</p>
                <p className="text-xl font-black text-amber-400">
                  {prodVersion.training_clips !== null
                    ? prodVersion.training_clips >= 1000
                      ? `${(prodVersion.training_clips / 1000).toFixed(0)}k`
                      : prodVersion.training_clips
                    : '—'}
                </p>
              </div>
              <div className="bg-slate-950/60 rounded-xl px-4 py-3 text-center">
                <p className="text-[9px] font-mono text-slate-500 uppercase mb-1">Accuracy</p>
                <p className="text-xl font-black text-emerald-400">
                  {prodVersion.accuracy_pct !== null ? `${prodVersion.accuracy_pct}%` : '—'}
                </p>
              </div>
              <div className="bg-slate-950/60 rounded-xl px-4 py-3 text-center">
                <p className="text-[9px] font-mono text-slate-500 uppercase mb-1">Latency</p>
                <p className="text-xl font-black text-sky-400">
                  {prodVersion.latency_ms !== null ? `${prodVersion.latency_ms}ms` : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-6 text-center">
          <p className="text-sm text-slate-600 font-mono">No production version deployed</p>
          <p className="text-xs text-slate-700 font-mono mt-1">Add a version and mark it as deployed to track production</p>
        </div>
      )}

      {/* Add form trigger */}
      <div>
        {!showAddForm && !editingVersion && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            + Add Version
          </button>
        )}

        {showAddForm && (
          <div className="mt-3">
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-3">New Version</p>
            {error && <p className="text-xs text-red-400 font-mono mb-3">{error}</p>}
            <VersionForm
              initial={BLANK_VERSION_FORM}
              onSave={handleAddSave}
              onCancel={() => { setShowAddForm(false); setError(null); }}
              saving={savingForm}
            />
          </div>
        )}

        {editingVersion && (
          <div className="mt-3">
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-3">Editing: v{editingVersion.version}</p>
            {error && <p className="text-xs text-red-400 font-mono mb-3">{error}</p>}
            <VersionForm
              initial={editFormValues(editingVersion)}
              onSave={handleEditSave}
              onCancel={() => { setEditingVersion(null); setError(null); }}
              saving={savingForm}
            />
          </div>
        )}
      </div>

      {/* Versions table */}
      {versions.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-slate-800 rounded-2xl">
          <p className="text-sm text-slate-600 font-mono">No model versions recorded yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide font-normal">Version</th>
                <th className="text-left py-3 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide font-normal">Training Clips</th>
                <th className="text-left py-3 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide font-normal">Accuracy</th>
                <th className="text-left py-3 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide font-normal">Latency</th>
                <th className="text-left py-3 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide font-normal">Status</th>
                <th className="text-left py-3 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide font-normal">Deployed</th>
                <th className="py-3 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {versions.map(v => {
                const { label, cls } = versionStatus(v);
                return (
                  <tr key={v.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 group transition-colors">
                    <td className="py-3 px-3">
                      <span className="text-white font-mono font-bold">v{v.version}</span>
                      {v.description && (
                        <p className="text-[10px] text-slate-600 mt-0.5 max-w-[160px] truncate">{v.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-amber-400 font-bold">
                      {v.training_clips !== null
                        ? v.training_clips >= 1000
                          ? `${(v.training_clips / 1000).toFixed(0)}k`
                          : v.training_clips
                        : '—'}
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-400">
                      {v.accuracy_pct !== null ? `${v.accuracy_pct}%` : '—'}
                    </td>
                    <td className="py-3 px-3 font-mono text-sky-400">
                      {v.latency_ms !== null ? `${v.latency_ms}ms` : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${cls}`}>
                        {label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] font-mono text-slate-600">
                      {fmtDate(v.deployed_at) ?? '—'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => { setEditingVersion(v); setShowAddForm(false); }}
                          className="px-2.5 py-1 text-[11px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(v.id)}
                          disabled={deletingId === v.id}
                          className="px-2 py-1 text-[11px] font-mono rounded-lg border border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

type Tab = 'register' | 'models';

interface Props {
  initialAssets: IPAsset[];
  initialVersions: ModelVersion[];
}

export default function IPClient({ initialAssets, initialVersions }: Props) {
  const [tab, setTab] = useState<Tab>('register');

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'register', label: 'IP Register', count: initialAssets.length },
    { id: 'models',   label: 'Model Registry', count: initialVersions.length },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-800 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-mono rounded-t-lg transition-colors flex items-center gap-2 -mb-px border-b-2 ${
              tab === t.id
                ? 'border-indigo-500 text-white bg-slate-800/50'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${tab === t.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'register' && (
        <IPRegisterTab assets={initialAssets} versions={initialVersions} />
      )}
      {tab === 'models' && (
        <ModelRegistryTab versions={initialVersions} />
      )}
    </div>
  );
}
