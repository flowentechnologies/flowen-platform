'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { PatientDetail, PatientSession } from '@/app/api/clinician/patients/[patientId]/route';
import type { TreatmentPlan } from '@/app/api/clinician/patients/[patientId]/plan/route';

function fmt(d: string) {
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}
function fmtDur(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}m ${sec}s`;
}
function bpmColor(bpm: number): string {
  if (bpm < 2) return 'text-emerald-400';
  if (bpm <= 5) return 'text-amber-400';
  return 'text-red-400';
}
function barColor(bpm: number): string {
  if (bpm < 2) return 'bg-emerald-500';
  if (bpm <= 5) return 'bg-amber-500';
  return 'bg-red-500';
}

function computeStats(sessions: PatientSession[]) {
  if (!sessions.length) return { totalMins: 0, trend: 'insufficient_data' as const, recentBpm: null, improvementPct: null };
  const totalMins = Math.round(sessions.reduce((s, r) => s + r.duration_seconds, 0) / 60);
  if (sessions.length < 6) return { totalMins, trend: 'insufficient_data' as const, recentBpm: null, improvementPct: null };
  const bpm = (s: PatientSession) => s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0;
  const baselineBpm = sessions.slice(0, 3).map(bpm).reduce((a, b) => a + b, 0) / 3;
  const recentBpmVal   = sessions.slice(-3).map(bpm).reduce((a, b) => a + b, 0) / 3;
  if (baselineBpm === 0) return { totalMins, trend: 'insufficient_data' as const, recentBpm: Math.round(recentBpmVal * 10) / 10, improvementPct: null };
  const pct = ((baselineBpm - recentBpmVal) / baselineBpm) * 100;
  return {
    totalMins,
    trend: (pct > 10 ? 'improving' : pct < -10 ? 'regressing' : 'plateauing') as 'improving' | 'plateauing' | 'regressing',
    recentBpm: Math.round(recentBpmVal * 10) / 10,
    improvementPct: Math.round(pct * 10) / 10,
  };
}

const TREND_STYLES = {
  improving:         { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'Improving' },
  plateauing:        { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30',   label: 'Plateauing' },
  regressing:        { cls: 'bg-red-500/10 text-red-400 border-red-500/30',         label: 'Regressing' },
  insufficient_data: { cls: 'bg-slate-700/50 text-slate-400 border-slate-600/30',   label: 'Not enough data' },
};

function NoteCell({ session, patientId }: { session: PatientSession; patientId: string }) {
  const [editing, setEditing]   = useState(false);
  const [text, setText]         = useState(session.note ?? '');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch(`/api/clinician/patients/${patientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, note: text }),
    });
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[180px]">
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-500"
          placeholder="Add clinical note…"
        />
        <div className="flex gap-1.5">
          <button
            onClick={save}
            disabled={saving}
            className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => { setEditing(false); setText(session.note ?? ''); }}
            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 group/note">
      {text ? (
        <span className="text-xs text-slate-300 leading-relaxed flex-1">{text}</span>
      ) : (
        <span className="text-[10px] text-slate-600 italic flex-1">No note</span>
      )}
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover/note:opacity-100 transition-opacity text-[10px] text-slate-500 hover:text-emerald-400 shrink-0"
      >
        {saved ? '✓' : text ? 'Edit' : '+ Add'}
      </button>
    </div>
  );
}

const PHASES = ['Establishment', 'Consolidation', 'Transfer', 'Maintenance'];
const ALL_STAGES = [1, 2, 3, 4, 5];
const STAGE_LABELS: Record<number, string> = {
  1: 'Syllable-level speech',
  2: 'Word-level speech',
  3: 'Phrase-level speech',
  4: 'Sentence-level speech',
  5: 'Conversation practice',
};

