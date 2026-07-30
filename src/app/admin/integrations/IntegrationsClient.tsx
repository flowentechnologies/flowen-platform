'use client';

import React, { useState, useTransition } from 'react';
import type { ApiKeyRow, WebhookEventRow, IntegrationDef } from './page';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'services' | 'api_keys' | 'webhooks';

const AVAILABLE_SCOPES = [
  'read:users',
  'write:users',
  'read:content',
  'write:content',
  'read:billing',
  'write:billing',
  'read:analytics',
  'admin:full',
] as const;

type Scope = typeof AVAILABLE_SCOPES[number];

interface NewKeyResult {
  id: string;
  plaintext: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateShort(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

async function apiPost(action: string, payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/integrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: IntegrationDef['status'] }) {
  const cfg = {
    connected: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    missing:   'bg-slate-700/50 text-slate-400 border-slate-600/30',
    error:     'bg-red-500/10 text-red-400 border-red-500/30',
  }[status];
  const label = { connected: 'Connected', missing: 'Missing', error: 'Error' }[status];
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${cfg}`}>
      {label}
    </span>
  );
}

// ── Services tab ──────────────────────────────────────────────────────────────

function ServicesTab({ integrations }: { integrations: IntegrationDef[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {integrations.map(svc => (
        <div
          key={svc.name}
          className={`bg-slate-900 border rounded-2xl p-5 flex flex-col gap-3 ${
            svc.status === 'connected' ? 'border-slate-800' :
            svc.status === 'error'    ? 'border-red-500/30' :
                                        'border-slate-800/50'
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  svc.status === 'connected' ? 'bg-emerald-400' :
                  svc.status === 'error'     ? 'bg-red-400 animate-pulse' :
                                              'bg-slate-600'
                }`} />
                <p className="text-sm font-bold text-white">{svc.name}</p>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400">
                {svc.category}
              </span>
            </div>
            <StatusBadge status={svc.status} />
          </div>

          {/* Description */}
          <p className="text-[11px] text-slate-500 leading-relaxed">{svc.description}</p>

          {/* Env vars */}
          <div className="space-y-1">
            {svc.envVars.map(v => (
              <p key={v} className="text-[10px] font-mono text-slate-600">{v}</p>
            ))}
          </div>

          {/* Latency (Stripe only) */}
          {svc.latencyMs !== null && (
            <div className="pt-2 border-t border-slate-800">
              <p className="text-[10px] font-mono text-slate-500">
                Latency: <span className={`font-bold ${svc.latencyMs < 500 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {svc.latencyMs}ms
                </span>
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Create API key modal ───────────────────────────────────────────────────────

function CreateKeyModal({ onCreated }: { onCreated: (key: NewKeyResult) => void }) {
  const [open, setOpen]       = useState(false);
  const [name, setName]       = useState('');
  const [scopes, setScopes]   = useState<Scope[]>([]);
  const [expiry, setExpiry]   = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [isPending, start]    = useTransition();

  function toggleScope(s: Scope) {
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function submit() {
    if (!name.trim()) { setError('Name is required'); return; }
    if (scopes.length === 0) { setError('Select at least one scope'); return; }
    setError(null);
    start(async () => {
      const res = await apiPost('create_api_key', {
        name: name.trim(),
        scopes,
        expires_at: expiry || null,
      });
      if (res.error) { setError(res.error as string); return; }
      onCreated(res.data as NewKeyResult);
      setOpen(false);
      setName('');
      setScopes([]);
      setExpiry('');
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
      >
        + New API Key
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Create API Key</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Key Name *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Mobile App v2"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Scopes *</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {AVAILABLE_SCOPES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleScope(s)}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-colors ${
                        scopes.includes(s)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Expires (optional)</label>
                <input
                  type="date"
                  value={expiry}
                  onChange={e => setExpiry(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60"
                />
              </div>
              {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40"
              >
                {isPending ? 'Generating…' : 'Create Key'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── New key reveal modal ──────────────────────────────────────────────────────

function RevealModal({ result, onClose }: { result: NewKeyResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(result.plaintext).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-emerald-400">API Key Created</h3>
          <p className="text-xs text-slate-500 mt-0.5">Copy this key now — it will not be shown again.</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Key Name</p>
            <p className="text-sm text-white font-semibold">{result.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Secret Key</p>
            <div className="bg-slate-800 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <code className="flex-1 text-[11px] font-mono text-emerald-300 break-all">{result.plaintext}</code>
              <button
                type="button"
                onClick={copy}
                className="shrink-0 px-3 py-1.5 text-[10px] font-mono rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1">Scopes</p>
            <div className="flex flex-wrap gap-1">
              {result.scopes.map(s => (
                <span key={s} className="px-2 py-0.5 rounded text-[9px] font-mono bg-indigo-500/10 text-indigo-300">{s}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-mono rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors"
          >
            I&apos;ve saved the key
          </button>
        </div>
      </div>
    </div>
  );
}

// ── API keys tab ──────────────────────────────────────────────────────────────

function ApiKeysTab({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [keys, setKeys]           = useState<ApiKeyRow[]>(initialKeys);
  const [newKey, setNewKey]       = useState<NewKeyResult | null>(null);
  const [isPending, start]        = useTransition();

  function handleCreated(result: NewKeyResult) {
    const newRow: ApiKeyRow = {
      id:          result.id,
      name:        result.name,
      key_prefix:  result.key_prefix,
      scopes:      result.scopes,
      expires_at:  result.expires_at,
      last_used_at: null,
      revoked:     false,
      created_at:  result.created_at,
    };
    setKeys(prev => [newRow, ...prev]);
    setNewKey(result);
  }

  function handleRevoke(id: string) {
    start(async () => {
      const res = await apiPost('revoke_key', { id });
      if (!res.error) {
        setKeys(prev => prev.map(k => k.id === id ? { ...k, revoked: true } : k));
      }
    });
  }

  function handleDelete(id: string) {
    start(async () => {
      const res = await apiPost('delete_key', { id });
      if (!res.error) {
        setKeys(prev => prev.filter(k => k.id !== id));
      }
    });
  }

  return (
    <div className="space-y-4">
      {newKey && <RevealModal result={newKey} onClose={() => setNewKey(null)} />}

      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-slate-500">
          {keys.filter(k => !k.revoked).length} active · {keys.filter(k => k.revoked).length} revoked
        </p>
        <CreateKeyModal onCreated={handleCreated} />
      </div>

      {keys.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-600 font-mono">No API keys — create your first above</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden sm:table-cell">Key</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden md:table-cell">Scopes</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden lg:table-cell">Expires</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden lg:table-cell">Last used</th>
                <th className="text-right px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Status</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} className={`border-b border-slate-800/60 last:border-0 ${k.revoked ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{k.name}</p>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">{k.created_at ? fmtDateShort(k.created_at) : ''}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <code className="text-[11px] font-mono text-slate-400">
                      {k.key_prefix}••••••••
                    </code>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.slice(0, 3).map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400">{s}</span>
                      ))}
                      {k.scopes.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-500">+{k.scopes.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500 font-mono">
                    {fmtDateShort(k.expires_at)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500 font-mono">
                    {fmtDate(k.last_used_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                      k.revoked
                        ? 'bg-slate-700/50 text-slate-500 border-slate-600/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {k.revoked ? 'Revoked' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {!k.revoked && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(k.id)}
                          disabled={isPending}
                          className="text-[10px] font-mono text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-40"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(k.id)}
                        disabled={isPending}
                        className="text-[10px] font-mono text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Webhooks tab ──────────────────────────────────────────────────────────────

function WebhooksTab({
  webhookEvents,
  webhookTypes,
  totalWebhooks,
}: {
  webhookEvents: WebhookEventRow[];
  webhookTypes: Record<string, number>;
  totalWebhooks: number;
}) {
  return (
    <div className="space-y-6">
      {/* Type breakdown */}
      {Object.keys(webhookTypes).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white">Event Type Breakdown</h3>
          </div>
          <div className="p-5 space-y-2.5">
            {Object.entries(webhookTypes)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-400 w-56 truncate">{type}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(count / Math.max(...Object.values(webhookTypes))) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 w-8 text-right">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent events */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Recent Events</h3>
          <span className="text-[10px] font-mono text-slate-500">{totalWebhooks} total · showing {webhookEvents.length}</span>
        </div>
        <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
          {webhookEvents.length === 0 ? (
            <p className="px-5 py-8 text-xs text-slate-500 text-center font-mono">No webhook events recorded</p>
          ) : webhookEvents.map(w => (
            <div key={w.event_id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-white font-mono truncate">{w.event_type}</p>
                <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">{w.event_id}</p>
              </div>
              <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap shrink-0">
                {fmtDate(w.processed_at)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main client board ─────────────────────────────────────────────────────────

interface Props {
  integrations:  IntegrationDef[];
  apiKeys:       ApiKeyRow[];
  webhookEvents: WebhookEventRow[];
  webhookTypes:  Record<string, number>;
  totalWebhooks: number;
}

export function IntegrationsClient({
  integrations,
  apiKeys,
  webhookEvents,
  webhookTypes,
  totalWebhooks,
}: Props) {
  const [tab, setTab] = useState<Tab>('services');

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'services',  label: 'Services',  count: integrations.length },
    { id: 'api_keys',  label: 'API Keys',  count: apiKeys.length },
    { id: 'webhooks',  label: 'Webhooks',  count: totalWebhooks },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-4 border-b border-slate-800">
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
            {t.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                tab === t.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {tab === 'services'  && <ServicesTab integrations={integrations} />}
        {tab === 'api_keys'  && <ApiKeysTab initialKeys={apiKeys} />}
        {tab === 'webhooks'  && (
          <WebhooksTab
            webhookEvents={webhookEvents}
            webhookTypes={webhookTypes}
            totalWebhooks={totalWebhooks}
          />
        )}
      </div>
    </div>
  );
}
