'use client';

import React, { useState, useTransition } from 'react';
import type { TrackingRow } from './page';
import { providerIdLabel, providerIdPlaceholder, type ProviderKey } from '@/lib/tracking-scripts';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiPut(payload: Record<string, unknown>): Promise<TrackingRow> {
  const res = await fetch('/api/admin/tracking', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json() as Promise<TrackingRow>;
}

function statusLabel(p: TrackingRow): { text: string; cls: string } {
  if (p.enabled && (p.pixel_id || p.head_html)) {
    return { text: 'Active', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
  }
  if (!p.pixel_id && !p.head_html) {
    return { text: 'Unconfigured', cls: 'bg-slate-700/50 text-slate-400 border-slate-300 dark:border-slate-700' };
  }
  return { text: 'Inactive', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${on ? 'bg-emerald-500' : 'bg-slate-700'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${on ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );
}

// ── Configure modal ───────────────────────────────────────────────────────────

function ConfigModal({
  provider,
  onClose,
  onSaved,
}: {
  provider: TrackingRow;
  onClose: () => void;
  onSaved: (updated: TrackingRow) => void;
}) {
  const isCustom = provider.provider_key === 'custom';
  const [tab, setTab] = useState<'quick' | 'custom'>(isCustom ? 'custom' : 'quick');
  const [pixelId, setPixelId] = useState(provider.pixel_id ?? '');
  const [capiToken, setCapiToken] = useState((provider.server_config?.capi_token as string) ?? '');
  const [headHtml, setHeadHtml] = useState(provider.head_html ?? '');
  const [bodyHtml, setBodyHtml] = useState(provider.body_html ?? '');
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const saveQuick = () => {
    if (!pixelId.trim()) { setError('Please enter an ID.'); return; }
    setError('');
    startTransition(async () => {
      try {
        const payload: Record<string, unknown> = { provider_key: provider.provider_key, pixel_id: pixelId.trim() };
        if (provider.provider_key === 'meta' && capiToken) {
          payload.server_config = { ...provider.server_config, capi_token: capiToken };
        }
        const updated = await apiPut(payload);
        onSaved(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
      }
    });
  };

  const saveCustom = () => {
    if (!headHtml.trim() && !bodyHtml.trim()) { setError('Enter at least one script.'); return; }
    setError('');
    startTransition(async () => {
      try {
        const updated = await apiPut({
          provider_key: provider.provider_key,
          head_html: headHtml || null,
          body_html: bodyHtml || null,
        });
        onSaved(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <span className="text-3xl">{provider.icon}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-slate-900 dark:text-white font-bold text-lg leading-tight">{provider.label}</h2>
            <p className="text-slate-400 text-xs mt-0.5">Configuration</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
          </button>
        </div>

        {/* Tabs */}
        {!isCustom && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 shrink-0">
            {(['quick', 'custom'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                {t === 'quick' ? 'Quick Setup' : 'Custom Code'}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {tab === 'quick' && !isCustom && (
            <>
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">
                  {providerIdLabel(provider.provider_key as ProviderKey)}
                </label>
                <input
                  type="text"
                  value={pixelId}
                  onChange={e => setPixelId(e.target.value)}
                  placeholder={providerIdPlaceholder(provider.provider_key as ProviderKey)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white font-mono text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                {provider.pixel_id && (
                  <p className="text-slate-500 text-xs mt-2 font-mono">Current: {provider.pixel_id}</p>
                )}
              </div>

              {provider.provider_key === 'meta' && (
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">
                    CAPI Access Token <span className="text-slate-600 normal-case">(optional — server-side events)</span>
                  </label>
                  <input
                    type="password"
                    value={capiToken}
                    onChange={e => setCapiToken(e.target.value)}
                    placeholder="EAAxxxxxxxxxxxxxxxx..."
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white font-mono text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <p className="text-slate-600 text-xs mt-1.5">Stored server-side only. Enables Meta Conversions API for higher-signal event matching.</p>
                </div>
              )}

              <button
                onClick={saveQuick}
                disabled={isPending}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold py-2.5 rounded-xl transition-colors text-sm"
              >
                {isPending ? 'Saving…' : 'Save & Generate Script'}
              </button>
            </>
          )}

          {(tab === 'custom' || isCustom) && (
            <>
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">
                  {'<head>'} Script
                </label>
                <textarea
                  rows={6}
                  value={headHtml}
                  onChange={e => setHeadHtml(e.target.value)}
                  placeholder={'<script>/* your head script */</script>'}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors resize-y"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">
                  {'<body>'} Script <span className="text-slate-600 normal-case">(noscript fallbacks etc.)</span>
                </label>
                <textarea
                  rows={4}
                  value={bodyHtml}
                  onChange={e => setBodyHtml(e.target.value)}
                  placeholder={'<noscript>...</noscript>'}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors resize-y"
                />
              </div>
              <button
                onClick={saveCustom}
                disabled={isPending}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold py-2.5 rounded-xl transition-colors text-sm"
              >
                {isPending ? 'Saving…' : 'Save Custom Code'}
              </button>
            </>
          )}

          {error && (
            <p className="text-red-400 text-xs font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Script preview */}
          {provider.head_html && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <button
                onClick={() => setShowPreview(p => !p)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${showPreview ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd"/></svg>
                Script preview
              </button>
              {showPreview && (
                <pre className="mt-3 bg-slate-50 dark:bg-slate-950 rounded-xl px-4 py-3 text-[10px] text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed border border-slate-200 dark:border-slate-800">
                  {provider.head_html.slice(0, 600)}{provider.head_html.length > 600 ? '…' : ''}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Provider card ─────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  onToggle,
  onConfigure,
  isPending,
}: {
  provider: TrackingRow;
  onToggle: () => void;
  onConfigure: () => void;
  isPending: boolean;
}) {
  const { text, cls } = statusLabel(provider);
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none shrink-0">{provider.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-900 dark:text-white font-semibold text-sm leading-tight">{provider.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${cls}`}>{text}</span>
          </div>
          <p className="text-slate-500 text-xs mt-1 leading-snug">{provider.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Toggle
            on={provider.enabled}
            onChange={onToggle}
            disabled={isPending || (!provider.pixel_id && !provider.head_html)}
          />
          <span className="text-xs text-slate-500">{provider.enabled ? 'Live' : 'Off'}</span>
        </div>
        <button
          onClick={onConfigure}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 transition-colors"
        >
          Configure
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TrackingClient({ initialProviders }: { initialProviders: TrackingRow[] }) {
  const [providers, setProviders] = useState(initialProviders);
  const [modal, setModal] = useState<TrackingRow | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const update = (updated: TrackingRow) =>
    setProviders(ps => ps.map(p => p.provider_key === updated.provider_key ? updated : p));

  const handleToggle = (p: TrackingRow) => {
    setPendingKey(p.provider_key);
    startTransition(async () => {
      try {
        const updated = await apiPut({ provider_key: p.provider_key, enabled: !p.enabled });
        update(updated);
      } catch {}
      setPendingKey(null);
    });
  };

  const activeCount = providers.filter(p => p.enabled).length;

  return (
    <>
      {modal && (
        <ConfigModal
          provider={modal}
          onClose={() => setModal(null)}
          onSaved={updated => { update(updated); setModal(updated); }}
        />
      )}

      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Tracking & Pixels</h1>
            <p className="text-slate-400 text-sm mt-1">Manage marketing pixels, analytics, and session recording</p>
          </div>
          <span className="self-start sm:self-auto px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700">
            {activeCount} active
          </span>
        </div>

        {/* GTM recommendation */}
        <div className="flex gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3.5">
          <span className="text-lg shrink-0">💡</span>
          <div>
            <p className="text-amber-400 text-sm font-medium">Recommended: Use Google Tag Manager</p>
            <p className="text-slate-400 text-xs mt-0.5">Enable GTM and manage all ad pixels from a single GTM workspace — no code deploys required. Individual pixels below are for teams not using GTM.</p>
          </div>
        </div>

        {/* Consent notice */}
        <div className="flex gap-3 bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3.5">
          <span className="text-lg shrink-0">🍪</span>
          <div>
            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">Cookie consent gated</p>
            <p className="text-slate-500 text-xs mt-0.5">All pixels below fire only after a user accepts cookies. Compliant with PECR 2003 and GDPR by default.</p>
          </div>
        </div>

        {/* Provider grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map(p => (
            <ProviderCard
              key={p.provider_key}
              provider={p}
              onToggle={() => handleToggle(p)}
              onConfigure={() => setModal(p)}
              isPending={pendingKey === p.provider_key}
            />
          ))}
        </div>

        {/* Server-side section */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Server-Side Tracking</h2>
          <p className="text-slate-400 text-sm mb-5">
            API-based event forwarding that bypasses ad blockers and works with consent mode.
            Configure provider API tokens via the <strong className="text-slate-600 dark:text-slate-300">Configure</strong> button on each pixel above.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: '🎯',
                label: 'Meta Conversions API',
                desc: 'Add CAPI Access Token in the Meta Pixel configure modal to enable server-side event matching.',
                status: providers.find(p => p.provider_key === 'meta')?.server_config?.capi_token ? 'configured' : 'not_set',
              },
            ].map(item => (
              <div key={item.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{item.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 dark:text-white font-semibold text-sm">{item.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${item.status === 'configured' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-300 dark:border-slate-700'}`}>
                        {item.status === 'configured' ? 'Configured' : 'Not set'}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs mt-1.5 leading-snug">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