function TreatmentPlanCard({ patientId }: { patientId: string }) {
  const [plan, setPlan]       = useState<TreatmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [draft, setDraft]     = useState<Partial<TreatmentPlan>>({});

  useEffect(() => {
    fetch(`/api/clinician/patients/${patientId}/plan`)
      .then(r => r.json())
      .then((j: { plan: TreatmentPlan | null }) => { setPlan(j.plan); setLoading(false); });
  }, [patientId]);

  const startEdit = () => {
    setDraft(plan ?? {
      prescribed_stages: [1],
      sessions_per_week: 3,
      minutes_per_session: 10,
      phase: 'Establishment',
      goals: '',
    });
    setEditing(true);
    setSaved(false);
  };

  const toggleStage = (s: number) => {
    const cur = draft.prescribed_stages ?? [1];
    setDraft(d => ({ ...d, prescribed_stages: cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s].sort((a, b) => a - b) }));
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/clinician/patients/${patientId}/plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
    });
    const json = await res.json() as { plan: TreatmentPlan };
    setPlan(json.plan); setSaving(false); setSaved(true); setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-pulse h-32" />
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Treatment Plan</h2>
        {!editing && (
          <button onClick={startEdit} className="text-xs text-slate-500 hover:text-emerald-400 transition-colors">
            {plan ? (saved ? '✓ Saved' : 'Edit') : '+ Create plan'}
          </button>
        )}
      </div>

      {!plan && !editing && (
        <p className="text-slate-500 text-xs">No treatment plan yet. Create one to prescribe exercises and goals to this patient.</p>
      )}

      {plan && !editing && (
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-600 mb-1">Phase</p>
              <p className="text-white font-medium">{plan.phase}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-600 mb-1">Prescribed stages</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.prescribed_stages.map(s => (
                  <span key={s} className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                    Stage {s} — {STAGE_LABELS[s]}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-600 mb-1">Session goal</p>
              <p className="text-white font-medium">{plan.sessions_per_week}×/week · {plan.minutes_per_session} min each</p>
            </div>
            {plan.goals && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wide text-slate-600 mb-1">Clinical goals</p>
                <p className="text-slate-300 leading-relaxed">{plan.goals}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="space-y-4">
          {/* Phase */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Phase</label>
            <select
              value={draft.phase ?? 'Establishment'}
              onChange={e => setDraft(d => ({ ...d, phase: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Stages */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Prescribed stages (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {ALL_STAGES.map(s => {
                const active = (draft.prescribed_stages ?? []).includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStage(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${active ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                  >
                    {s} — {STAGE_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Session frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Sessions per week</label>
              <input type="number" min={1} max={14} value={draft.sessions_per_week ?? 3}
                onChange={e => setDraft(d => ({ ...d, sessions_per_week: Number(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Minutes per session</label>
              <input type="number" min={1} max={60} value={draft.minutes_per_session ?? 10}
                onChange={e => setDraft(d => ({ ...d, minutes_per_session: Number(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Goals */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Clinical goals (visible to patient)</label>
            <textarea
              rows={3}
              value={draft.goals ?? ''}
              onChange={e => setDraft(d => ({ ...d, goals: e.target.value }))}
              placeholder="e.g. Reduce block rate to <2/min during phrase-level speech over 4 weeks…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={saving || !(draft.prescribed_stages ?? []).length}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors disabled:opacity-40">
              {saving ? 'Saving…' : 'Save plan'}
            </button>
            <button onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PatientClient({ patient }: { patient: PatientDetail }) {
  const patientId = patient.id;
  const { totalMins, trend, recentBpm, improvementPct } = computeStats(patient.sessions);
  const { cls: trendCls, label: trendLabel } = TREND_STYLES[trend];

  const chartSessions = patient.sessions.slice(-30);
  const maxBpm = Math.max(...chartSessions.map(s => s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0), 1);

  const displayName = patient.display_name ?? patient.email?.split('@')[0] ?? 'Unknown';
  const reversedSessions = [...patient.sessions].reverse();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Back + header */}
      <div>
        <Link href="/dashboard/clinician" className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1 mb-4">
          ← All patients
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{patient.email}</p>
            <p className="text-slate-600 text-xs mt-1">
              Assigned {new Date(patient.assigned_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${trendCls}`}>
            {trendLabel}
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Sessions', value: String(patient.sessions.length) },
          { label: 'Practice time', value: `${totalMins}m` },
          { label: 'Blk/min (recent)', value: recentBpm !== null ? recentBpm.toFixed(1) : '—' },
          { label: 'Improvement', value: improvementPct !== null ? `${improvementPct > 0 ? '+' : ''}${improvementPct}%` : '—' },
        ].map(card => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">{card.label}</p>
            <p className="text-3xl font-bold text-white leading-none">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Treatment plan */}
      <TreatmentPlanCard patientId={patientId} />

      {/* Sparkline */}
      {chartSessions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-4">Block rate — last {chartSessions.length} sessions</p>
          <div className="flex items-end gap-1 h-20">
            {chartSessions.map((s, i) => {
              const bpm = s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0;
              const h = Math.max(2, Math.round((bpm / maxBpm) * 100));
              return (
                <div key={i} className="flex-1 flex flex-col justify-end" title={`${bpm.toFixed(1)} blk/min`}>
                  <div className={`w-full rounded-sm ${barColor(bpm)} opacity-80`} style={{ height: `${h}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-slate-600 font-mono">
            <span>Oldest</span><span>Most recent</span>
          </div>
        </div>
      )}

      {/* Session history table */}
      {patient.sessions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <p className="text-slate-400 text-sm">No sessions recorded yet.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold text-sm">Session history</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-800/60">
                  {['Date', 'Duration', 'Blocks', 'Blk/min', 'Clinical notes'].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {reversedSessions.map(s => {
                  const bpm = s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">{fmt(s.created_at)}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{fmtDur(s.duration_seconds)}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{s.total_blocks_detected}</td>
                      <td className={`px-4 py-3 text-xs font-semibold tabular-nums ${bpmColor(bpm)}`}>{bpm.toFixed(1)}</td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <NoteCell session={s} patientId={patientId} />
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
  );
}
