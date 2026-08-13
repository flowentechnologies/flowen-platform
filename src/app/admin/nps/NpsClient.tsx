'use client';

import React, { useState, useTransition } from 'react';

interface NpsResponse {
  id: string;
  email: string;
  score: number | null;
  comment: string | null;
  source: string;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
}

interface Dist { score: number; count: number }

interface Stats {
  total: number;
  promoters: number;
  detractors: number;
  passives: number;
  npsScore: number | null;
  avgScore: number | null;
  dist: Dist[];
}

interface Props {
  initialResponses: NpsResponse[];
  initialStats: Stats;
}

function scoreColor(s: number) {
  if (s <= 6) return 'bg-red-500/15 text-red-400 border-red-500/20';
  if (s <= 8) return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
}

function scoreLabel(s: number) {
  if (s <= 6) return 'Detractor';
  if (s <= 8) return 'Passive';
  return 'Promoter';
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NpsClient({ initialResponses, initialStats }: Props) {
  const [responses, setResponses] = useState(initialResponses);
  const [stats,     setStats]     = useState(initialStats);

  // Send survey form
  const [sendEmail, setSendEmail]           = useState('');
  const [sendName,  setSendName]            = useState('');
  const [sendState, setSendState]           = useState<'idle'|'sending'|'sent'|'error'>('idle');
  const [, startTransition] = useTransition();

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!sendEmail || !sendName) return;
    setSendState('sending');
    try {
      const res = await fetch('/api/admin/nps', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: sendEmail, displayName: sendName }),
      });
      if (!res.ok) throw new Error();
      setSendState('sent');
      setSendEmail('');
      setSendName('');
      // Refresh list
      startTransition(async () => {
        const r = await fetch('/api/admin/nps');
        const d = await r.json();
        setResponses(d.responses ?? []);
        setStats(d.stats ?? stats);
      });
    } catch {
      setSendState('error');
    }
  }

  const maxDist = Math.max(...stats.dist.map(d => d.count), 1);

  return (
    <div className="space-y-8">

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'NPS Score',   value: stats.npsScore !== null ? `${stats.npsScore > 0 ? '+' : ''}${stats.npsScore}` : '—', sub: 'Promoters − Detractors ÷ Total' },
          { label: 'Avg score',   value: stats.avgScore !== null ? `${stats.avgScore}/10` : '—', sub: `${stats.total} response${stats.total !== 1 ? 's' : ''}` },
          { label: 'Promoters',   value: String(stats.promoters),  sub: 'Score 9–10' },
          { label: 'Detractors',  value: String(stats.detractors), sub: 'Score 0–6' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-slate-100">{s.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Score distribution ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Score distribution</p>
        <div className="flex items-end gap-1.5 h-20">
          {stats.dist.map(d => {
            const pct = maxDist > 0 ? (d.count / maxDist) * 100 : 0;
            const color = d.score <= 6 ? 'bg-red-500/60' : d.score <= 8 ? 'bg-amber-500/60' : 'bg-emerald-500/60';
            return (
              <div key={d.score} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-600">{d.count || ''}</span>
                <div
                  className={`w-full rounded-t-sm ${color}`}
                  style={{ height: `${Math.max(pct, d.count > 0 ? 8 : 2)}%` }}
                />
                <span className="text-xs text-slate-600">{d.score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Send survey ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Send NPS survey</p>
        <form onSubmit={handleSend} className="flex flex-wrap gap-3">
          <input
            type="email"
            required
            placeholder="Email address"
            value={sendEmail}
            onChange={e => setSendEmail(e.target.value)}
            className="flex-1 min-w-48 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <input
            type="text"
            required
            placeholder="Display name"
            value={sendName}
            onChange={e => setSendName(e.target.value)}
            className="flex-1 min-w-40 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            disabled={sendState === 'sending'}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {sendState === 'sending' ? 'Sending…' : 'Send survey'}
          </button>
          {sendState === 'sent'  && <p className="text-emerald-400 text-xs self-center">✓ Survey sent</p>}
          {sendState === 'error' && <p className="text-red-400    text-xs self-center">Send failed</p>}
        </form>
      </div>

      {/* ── Responses list ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Responses ({responses.filter(r => r.score !== null).length})
          </p>
        </div>
        {responses.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-600 text-center">No surveys sent yet.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {responses.map(r => (
              <div key={r.id} className="px-5 py-4 flex items-start gap-4">
                {/* Score badge */}
                <div className="shrink-0 pt-0.5">
                  {r.score !== null ? (
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border text-sm font-bold ${scoreColor(r.score)}`}>
                      {r.score}
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 text-xs">
                      –
                    </span>
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate">{r.email}</span>
                    {r.score !== null && (
                      <span className="text-xs text-slate-600">{scoreLabel(r.score)}</span>
                    )}
                    {r.score === null && (
                      <span className="text-xs text-slate-600 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">Pending</span>
                    )}
                  </div>
                  {r.comment && (
                    <p className="mt-1 text-sm text-slate-400 leading-snug">&ldquo;{r.comment}&rdquo;</p>
                  )}
                  <p className="mt-1 text-xs text-slate-600">
                    Sent {fmt(r.sent_at)}
                    {r.responded_at ? ` · Responded ${fmt(r.responded_at)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
