'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    try {
      const res = await fetch(`/api/clinician/patients/${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, note: text }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        alert(`Failed to save note: ${json.error ?? 'Unknown error'}`);
        setSaving(false);
        return;
      }
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('Network error — note could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[180px]">
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-500"
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
            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-[10px] transition-colors"
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
        <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex-1">{text}</span>
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
  1: 'Diaphragmatic Breathing',
  2: 'Easy Onset & Prolongation',
  3: 'Light Articulatory Contacts',
  4: 'Pausing & Phrasing',
  5: 'Conversational Flow',
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
      .then((j: { plan: TreatmentPlan | null }) => { setPlan(j.plan); setLoading(false); })
      .catch(() => { setLoading(false); });
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
    try {
      const res = await fetch(`/api/clinician/patients/${patientId}/plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        alert(`Failed to save plan: ${json.error ?? 'Unknown error'}`);
        setSaving(false);
        return;
      }
      const json = await res.json() as { plan: TreatmentPlan };
      setPlan(json.plan); setSaved(true); setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('Network error — plan could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 animate-pulse h-32" />
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-slate-900 dark:text-white font-semibold text-sm">Treatment Plan</h2>
        {!editing && (
          <button type="button" onClick={startEdit} className="text-xs text-slate-500 hover:text-emerald-400 transition-colors">
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
              <p className="text-slate-900 dark:text-white font-medium">{plan.phase}</p>
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
              <p className="text-slate-900 dark:text-white font-medium">{plan.sessions_per_week}×/week · {plan.minutes_per_session} min each</p>
            </div>
            {plan.goals && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wide text-slate-600 mb-1">Clinical goals</p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{plan.goals}</p>
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
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${active ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400 hover:border-slate-600'}`}
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
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Minutes per session</label>
              <input type="number" min={1} max={60} value={draft.minutes_per_session ?? 10}
                onChange={e => setDraft(d => ({ ...d, minutes_per_session: Number(e.target.value) }))}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
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
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 resize-none focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={save} disabled={saving || !(draft.prescribed_stages ?? []).length}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors disabled:opacity-40">
              {saving ? 'Saving…' : 'Save plan'}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm border border-slate-300 dark:border-slate-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClinicianMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface MessagesResponse {
  messages: ClinicianMessage[];
  other_user: { id: string; display_name: string | null; email: string | null };
}

interface SendResponse {
  message: ClinicianMessage;
}

function MiniChat({ patientId, myId }: { patientId: string; myId: string | null }) {
  const [messages, setMessages] = useState<ClinicianMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (initial = false) => {
    const res = await fetch(`/api/messages?with=${patientId}`);
    if (!res.ok) return;
    const data = (await res.json()) as MessagesResponse;
    setMessages(prev => {
      const next = data.messages.slice(-20);
      if (!initial && prev.length === next.length && prev.at(-1)?.id === next.at(-1)?.id) return prev;
      return next;
    });
    if (initial) setLoading(false);
  }, [patientId]);

  useEffect(() => {
    fetchMessages(true).catch(console.error);
  }, [fetchMessages]);

  useEffect(() => {
    const id = setInterval(() => fetchMessages(false).catch(console.error), 20000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_user_id: patientId, content: trimmed }),
      });
      if (res.ok) {
        const data = (await res.json()) as SendResponse;
        setMessages(prev => [...prev, data.message]);
        setContent('');
      } else {
        setSendError('Message could not be sent. Please try again.');
      }
    } catch {
      setSendError('Network error — check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send().catch(console.error);
    }
  };

  if (loading) {
    return <p className="text-slate-400 text-sm px-4 py-6 text-center">Loading messages...</p>;
  }

  return (
    <div className="flex flex-col">
      <div
        className="flex flex-col gap-2 p-4 overflow-y-auto"
        style={{ maxHeight: '400px' }}
      >
        {messages.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">No messages yet.</p>
        ) : (
          messages.map(msg => {
            const isMe = myId ? msg.from_user_id === myId : msg.to_user_id === patientId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-slate-900 dark:text-white'
                      : 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {msg.content}
                </div>
                <div className="flex items-center gap-1.5 mt-1 px-1">
                  <span className="text-[10px] text-slate-600 font-mono">
                    {new Date(msg.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  {isMe && msg.read_at && (
                    <span className="text-[10px] text-emerald-600">Seen</span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2">
        {sendError && (
          <p className="text-rose-400 text-xs px-1" role="alert">{sendError}</p>
        )}
        <div className="flex gap-3 items-end">
          <textarea
            rows={2}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            placeholder="Type a message… (Enter to send)"
            className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <button
            onClick={() => send().catch(console.error)}
            disabled={sending || !content.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PatientClient({ patient, clinicianId }: { patient: PatientDetail; clinicianId: string }) {
  const patientId = patient.id;
  const { totalMins, trend, recentBpm, improvementPct } = computeStats(patient.sessions);
  const { cls: trendCls, label: trendLabel } = TREND_STYLES[trend];

  const chartSessions = patient.sessions.slice(-30);
  const maxBpm = Math.max(...chartSessions.map(s => s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0), 1);

  const displayName = patient.display_name ?? patient.email?.split('@')[0] ?? 'Unknown';
  const reversedSessions = [...patient.sessions].reverse();
  const [showMessages, setShowMessages] = useState(false);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Back + header */}
      <div>
        <Link href="/dashboard/clinician" className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1 mb-4">
          ← All patients
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{displayName}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{patient.email}</p>
            <p className="text-slate-600 text-xs mt-1">
              Assigned {new Date(patient.assigned_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${trendCls}`}>
              {trendLabel}
            </span>
            <a
              href={`/api/reports/patient/${patientId}`}
              download
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v7.44l2.47-2.47a.75.75 0 111.06 1.06l-3.75 3.75a.75.75 0 01-1.06 0L5.72 9.78a.75.75 0 111.06-1.06l2.47 2.47V3.75A.75.75 0 0110 3zm-6.25 13.5a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H3.75z" clipRule="evenodd"/></svg>
              PDF Report
            </a>
          </div>
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
          <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">{card.label}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white leading-none">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Treatment plan */}
      <TreatmentPlanCard patientId={patientId} />

      {/* Sparkline */}
      {chartSessions.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <p className="text-slate-400 text-sm">No sessions recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-slate-900 dark:text-white font-semibold text-sm">Session history</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-800/60">
                  {['Date', 'Stage', 'Duration', 'Blocks', 'Blk/min', 'Clinical notes'].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {reversedSessions.map(s => {
                  const bpm = s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">{fmt(s.created_at)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{s.stage_id ? (STAGE_LABELS[s.stage_id] ?? `Stage ${s.stage_id}`) : '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{fmtDur(s.duration_seconds)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{s.total_blocks_detected}</td>
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

      {/* Messages panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-slate-900 dark:text-white font-semibold text-sm">Messages</h2>
          <button
            onClick={() => setShowMessages(v => !v)}
            className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
          >
            {showMessages ? 'Message patient ↑' : 'Message patient ↓'}
          </button>
        </div>
        {showMessages && (
          <MiniChat patientId={patientId} myId={clinicianId} />
        )}
      </div>
    </div>
  );
}
