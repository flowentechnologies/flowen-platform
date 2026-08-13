'use client';

import React, { useState, useCallback } from 'react';
import type { FeatureFlag } from '@/app/api/admin/feature-flags/route';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_TIERS = ['founding', 'standard', 'public_funds', 'vocali_freemium'] as const;
type Tier = (typeof ALL_TIERS)[number];

const TIER_STYLES: Record<Tier, string> = {
  founding: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  standard: 'bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-600',
  public_funds: 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
  vocali_freemium: 'bg-violet-500/10 text-violet-400 border border-violet-500/30',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? 'bg-emerald-500' : 'bg-slate-700'
      }`}
      style={{ width: 36, height: 20 }}
    >
      <span
        className={`pointer-events-none inline-block rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`}
        style={{ width: 16, height: 16, marginTop: 2 }}
      />
    </button>
  );
}

// ── Create / Edit Form ────────────────────────────────────────────────────────

interface FormState {
  key: string;
  name: string;
  description: string;
  rollout_pct: number;
  allowed_tiers: Tier[];
}

const EMPTY_FORM: FormState = {
  key: '',
  name: '',
  description: '',
  rollout_pct: 100,
  allowed_tiers: [],
};

function flagToForm(flag: FeatureFlag): FormState {
  return {
    key: flag.key,
    name: flag.name,
    description: flag.description ?? '',
    rollout_pct: flag.rollout_pct,
    allowed_tiers: (flag.allowed_tiers ?? []) as Tier[],
  };
}

interface FlagFormProps {
  editing: FeatureFlag | null;
  onSubmit: (form: FormState) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

function FlagForm({ editing, onSubmit, onCancel, submitting }: FlagFormProps) {
  const [form, setForm] = useState<FormState>(editing ? flagToForm(editing) : EMPTY_FORM);

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function toggleTier(tier: Tier) {
    setForm((prev) => ({
      ...prev,
      allowed_tiers: prev.allowed_tiers.includes(tier)
        ? prev.allowed_tiers.filter((t) => t !== tier)
        : [...prev.allowed_tiers, tier],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(form);
  }

  const isCreate = !editing;

  return (
    <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 mt-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
        {isCreate ? 'Create flag' : `Edit: ${editing?.name}`}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Key */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Flag key (snake_case)
            </label>
            <input
              type="text"
              value={form.key}
              onChange={(e) => setField('key', e.target.value)}
              readOnly={!isCreate}
              required
              placeholder="new_onboarding_flow"
              className={`w-full rounded-lg border px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 ${
                !isCreate
                  ? 'border-slate-300 dark:border-slate-700 opacity-60 cursor-not-allowed'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-600'
              }`}
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Display name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              required
              placeholder="New Onboarding Flow"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-600 px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Description <span className="text-slate-600">(optional)</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={2}
            placeholder="What does this flag control?"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-600 px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
          />
        </div>

        {/* Rollout */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Rollout %
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.rollout_pct}
            onChange={(e) => setField('rollout_pct', Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
            className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-600 px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <p className="mt-1 text-[10px] text-slate-600">100 = all eligible users</p>
        </div>

        {/* Tiers */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">
            Allowed tiers{' '}
            <span className="text-slate-600">(none checked = all tiers)</span>
          </label>
          <div className="flex flex-wrap gap-3">
            {ALL_TIERS.map((tier) => (
              <label key={tier} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.allowed_tiers.includes(tier)}
                  onChange={() => toggleTier(tier)}
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                />
                <span className="text-xs text-slate-600 dark:text-slate-300">{tier}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : isCreate ? 'Create Flag' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────

export function FeatureFlagsClient({ initialFlags }: { initialFlags: FeatureFlag[] }) {
  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags);
  const [showForm, setShowForm] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const res = await fetch('/api/admin/feature-flags');
    if (res.ok) {
      const json = (await res.json()) as { flags: FeatureFlag[] };
      setFlags(json.flags);
    }
  }, []);

  async function callApi(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch('/api/admin/feature-flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const json = (await res.json()) as { error?: string };
    return { ok: false, error: json.error ?? 'Something went wrong' };
  }

  async function handleToggle(flag: FeatureFlag) {
    if (togglingIds.has(flag.id)) return;
    setError(null);

    // Optimistic update
    setFlags((prev) =>
      prev.map((f) => (f.id === flag.id ? { ...f, enabled: !f.enabled } : f)),
    );
    setTogglingIds((prev) => new Set(prev).add(flag.id));

    const result = await callApi({ action: 'toggle', id: flag.id });
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.delete(flag.id);
      return next;
    });

    if (!result.ok) {
      // Revert
      setFlags((prev) =>
        prev.map((f) => (f.id === flag.id ? { ...f, enabled: flag.enabled } : f)),
      );
      setError(result.error ?? 'Toggle failed');
    } else {
      await refetch();
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    const result = await callApi({ action: 'delete', id });
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (!result.ok) {
      setError(result.error ?? 'Delete failed');
    } else {
      await refetch();
    }
  }

  async function handleFormSubmit(form: FormState) {
    setSubmitting(true);
    setError(null);

    let result: { ok: boolean; error?: string };
    if (editingFlag) {
      result = await callApi({
        action: 'update',
        id: editingFlag.id,
        name: form.name,
        description: form.description || null,
        rollout_pct: form.rollout_pct,
        allowed_tiers: form.allowed_tiers.length > 0 ? form.allowed_tiers : null,
      });
    } else {
      result = await callApi({
        action: 'create',
        key: form.key,
        name: form.name,
        description: form.description || null,
        rollout_pct: form.rollout_pct,
        allowed_tiers: form.allowed_tiers.length > 0 ? form.allowed_tiers : null,
      });
    }

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save flag');
    } else {
      setShowForm(false);
      setEditingFlag(null);
      await refetch();
    }
  }

  function openCreate() {
    setEditingFlag(null);
    setShowForm(true);
    setError(null);
  }

  function openEdit(flag: FeatureFlag) {
    setEditingFlag(flag);
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingFlag(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Feature Flags</h1>
          <p className="mt-1 text-sm text-slate-400">
            Control which features are enabled per tier or rollout percentage
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="shrink-0 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-xs font-semibold transition-colors"
        >
          New Flag
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <FlagForm
          editing={editingFlag}
          onSubmit={handleFormSubmit}
          onCancel={closeForm}
          submitting={submitting}
        />
      )}

      {/* Table */}
      {flags.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900/50 py-16 text-center">
          <p className="text-sm text-slate-500">No flags yet — create your first</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    Key / Name
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    Status
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    Rollout
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    Tiers
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    Updated
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {flags.map((flag) => (
                  <tr key={flag.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Key / Name */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-200 text-[11px]">{flag.key}</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">{flag.name}</p>
                    </td>

                    {/* Toggle */}
                    <td className="px-4 py-3">
                      <ToggleSwitch
                        enabled={flag.enabled}
                        onChange={() => handleToggle(flag)}
                        disabled={togglingIds.has(flag.id)}
                      />
                    </td>

                    {/* Rollout */}
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono font-medium ${
                          flag.rollout_pct < 100 ? 'text-amber-400' : 'text-slate-400'
                        }`}
                      >
                        {flag.rollout_pct}%
                      </span>
                    </td>

                    {/* Tiers */}
                    <td className="px-4 py-3">
                      {!flag.allowed_tiers || flag.allowed_tiers.length === 0 ? (
                        <span className="text-slate-500">All tiers</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {flag.allowed_tiers.map((tier) => (
                            <span
                              key={tier}
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                TIER_STYLES[tier as Tier] ?? 'bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-600'
                              }`}
                            >
                              {tier}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Updated */}
                    <td className="px-4 py-3 text-slate-500">
                      {relativeTime(flag.updated_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {confirmDeleteId === flag.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-[10px]">Confirm?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(flag.id)}
                            disabled={deletingId === flag.id}
                            className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                          >
                            {deletingId === flag.id ? '...' : 'Yes'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-600 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => openEdit(flag)}
                            title="Edit"
                            className="text-slate-500 hover:text-slate-200 transition-colors"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 20 20"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(flag.id)}
                            title="Delete"
                            className="text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 20 20"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 19 6" />
                              <path d="M19 6l-1 12a2 2 0 01-2 2H6a2 2 0 01-2-2L3 6" />
                              <path d="M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
