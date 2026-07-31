'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { PatientDetail, PatientSession } from '@/app/api/clinician/patients/[patientId]/route';

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
