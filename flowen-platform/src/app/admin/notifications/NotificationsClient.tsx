'use client';

import React, { useState, useTransition, useCallback } from 'react';
import type { AlertRule, AlertHistoryEntry } from '@/app/api/admin/notifications/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Rule type metadata ────────────────────────────────────────────────────────

const RULE_META: Record<
  AlertRule['rule_type'],
  { label: string; color: string; description: string; hasThresholdDays: boolean; hasThresholdCount: boolean }
> = {
  grant_deadline: {
    label: 'Grant Deadline',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    description: 'Alerts when a grant in "researching" or "drafting" status has a deadline within N days.',
    hasThresholdDays: true,
    hasThresholdCount: false,
  },
  gdpr_overdue: {
    label: 'GDPR Overdue',
    color: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    description: 'Alerts when a GDPR request has been open for more than N days (UK GDPR: 30-day limit).',
    hasThresholdDays: true,
    hasThresholdCount: false,
  },
  hazard_open_critical: {
    label: 'Critical Hazard',
    color: 'bg-red-500/15 text-red-400 border-red-500/30',
    description: 'Alerts when any critical or high-risk hazard remains open and unmitigated in the hazard log.',
    hasThresholdDays: false,
    hasThresholdCount: false,
  },
  at_risk_users: {
    label: 'At-Risk Users',
    color: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    description: 'Alerts when the number of onboarded users with no session in 14+ days exceeds the threshold.',
    hasThresholdDays: false,
    hasThresholdCount: true,
  },
  no_new_signups: {
    label: 'No Signups',
    color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    description: 'Alerts when no new users have signed up within N days.',
    hasThresholdDays: true,
    hasThresholdCount: false,
  },
  mrr_drop: {
    label: 'MRR Drop',
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    description: 'Alerts when monthly recurring revenue drops by more than N%. Requires 2+ months of data.',
    hasThresholdDays: false,
    hasThresholdCount: false,
  },
  user_retention_drop: {
    label: 'Retention Drop',
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    description: 'Alerts when user retention drops below the threshold. Requires historical session data.',
    hasThresholdDays: false,
    hasThresholdCount: false,
  },
};

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        enabled ? 'bg-emerald-500' : 'bg-slate-700'
      }`}
      aria-label={enabled ? 'Disable rule' : 'Enable rule'}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          enabled ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Check results panel ───────────────────────────────────────────────────────

interface CheckResult {
  rule_name: string;
  triggered: boolean;
  message: string;
}

function CheckResultsPanel({
  results,
  onDismiss,
}: {
  results: CheckResult[];
  onDismiss: () => void;
}) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Check Results</h3>
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-500 hover:text-slate-300 text-xs"
        >
          Dismiss
        </button>
      </div>
      <div className="space-y-2">
        {results.map((r, i) => (
          <div
            key={i}
            className={`flex gap-3 items-start rounded-lg px-3 py-2 text-xs ${
              r.triggered
                ? 'bg-amber-500/10 border border-amber-500/20'
                : 'bg-slate-800/60'
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {r.triggered ? (
                <span className="text-amber-400 font-bold">TRIGGERED</span>
              ) : (
                <span className="text-emerald-400 font-bold">OK</span>
              )}
            </span>
            <div>
              <span className="font-semibold text-white">{r.rule_name}</span>
              <span className="text-slate-400"> — {r.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Add rule form ─────────────────────────────────────────────────────────────

type RuleType = AlertRule['rule_type'];

const RULE_TYPES: RuleType[] = [
  'grant_deadline',
  'gdpr_overdue',
  'hazard_open_critical',
  'at_risk_users',
  'no_new_signups',
  'mrr_drop',
  'user_retention_drop',
];

function AddRuleForm({
  onSave,
  onCancel,
}: {
  onSave: (rule: Partial<AlertRule>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState<RuleType>('grant_deadline');
  const [recipientEmail, setRecipientEmail] = useState('hello@flowen.digital');
  const [thresholdDays, setThresholdDays] = useState('7');
  const [thresholdCount, setThresholdCount] = useState('5');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const meta = RULE_META[ruleType];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!name.trim() || !recipientEmail.trim()) {
      setErr('Name and recipient email are required.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        rule_type: ruleType,
        recipient_email: recipientEmail.trim(),
        threshold_days: meta.hasThresholdDays ? parseInt(thresholdDays) || null : null,
        threshold_count: meta.hasThresholdCount ? parseInt(thresholdCount) || null : null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-white">Add Alert Rule</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Rule Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grant Deadline Warning"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Recipient Email <span className="text-rose-400">*</span>
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">
          Rule Type <span className="text-rose-400">*</span>
        </label>
        <select
          value={ruleType}
          onChange={(e) => setRuleType(e.target.value as RuleType)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          {RULE_TYPES.map((t) => (
            <option key={t} value={t}>
              {RULE_META[t].label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-slate-500">{meta.description}</p>
      </div>

      {meta.hasThresholdDays && (
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Threshold (days)
          </label>
          <input
            type="number"
            min="1"
            max="365"
            value={thresholdDays}
            onChange={(e) => setThresholdDays(e.target.value)}
            className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
      )}

      {meta.hasThresholdCount && (
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Threshold (count) — alert when count exceeds this
          </label>
          <input
            type="number"
            min="1"
            value={thresholdCount}
            onChange={(e) => setThresholdCount(e.target.value)}
            className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
      )}

      {err && <p className="text-rose-400 text-xs">{err}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Rule'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Rule card ─────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onDelete,
}: {
  rule: AlertRule;
  onToggle: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const meta = RULE_META[rule.rule_type] ?? {
    label: rule.rule_type,
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    description: '',
    hasThresholdDays: false,
    hasThresholdCount: false,
  };

  function thresholdLabel(): string {
    if (meta.hasThresholdDays && rule.threshold_days != null) {
      return `Alert ${rule.threshold_days} days before deadline`;
    }
    if (meta.hasThresholdCount && rule.threshold_count != null) {
      return `Alert when count > ${rule.threshold_count}`;
    }
    return 'No threshold';
  }

  async function handleToggle() {
    setToggling(true);
    try { await onToggle(rule.id); } finally { setToggling(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete rule "${rule.name}"? This will also remove all history.`)) return;
    setDeleting(true);
    try { await onDelete(rule.id); } finally { setDeleting(false); }
  }

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 space-y-3 transition-opacity ${!rule.enabled ? 'opacity-60' : ''} ${rule.enabled ? 'border-slate-800' : 'border-slate-800/50'}`}>
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <Toggle enabled={rule.enabled} onChange={toggling ? () => {} : handleToggle} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-bold text-sm text-white">{rule.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${meta.color}`}>
              {meta.label}
            </span>
            {!rule.enabled && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-700/50 text-slate-500 border border-slate-700">
                DISABLED
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>{thresholdLabel()}</span>
            <span className="font-mono">{rule.recipient_email}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-40"
            aria-label="Delete rule"
          >
            {deleting ? '…' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] border-t border-slate-800 pt-2.5">
        <div>
          <span className="text-slate-600 font-semibold">Last triggered:</span>{' '}
          {rule.last_triggered_at ? (
            <span className="text-amber-400">{timeAgo(rule.last_triggered_at)}</span>
          ) : (
            <span className="text-emerald-400">Never triggered</span>
          )}
        </div>
        <div>
          <span className="text-slate-600 font-semibold">Last checked:</span>{' '}
          <span className="text-slate-400">{timeAgo(rule.last_checked_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Cron note ─────────────────────────────────────────────────────────────────

function CronNote() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
      >
        <span>Cron / Scheduled checks setup</span>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-400">
            To run checks automatically every day at 08:00 UTC, add this to your{' '}
            <code className="text-emerald-400 bg-slate-800 px-1 py-0.5 rounded">vercel.json</code>:
          </p>
          <pre className="bg-slate-800 rounded-lg p-3 text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap">
{`{
  "crons": [
    {
      "path": "/api/admin/notifications/cron",
      "schedule": "0 8 * * *"
    }
  ]
}`}
          </pre>
          <p className="text-xs text-slate-400">
            Also set the{' '}
            <code className="text-amber-400 bg-slate-800 px-1 py-0.5 rounded">CRON_SECRET</code>{' '}
            environment variable — the cron endpoint validates the{' '}
            <code className="text-amber-400 bg-slate-800 px-1 py-0.5 rounded">x-cron-secret</code>{' '}
            header against this value to prevent unauthorised triggering.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

interface Props {
  initialRules: AlertRule[];
  initialHistory: AlertHistoryEntry[];
}

export function NotificationsClient({ initialRules, initialHistory }: Props) {
  const [rules, setRules] = useState<AlertRule[]>(initialRules);
  const [history, setHistory] = useState<AlertHistoryEntry[]>(initialHistory);
  const [showAddForm, setShowAddForm] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null);
  const [checking, startChecking] = useTransition();
  const [runError, setRunError] = useState('');

  // ── Derived: last checked + triggered summary ─────────────────────────────
  const checkedRules = rules.filter((r) => r.last_checked_at);
  const latestChecked =
    checkedRules.length > 0
      ? checkedRules.reduce((a, b) =>
          (a.last_checked_at ?? '') > (b.last_checked_at ?? '') ? a : b,
        )
      : null;
  const triggeredCount = rules.filter((r) => r.last_triggered_at && r.last_checked_at && r.last_triggered_at >= (r.last_checked_at ?? '')).length;

  // ── Refresh state from API ────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json() as { rules: AlertRule[]; history: AlertHistoryEntry[] };

      // Re-attach history per rule
      const historyByRule: Record<string, AlertHistoryEntry[]> = {};
      for (const h of data.history) {
        if (!historyByRule[h.rule_id]) historyByRule[h.rule_id] = [];
        if (historyByRule[h.rule_id].length < 3) historyByRule[h.rule_id].push(h);
      }
      const enriched = data.rules.map((r) => ({ ...r, history: historyByRule[r.id] ?? [] }));

      setRules(enriched);
      setHistory(data.history);
    } catch { /* non-fatal */ }
  }, []);

  // ── Run all checks ────────────────────────────────────────────────────────
  function handleRunChecks() {
    setRunError('');
    startChecking(async () => {
      try {
        const res = await fetch('/api/admin/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_now' }),
        });
        const data = await res.json() as { results?: CheckResult[]; error?: string };
        if (!res.ok) {
          setRunError(data.error ?? 'Check failed');
          return;
        }
        setCheckResults(data.results ?? []);
        await refresh();
      } catch (e) {
        setRunError(e instanceof Error ? e.message : 'Network error');
      }
    });
  }

  // ── Toggle rule ───────────────────────────────────────────────────────────
  async function handleToggle(id: string) {
    const res = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', id }),
    });
    if (res.ok) {
      const data = await res.json() as { rule: AlertRule };
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.rule, history: r.history } : r)));
    }
  }

  // ── Delete rule ───────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    const res = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    if (res.ok) {
      setRules((prev) => prev.filter((r) => r.id !== id));
      setHistory((prev) => prev.filter((h) => h.rule_id !== id));
    }
  }

  // ── Add rule ──────────────────────────────────────────────────────────────
  async function handleAdd(partial: Partial<AlertRule>) {
    const res = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', ...partial }),
    });
    const data = await res.json() as { rule?: AlertRule; error?: string };
    if (!res.ok) throw new Error(data.error ?? 'Add failed');
    if (data.rule) {
      setRules((prev) => [...prev, { ...data.rule!, history: [] }]);
    }
    setShowAddForm(false);
  }

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {/* Last check banner */}
          {latestChecked ? (
            <p className="text-sm text-slate-400">
              Last checked:{' '}
              <span className="text-white font-semibold">{timeAgo(latestChecked.last_checked_at)}</span>
              {' · '}
              <span className={triggeredCount > 0 ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
                {triggeredCount} rule{triggeredCount !== 1 ? 's' : ''} triggered
              </span>
            </p>
          ) : (
            <p className="inline-flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
              <span className="font-bold">Rules have never been checked</span>
              <span className="text-amber-300/70">— click Run Checks to evaluate now.</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRunChecks}
          disabled={checking}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60"
        >
          {checking ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running…
            </>
          ) : (
            'Run All Checks Now'
          )}
        </button>
      </div>

      {runError && (
        <p className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-2">
          {runError}
        </p>
      )}

      {/* Check results panel */}
      {checkResults && (
        <CheckResultsPanel results={checkResults} onDismiss={() => setCheckResults(null)} />
      )}

      {/* Rules list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest font-mono">
            Rules ({rules.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowAddForm((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors border border-slate-700"
          >
            <span className="text-lg leading-none">+</span> Add Rule
          </button>
        </div>

        {showAddForm && (
          <AddRuleForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} />
        )}

        {rules.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-500 text-sm">No alert rules configured yet.</p>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-colors"
            >
              Add your first rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Alert history */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest font-mono">
          Alert History
        </h2>

        {history.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
            <p className="text-slate-500 text-sm">No alert history yet — run checks to populate.</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Rule</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Message</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-semibold">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 20).map((h) => {
                    const rule = rules.find((r) => r.id === h.rule_id);
                    return (
                      <tr key={h.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap font-mono">
                          {formatDate(h.triggered_at)}
                        </td>
                        <td className="px-4 py-2.5 text-white font-semibold whitespace-nowrap">
                          {rule?.name ?? <span className="text-slate-500 italic">Deleted rule</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 max-w-md">
                          <span className="line-clamp-2">{h.message}</span>
                          {h.error && (
                            <span className="block text-rose-400 mt-0.5">{h.error}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {h.sent ? (
                            <span className="text-emerald-400 font-bold">&#10003;</span>
                          ) : (
                            <span className="text-slate-600 font-bold">&#10007;</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Cron setup note */}
      <CronNote />
    </div>
  );
}
