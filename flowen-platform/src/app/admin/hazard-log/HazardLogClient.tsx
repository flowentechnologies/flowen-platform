'use client';

import React, {
  useState,
  useTransition,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import type { HazardEntry } from '@/app/api/admin/hazard-log/route';

// ── Constants ─────────────────────────────────────────────────────────────────

const PATHWAYS = [
  'AI Model Failure',
  'Biofeedback Guidance Error',
  'Data Loss/Corruption',
  'Privacy Breach',
  'Incorrect Clinical Data',
  'User Misuse',
  'System Unavailability',
  'Other',
] as const;

const SEVERITY_LABELS: Record<number, string> = {
  1: 'No harm',
  2: 'Minor',
  3: 'Moderate',
  4: 'Major',
  5: 'Catastrophic',
};

const LIKELIHOOD_LABELS: Record<number, string> = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Almost certain',
};

const STATUSES = ['open', 'mitigated', 'accepted', 'closed'] as const;
type Status = (typeof STATUSES)[number];

// ── Seed hazards shown in empty state ────────────────────────────────────────

interface SeedHazard {
  hazard_description: string;
  affected_pathway: string;
  cause: string;
  effect: string;
  severity: number;
  likelihood: number;
  mitigation: string;
  residual_severity: number;
  residual_likelihood: number;
  status: Status;
  reviewed_by: string;
}

const SEED_HAZARDS: SeedHazard[] = [
  {
    hazard_description:
      'AI model misidentifies normal speech as disfluency, causing unnecessary negative biofeedback',
    affected_pathway: 'AI Model Failure',
    cause:
      'Insufficient training data diversity; model bias towards certain accents or speech patterns; audio quality degradation',
    effect:
      'User receives incorrect negative reinforcement, increasing anxiety and potentially worsening stammer. May cause distress or loss of confidence in treatment.',
    severity: 3,
    likelihood: 3,
    mitigation:
      'Implement confidence threshold below which model abstains from scoring. Regular model validation against diverse speech samples. User ability to flag incorrect detections. SLP review of flagged sessions.',
    residual_severity: 2,
    residual_likelihood: 2,
    status: 'open',
    reviewed_by: '',
  },
  {
    hazard_description:
      'Biofeedback latency exceeding 150ms causes incorrect technique reinforcement',
    affected_pathway: 'Biofeedback Guidance Error',
    cause:
      'Network congestion, device performance limitations, or server processing delays causing audio analysis pipeline to exceed real-time threshold',
    effect:
      'User receives feedback that is temporally decoupled from their speech output. Incorrect technique becomes reinforced, potentially embedding harmful speech patterns.',
    severity: 3,
    likelihood: 2,
    mitigation:
      'On-device inference fallback when latency exceeds 120ms. Latency monitoring with automatic session quality warnings. Clear user notification when feedback quality is degraded. Recommend wired connection or device upgrade.',
    residual_severity: 2,
    residual_likelihood: 1,
    status: 'open',
    reviewed_by: '',
  },
  {
    hazard_description:
      'Session data loss prevents clinician (SLP) from reviewing patient progress',
    affected_pathway: 'Data Loss/Corruption',
    cause:
      'App crash during session, network failure during sync, database write error, or accidental deletion by user',
    effect:
      'SLP makes treatment decisions without full progress data. Patient regresses without clinician awareness. Treatment plan not adjusted appropriately.',
    severity: 3,
    likelihood: 2,
    mitigation:
      'Local session data buffer with retry sync. Crash-resilient session recording (write-ahead log). SLP dashboard shows data gaps with warnings. Automated backup of session data to secondary store. User confirmation before session data deletion.',
    residual_severity: 2,
    residual_likelihood: 1,
    status: 'open',
    reviewed_by: '',
  },
  {
    hazard_description:
      'User substitutes app for emergency medical care during acute psychological crisis',
    affected_pathway: 'User Misuse',
    cause:
      'User experiencing acute mental health crisis (stammering-related anxiety, depression) uses app as primary support instead of seeking emergency help',
    effect:
      'Delay in receiving appropriate emergency care. Potential serious harm to user if crisis escalates without professional intervention.',
    severity: 4,
    likelihood: 2,
    mitigation:
      'Prominent in-app safety messaging directing users to crisis resources (Samaritans: 116 123, NHS 111). Periodic reminders that app is not a substitute for clinical care. Onboarding screen with emergency contact information. Crisis detection pattern in usage (if feasible) triggering support prompts.',
    residual_severity: 3,
    residual_likelihood: 1,
    status: 'open',
    reviewed_by: '',
  },
  {
    hazard_description:
      'Incorrect viseme (3D mouth shape) guidance reinforces harmful speech patterns',
    affected_pathway: 'Biofeedback Guidance Error',
    cause:
      'Viseme model error, incorrect phoneme mapping, or culturally inappropriate speech guidance applied to user with specific stammer pattern',
    effect:
      'User practices incorrect mouth positioning, potentially embedding new speech errors or reinforcing existing harmful compensatory behaviours. May require additional SLP sessions to correct.',
    severity: 3,
    likelihood: 2,
    mitigation:
      'Clinical review of all viseme animations by qualified SLP before release. User-reported feedback mechanism for incorrect guidance. SLP ability to disable specific visual guidance elements for individual patients. Version-controlled animation library with clinical sign-off process.',
    residual_severity: 2,
    residual_likelihood: 1,
    status: 'open',
    reviewed_by: '',
  },
];

