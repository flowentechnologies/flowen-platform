'use client';

import { useState, useTransition } from 'react';
import { addSessionNote, updateTreatmentPlan } from '@/app/actions/slp-patient-actions';

export interface Session {
  id: string;
  created_at: string;
  duration_seconds: number;
  total_blocks_detected: number;
  total_repetitions_detected: number;
  total_prolongations_detected: number;
  average_latency_ms: number;
  stage_id: number;
}

export interface TreatmentPlan {
  id: string;
  phase: string;
  sessions_per_week: number;
  minutes_per_session: number;
  goals: string;
  prescribed_stages: number[];
  active: boolean;
}

export interface SessionNote {
  id: string;
  session_id: string;
  note: string;
  created_at: string;
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────

function SessionChart({ sessions }: { sessions: Session[] }) {
  // Build last-30-day buckets
  const buckets: Record<string, number> = {};
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const s of sessions) {
    const key = s.created_at.slice(0, 10);
    if (key in buckets) buckets[key]++;
  }

  const days   = Object.keys(buckets);
  const counts = Object.values(buckets);
  const max    = Math.max(...counts, 1);

  return (
    <div>
      <div className="flex items-end gap-0.5 h-16">
        {counts.map((count, i) => {
          const isToday = days[i] === today.toISOString().slice(0, 10);
          const height  = count === 0 ? 4 : Math.max(8, Math.round((count / max) * 56));
          return (
            <div
              key={days[i]}
              title={`${days[i]}: ${count} session${count !== 1 ? 's' : ''}`}
              style={{ height }}
              className={`
                flex-1 rounded-sm transition-colors
                ${count === 0
                  ? 'bg-slate-800'
                  : isToday
                    ? 'bg-emerald-400'
                    : 'bg-emerald-600/70 hover:bg-emerald-500'}
              `}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-slate-600">30 days ago</span>
        <span className="text-[10px] text-slate-600">Today</span>
      </div>
    </div>
  );
}

// ── Session notes ──────────────────────────────────────────────────────────────

function NotesPanel({
  patientId, slpId, notes, sessions,
}: {
  patientId: string;
  slpId: string;
  notes: SessionNote[];
  sessions: Session[];
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote]     = useState('');
  const [sessionId, setSessionId] = useState('');
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState(false);

  function submit() {
    if (!note.trim()) { setError('Note cannot be empty.'); return; }
    setError('');
    startTransition(async () => {
      const res = await addSessionNote({ patientId, slpId, sessionId: sessionId || null, note });
      if (res.ok) { setNote(''); setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
      else setError(res.error ?? 'Failed to save note.');
    });
  }

  return (
    <div className="space-y-4">
      {/* Existing notes */}
      {notes.length > 0 && (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-sm text-slate-300 leading-relaxed">{n.note}</p>
              <p className="text-[10px] text-slate-600 mt-2">
                {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add note */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-400 mb-3">Add clinical note</p>
        {sessions.length > 0 && (
          <select
            value={sessionId}
            onChange={e => setSessionId(e.target.value)}
            className="w-full mb-3 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="">General note (not tied to a session)</option>
            {sessions.slice(0, 10).map(s => (
              <option key={s.id} value={s.id}>
                Session {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {Math.round(s.duration_seconds / 60)}min
              </option>
            ))}
          </select>
        )}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="Clinical observations, progression notes, concerns…"
          className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
        />
        {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
        {success && <p className="text-xs text-emerald-400 mt-1">Note saved.</p>}
        <button
          onClick={submit}
          disabled={pending}
          className="mt-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-semibold transition-colors"
        >
          {pending ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  );
}

// ── Treatment plan editor ──────────────────────────────────────────────────────

function PlanEditor({ plan, patientId, slpId }: { plan: TreatmentPlan; patientId: string; slpId: string }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    phase:             plan.phase,
    sessions_per_week: plan.sessions_per_week,
    minutes_per_session: plan.minutes_per_session,
    goals:             plan.goals,
  });
  const [saved, setSaved] = useState(false);

  const PHASES = ['assessment', 'intensive', 'maintenance', 'discharge'] as const;

  function save() {
    startTransition(async () => {
      await updateTreatmentPlan({ planId: plan.id, ...form });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-white">Treatment Plan</p>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Edit
          </button>
        )}
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Phase</label>
            <select
              value={form.phase}
              onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              {PHASES.map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Sessions / week</label>
              <input
                type="number" min={1} max={14}
                value={form.sessions_per_week}
                onChange={e => setForm(f => ({ ...f, sessions_per_week: +e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Minutes / session</label>
              <input
                type="number" min={5} max={60}
                value={form.minutes_per_session}
                onChange={e => setForm(f => ({ ...f, minutes_per_session: +e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Clinical goals</label>
            <textarea
              value={form.goals}
              onChange={e => setForm(f => ({ ...f, goals: e.target.value }))}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={pending}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-semibold transition-colors"
            >
              {pending ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Phase</p>
              <p className="text-sm text-slate-200 capitalize">{plan.phase}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Sessions / wk</p>
              <p className="text-sm text-slate-200">{plan.sessions_per_week}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Mins / session</p>
              <p className="text-sm text-slate-200">{plan.minutes_per_session}</p>
            </div>
          </div>
          {plan.goals && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Goals</p>
              <p className="text-sm text-slate-300 leading-relaxed">{plan.goals}</p>
            </div>
          )}
          {plan.prescribed_stages?.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Prescribed stages</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.prescribed_stages.map(s => (
                  <span key={s} className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 text-xs rounded-full">
                    Stage {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Session table ──────────────────────────────────────────────────────────────

function SessionTable({ sessions }: { sessions: Session[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? sessions : sessions.slice(0, 8);

  if (sessions.length === 0) {
    return <p className="text-sm text-slate-500 py-6 text-center">No sessions recorded yet.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-800">
              {['Date', 'Duration', 'Blocks', 'Reps', 'Prolongations', 'Latency', 'Stage'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-900/60 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((s, i) => (
              <tr key={s.id} className={i < visible.length - 1 ? 'border-b border-slate-800/60' : ''}>
                <td className="px-4 py-3 text-slate-300 whitespace-nowrap text-xs">
                  {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </td>
                <td className="px-4 py-3 text-slate-400 tabular-nums">
                  {Math.round(s.duration_seconds / 60)}m
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <span className={s.total_blocks_detected > 5 ? 'text-amber-400' : 'text-slate-400'}>
                    {s.total_blocks_detected}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 tabular-nums">{s.total_repetitions_detected}</td>
                <td className="px-4 py-3 text-slate-400 tabular-nums">{s.total_prolongations_detected}</td>
                <td className="px-4 py-3 text-slate-400 tabular-nums">{Math.round(s.average_latency_ms)}ms</td>
                <td className="px-4 py-3 text-slate-500 tabular-nums">{s.stage_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sessions.length > 8 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          {expanded ? 'Show less' : `Show all ${sessions.length} sessions`}
        </button>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function PatientClient({
  patientId, slpId, sessions, plan, notes,
}: {
  patientId: string;
  slpId: string;
  sessions: Session[];
  plan: TreatmentPlan | null;
  notes: SessionNote[];
}) {
  return (
    <div className="space-y-8">
      {/* Session activity chart */}
      <section>
        <h2 className="text-sm font-bold text-white mb-3">Session Activity — Last 30 Days</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <SessionChart sessions={sessions} />
        </div>
      </section>

      {/* Treatment plan */}
      <section>
        <h2 className="text-sm font-bold text-white mb-3">Treatment Plan</h2>
        {plan ? (
          <PlanEditor plan={plan} patientId={patientId} slpId={slpId} />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
            <p className="text-sm text-slate-500 mb-3">No active treatment plan.</p>
            <p className="text-xs text-slate-600">Contact clinical@flowen.digital to create one.</p>
          </div>
        )}
      </section>

      {/* Session history */}
      <section>
        <h2 className="text-sm font-bold text-white mb-3">Session History</h2>
        <SessionTable sessions={sessions} />
      </section>

      {/* Clinical notes */}
      <section>
        <h2 className="text-sm font-bold text-white mb-3">Clinical Notes</h2>
        <NotesPanel patientId={patientId} slpId={slpId} notes={notes} sessions={sessions} />
      </section>
    </div>
  );
}