// ── Risk helpers ──────────────────────────────────────────────────────────────

function computeRiskLevel(score: number): string {
  if (score <= 5)  return 'low';
  if (score <= 12) return 'medium';
  if (score <= 19) return 'high';
  return 'critical';
}

function riskScore(severity: number, likelihood: number) {
  return severity * likelihood;
}

function cellColor(score: number): string {
  if (score <= 5)  return 'bg-emerald-900/60 border-emerald-700/40 text-emerald-400';
  if (score <= 12) return 'bg-amber-900/60 border-amber-700/40 text-amber-400';
  if (score <= 19) return 'bg-red-900/60 border-red-700/40 text-red-400';
  return 'bg-rose-950/80 border-rose-700/40 text-rose-300';
}

// ── Risk level badge ──────────────────────────────────────────────────────────

function RiskBadge({ level, pulse = false }: { level: string; pulse?: boolean }) {
  const config: Record<string, string> = {
    low:      'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    medium:   'bg-amber-500/15 text-amber-300 border-amber-500/40',
    high:     'bg-red-500/15 text-red-300 border-red-500/40',
    critical: 'bg-rose-500/20 text-rose-200 border-rose-500/50',
  };
  const cls = config[level] ?? 'bg-slate-700 text-slate-400 border-slate-600';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {(level === 'critical' || pulse) && (
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0" />
      )}
      {level.toUpperCase()}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    open:      'bg-amber-500/15 text-amber-300 border-amber-500/40',
    mitigated: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    accepted:  'bg-slate-700/60 text-slate-400 border-slate-600/50',
    closed:    'bg-slate-100/80 dark:bg-slate-800/60 text-slate-500 border-slate-700/40',
  };
  const cls = config[status] ?? 'bg-slate-700 text-slate-400 border-slate-600';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status === 'open' && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Risk matrix ───────────────────────────────────────────────────────────────

function RiskMatrix({ entries }: { entries: HazardEntry[] }) {
  const [open, setOpen] = useState(true);

  // Build a map: "severity-likelihood" -> HazardEntry[]
  const cellMap = useMemo(() => {
    const m = new Map<string, HazardEntry[]>();
    for (const e of entries) {
      const key = `${e.severity}-${e.likelihood}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return m;
  }, [entries]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-900 dark:text-white">Risk Matrix (5×5)</span>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">
            Severity × Likelihood
          </span>
        </div>
        <span className={`text-slate-500 text-sm transition-transform ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4 text-[11px] font-mono">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-900/60 border border-emerald-700/40 inline-block" />Low (1–5)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-900/60 border border-amber-700/40 inline-block" />Medium (6–12)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-900/60 border border-red-700/40 inline-block" />High (13–19)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-950/80 border border-rose-700/40 inline-block" />Critical (20–25)</span>
          </div>

          <div className="flex gap-2">
            {/* Y-axis label */}
            <div className="flex flex-col justify-center items-center w-5 shrink-0">
              <span
                className="text-[10px] text-slate-600 font-mono whitespace-nowrap"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                LIKELIHOOD →
              </span>
            </div>

            <div className="flex-1 min-w-0">
              {/* Column headers (Severity 1–5) */}
              <div className="grid grid-cols-5 gap-1 mb-1 pl-6">
                {[1, 2, 3, 4, 5].map(s => (
                  <div key={s} className="text-center text-[10px] font-mono text-slate-600">
                    S{s}
                  </div>
                ))}
              </div>

              {/* Rows: likelihood 5 down to 1 */}
              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map(l => (
                  <div key={l} className="flex items-center gap-1">
                    {/* Row header */}
                    <div className="w-5 shrink-0 text-[10px] font-mono text-slate-600 text-right">
                      L{l}
                    </div>
                    {/* 5 cells */}
                    <div className="grid grid-cols-5 gap-1 flex-1">
                      {[1, 2, 3, 4, 5].map(s => {
                        const score = s * l;
                        const key   = `${s}-${l}`;
                        const hazards = cellMap.get(key) ?? [];
                        return (
                          <div
                            key={s}
                            className={`relative border rounded-lg flex flex-col items-center justify-center min-h-[44px] p-1 ${cellColor(score)}`}
                            title={`Severity ${s} × Likelihood ${l} = ${score}`}
                          >
                            <span className="text-[9px] font-mono opacity-60 leading-none">{score}</span>
                            {hazards.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                                {hazards.map(h => (
                                  <span
                                    key={h.id}
                                    className="text-[8px] font-mono font-bold bg-black/30 rounded px-0.5 leading-tight"
                                    title={h.hazard_description}
                                  >
                                    {h.hazard_ref}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* X-axis label */}
              <div className="text-center text-[10px] text-slate-600 font-mono mt-2">
                SEVERITY →
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Radio group ───────────────────────────────────────────────────────────────

function ScoreRadio({
  name,
  value,
  onChange,
  labels,
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
  labels: Record<number, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 2, 3, 4, 5].map(n => (
        <label
          key={n}
          className={`flex flex-col items-center cursor-pointer rounded-lg border px-3 py-2 text-xs transition-all select-none ${
            value === n
              ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300'
              : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-200'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            onChange={() => onChange(n)}
            className="sr-only"
          />
          <span className="font-bold text-base leading-none">{n}</span>
          <span className="text-[10px] mt-0.5 text-center leading-tight opacity-80">{labels[n]}</span>
        </label>
      ))}
    </div>
  );
}

// ── Live risk indicator ───────────────────────────────────────────────────────

function LiveRiskIndicator({ severity, likelihood }: { severity: number; likelihood: number }) {
  const score = riskScore(severity, likelihood);
  const level = computeRiskLevel(score);
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-700/50">
      <div className="text-center">
        <p className="text-2xl font-black text-slate-900 dark:text-white">{score}</p>
        <p className="text-[10px] font-mono text-slate-500">score</p>
      </div>
      <div className="h-8 w-px bg-slate-700" />
      <RiskBadge level={level} pulse={level === 'critical'} />
    </div>
  );
}

// ── Add/Edit form ─────────────────────────────────────────────────────────────

interface FormState {
  hazard_description: string;
  affected_pathway: string;
  cause: string;
  effect: string;
  severity: number;
  likelihood: number;
  mitigation: string;
  residual_severity: number;
  residual_likelihood: number;
  status: Status;
  reviewed_by: string;
}

const BLANK_FORM: FormState = {
  hazard_description: '',
  affected_pathway:   PATHWAYS[0],
  cause:              '',
  effect:             '',
  severity:           1,
  likelihood:         1,
  mitigation:         '',
  residual_severity:  1,
  residual_likelihood:1,
  status:             'open',
  reviewed_by:        '',
};

function seedToForm(seed: SeedHazard): FormState {
  return {
    hazard_description: seed.hazard_description,
    affected_pathway:   seed.affected_pathway,
    cause:              seed.cause,
    effect:             seed.effect,
    severity:           seed.severity,
    likelihood:         seed.likelihood,
    mitigation:         seed.mitigation,
    residual_severity:  seed.residual_severity,
    residual_likelihood:seed.residual_likelihood,
    status:             seed.status,
    reviewed_by:        seed.reviewed_by,
  };
}

function entryToForm(e: HazardEntry): FormState {
  return {
    hazard_description: e.hazard_description,
    affected_pathway:   e.affected_pathway,
    cause:              e.cause,
    effect:             e.effect,
    severity:           e.severity,
    likelihood:         e.likelihood,
    mitigation:         e.mitigation,
    residual_severity:  e.residual_severity,
    residual_likelihood:e.residual_likelihood,
    status:             e.status as Status,
    reviewed_by:        e.reviewed_by ?? '',
  };
}

interface HazardFormProps {
  editingEntry: HazardEntry | null;
  onClose: () => void;
  onSaved: (entry: HazardEntry) => void;
  initialForm?: FormState;
}

function HazardForm({ editingEntry, onClose, onSaved, initialForm }: HazardFormProps) {
  const [form, setForm] = useState<FormState>(
    editingEntry ? entryToForm(editingEntry) : (initialForm ?? BLANK_FORM),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const body = {
      action: editingEntry ? 'update' : 'add',
      ...(editingEntry ? { id: editingEntry.id } : {}),
      ...form,
    };

    try {
      const res = await fetch('/api/admin/hazard-log', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const json = await res.json() as { entry?: HazardEntry; error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? 'Unknown error');
      } else if (json.entry) {
        onSaved(json.entry);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const initialScore  = riskScore(form.severity, form.likelihood);
  const residualScore = riskScore(form.residual_severity, form.residual_likelihood);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-900/80">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {editingEntry ? `Edit ${editingEntry.hazard_ref}` : 'Add New Hazard'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200 text-xl leading-none transition-colors"
        >
          ×
        </button>
      </div>

      <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">

        {/* ── Section 1: Hazard Details ─────────────────────────────────── */}
        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2">
            1 — Hazard Details
          </h4>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Hazard Description <span className="text-rose-400">*</span></label>
            <textarea
              required
              rows={3}
              value={form.hazard_description}
              onChange={e => set('hazard_description', e.target.value)}
              placeholder="Describe the potential hazard clearly and concisely…"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/60 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Affected Clinical Pathway <span className="text-rose-400">*</span></label>
            <select
              required
              value={form.affected_pathway}
              onChange={e => set('affected_pathway', e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/60 transition-colors appearance-none"
            >
              {PATHWAYS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Cause <span className="text-rose-400">*</span></label>
              <textarea
                required
                rows={3}
                value={form.cause}
                onChange={e => set('cause', e.target.value)}
                placeholder="What could cause this hazard to occur?"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/60 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Effect / Harm <span className="text-rose-400">*</span></label>
              <textarea
                required
                rows={3}
                value={form.effect}
                onChange={e => set('effect', e.target.value)}
                placeholder="What harm could result to the patient or user?"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/60 transition-colors"
              />
            </div>
          </div>
        </section>

        {/* ── Section 2: Initial Risk ───────────────────────────────────── */}
        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2">
            2 — Initial Risk (before mitigation)
          </h4>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Severity</label>
            <ScoreRadio
              name="severity"
              value={form.severity}
              onChange={v => set('severity', v)}
              labels={SEVERITY_LABELS}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Likelihood</label>
            <ScoreRadio
              name="likelihood"
              value={form.likelihood}
              onChange={v => set('likelihood', v)}
              labels={LIKELIHOOD_LABELS}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Computed Initial Risk</label>
            <LiveRiskIndicator severity={form.severity} likelihood={form.likelihood} />
          </div>
        </section>

        {/* ── Section 3: Mitigation ─────────────────────────────────────── */}
        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2">
            3 — Mitigation &amp; Residual Risk
          </h4>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Mitigation Measures <span className="text-rose-400">*</span></label>
            <textarea
              required
              rows={4}
              value={form.mitigation}
              onChange={e => set('mitigation', e.target.value)}
              placeholder="Describe the controls, processes, and safeguards put in place to mitigate this hazard…"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/60 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Residual Severity (after mitigation)</label>
            <ScoreRadio
              name="residual_severity"
              value={form.residual_severity}
              onChange={v => set('residual_severity', v)}
              labels={SEVERITY_LABELS}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Residual Likelihood (after mitigation)</label>
            <ScoreRadio
              name="residual_likelihood"
              value={form.residual_likelihood}
              onChange={v => set('residual_likelihood', v)}
              labels={LIKELIHOOD_LABELS}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Computed Residual Risk</label>
            <LiveRiskIndicator severity={form.residual_severity} likelihood={form.residual_likelihood} />
            {residualScore >= initialScore && (
              <p className="text-xs text-amber-400 mt-1">
                Warning: residual risk score ({residualScore}) is not lower than initial ({initialScore}). Review mitigation measures.
              </p>
            )}
          </div>
        </section>

        {/* ── Section 4: Review ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2">
            4 — Review &amp; Status
          </h4>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value as Status)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/60 transition-colors appearance-none"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Reviewed By</label>
              <input
                type="text"
                value={form.reviewed_by}
                onChange={e => set('reviewed_by', e.target.value)}
                placeholder="Name / role of reviewer (e.g. Clinical Safety Officer)"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-900/80">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-slate-900 dark:text-white transition-colors"
        >
          {saving ? 'Saving…' : editingEntry ? 'Save Changes' : 'Add Hazard'}
        </button>
      </div>
    </form>
  );
}

// ── Delete confirm dialog ─────────────────────────────────────────────────────

function DeleteDialog({
  entry,
  onConfirm,
  onCancel,
  deleting,
}: {
  entry: HazardEntry;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠</span>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete {entry.hazard_ref}?</h3>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              This will permanently remove this hazard from the log. For DCB0129 compliance, consider
              marking it as <strong className="text-slate-600 dark:text-slate-300">Closed</strong> instead to preserve the audit trail.
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-500 bg-slate-100/80 dark:bg-slate-800/60 rounded-lg px-3 py-2 font-mono truncate">
          {entry.hazard_description}
        </p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-sm font-semibold text-slate-900 dark:text-white transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(entries: HazardEntry[]) {
  const headers = [
    'Ref', 'Description', 'Affected Pathway', 'Cause', 'Effect',
    'Severity', 'Likelihood', 'Risk Score', 'Risk Level',
    'Mitigation',
    'Residual Severity', 'Residual Likelihood', 'Residual Risk Score', 'Residual Risk Level',
    'Status', 'Reviewed By', 'Reviewed At', 'Created At',
  ];

  function escCsv(val: string | number | null | undefined): string {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const rows = entries.map(e => [
    e.hazard_ref,
    e.hazard_description,
    e.affected_pathway,
    e.cause,
    e.effect,
    e.severity,
    e.likelihood,
    e.risk_score,
    e.risk_level,
    e.mitigation,
    e.residual_severity,
    e.residual_likelihood,
    e.residual_risk_score,
    e.residual_risk_level,
    e.status,
    e.reviewed_by ?? '',
    e.reviewed_at ?? '',
    e.created_at,
  ].map(escCsv).join(','));

  const csv = [headers.map(escCsv).join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `flowen-hazard-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onStartWithSeed }: { onStartWithSeed: (seed: SeedHazard) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No hazards logged yet</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          DCB0129 requires a populated hazard log before NHS procurement. Start by adding the
          hazards relevant to Flowen below, or add your own.
        </p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
          Suggested hazards for Flowen — click to add
        </p>
        <div className="space-y-2">
          {SEED_HAZARDS.map((seed, i) => (
            <button
              key={i}
              onClick={() => onStartWithSeed(seed)}
              className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-600 rounded-xl px-4 py-3 transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700">
                      H{String(i + 1).padStart(3, '0')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 bg-slate-100/80 dark:bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50">
                      {seed.affected_pathway}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors leading-snug">
                    {seed.hazard_description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RiskBadge level={computeRiskLevel(riskScore(seed.severity, seed.likelihood))} />
                  <span className="text-slate-600 group-hover:text-slate-400 text-sm transition-colors">+</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

type FilterTab = 'all' | 'open' | 'mitigated' | 'high+';

export function HazardLogClient({ initialEntries }: { initialEntries: HazardEntry[] }) {
  const [entries, setEntries]         = useState<HazardEntry[]>(initialEntries);
  const [showForm, setShowForm]       = useState(false);
  const [editingEntry, setEditing]    = useState<HazardEntry | null>(null);
  const [deleteTarget, setDelTarget]  = useState<HazardEntry | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [filterTab, setFilterTab]     = useState<FilterTab>('all');
  const [search, setSearch]           = useState('');
  const [seedForm, setSeedForm]       = useState<FormState | null>(null);
  const [, startTransition]           = useTransition();
  const formRef                       = useRef<HTMLDivElement>(null);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:     entries.length,
    open:      entries.filter(e => e.status === 'open').length,
    mitigated: entries.filter(e => e.status === 'mitigated').length,
    highPlus:  entries.filter(e => e.risk_level === 'high' || e.risk_level === 'critical').length,
  }), [entries]);

  // ── Filtered entries ───────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = entries;
    if (filterTab === 'open')      list = list.filter(e => e.status === 'open');
    if (filterTab === 'mitigated') list = list.filter(e => e.status === 'mitigated');
    if (filterTab === 'high+')     list = list.filter(e => e.risk_level === 'high' || e.risk_level === 'critical');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        e.hazard_description.toLowerCase().includes(q) ||
        e.hazard_ref.toLowerCase().includes(q) ||
        e.affected_pathway.toLowerCase().includes(q),
      );
    }
    return list;
  }, [entries, filterTab, search]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openAddForm = () => {
    setSeedForm(null);
    setEditing(null);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const openAddWithSeed = (seed: SeedHazard) => {
    setSeedForm(seedToForm(seed));
    setEditing(null);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const openEditForm = (entry: HazardEntry) => {
    setSeedForm(null);
    setEditing(entry);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setSeedForm(null);
  };

  const handleSaved = (entry: HazardEntry) => {
    startTransition(() => {
      setEntries(prev => {
        const idx = prev.findIndex(e => e.id === entry.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = entry;
          return next;
        }
        return [...prev, entry].sort((a, b) => a.hazard_ref.localeCompare(b.hazard_ref));
      });
    });
    closeForm();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/hazard-log', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'delete', id: deleteTarget.id }),
      });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.id !== deleteTarget.id));
        setDelTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const FILTER_TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all',       label: 'All',          count: stats.total },
    { id: 'open',      label: 'Open',         count: stats.open },
    { id: 'mitigated', label: 'Mitigated',    count: stats.mitigated },
    { id: 'high+',     label: 'High+ Risk',   count: stats.highPlus },
  ];

  return (
    <div className="space-y-6">

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Hazards',  value: stats.total,     color: 'text-slate-900 dark:text-white' },
          { label: 'Open',           value: stats.open,      color: 'text-amber-400' },
          { label: 'Mitigated',      value: stats.mitigated, color: 'text-emerald-400' },
          { label: 'High / Critical',value: stats.highPlus,  color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Action bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                filterTab === tab.id
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-600 text-slate-900 dark:text-white'
                  : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-mono ${filterTab === tab.id ? 'text-slate-400' : 'text-slate-600'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search hazards…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors w-48"
          />
          {entries.length > 0 && (
            <button
              onClick={() => exportCsv(entries)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all font-medium"
            >
              <span className="text-base leading-none">↓</span>
              Export CSV
            </button>
          )}
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-slate-900 dark:text-white transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Add Hazard
          </button>
        </div>
      </div>

      {/* ── Risk matrix ──────────────────────────────────────────────────── */}
      {entries.length > 0 && <RiskMatrix entries={entries} />}

      {/* ── Add/Edit form ────────────────────────────────────────────────── */}
      {showForm && (
        <div ref={formRef}>
          <HazardForm
            editingEntry={editingEntry}
            onClose={closeForm}
            onSaved={handleSaved}
            initialForm={seedForm ?? undefined}
          />
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {entries.length === 0 && !showForm && (
        <EmptyState onStartWithSeed={openAddWithSeed} />
      )}

      {/* ── Hazard table ──────────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No hazards match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    {[
                      'Ref', 'Description', 'Pathway',
                      'Sev', 'Lhd', 'Score', 'Risk Level',
                      'Residual Risk', 'Status', 'Actions',
                    ].map(col => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map(entry => (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Ref */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                          {entry.hazard_ref}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-slate-200 text-xs leading-snug line-clamp-2">
                          {entry.hazard_description}
                        </p>
                      </td>

                      {/* Pathway */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100/80 dark:bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                          {entry.affected_pathway}
                        </span>
                      </td>

                      {/* Severity */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{entry.severity}</span>
                        <p className="text-[9px] text-slate-600 font-mono">{SEVERITY_LABELS[entry.severity]}</p>
                      </td>

                      {/* Likelihood */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{entry.likelihood}</span>
                        <p className="text-[9px] text-slate-600 font-mono">{LIKELIHOOD_LABELS[entry.likelihood]}</p>
                      </td>

                      {/* Risk Score */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="text-lg font-black text-slate-900 dark:text-white">{entry.risk_score}</span>
                      </td>

                      {/* Risk Level */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <RiskBadge level={entry.risk_level} />
                      </td>

                      {/* Residual Risk */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <RiskBadge level={entry.residual_risk_level} />
                          <span className="text-[10px] font-mono text-slate-600">
                            {entry.residual_severity}×{entry.residual_likelihood}={entry.residual_risk_score}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={entry.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditForm(entry)}
                            className="text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-500/10"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDelTarget(entry)}
                            className="text-xs font-mono text-red-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
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

          {/* Table footer */}
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-600">
              <span>
                {filtered.length} of {entries.length} hazard{entries.length !== 1 ? 's' : ''}
              </span>
              <span>
                Last export format: DCB0129 Hazard Log · Flowen Speech Therapy
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Delete dialog ─────────────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteDialog
          entry={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDelTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
