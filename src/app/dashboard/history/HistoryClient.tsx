'use client';

import { useState, useMemo, useCallback, Fragment } from 'react';
import Link from 'next/link';
import type { PracticeSession } from './page';
import { formatDate, formatDuration, formatTotalTime } from '@/lib/format';

// ── Recording player ─────────────────────────────────────────────────────────

function RecordingPlayer({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [url, setUrl]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (state !== 'idle') return;
    setState('loading');
    try {
      const res = await fetch(`/api/practice/sessions/${sessionId}/recording`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { url: string };
      setUrl(data.url);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [sessionId, state]);

  if (state === 'ready' && url) {
    return (
      <audio
        controls
        autoPlay
        src={url}
        className="h-7 w-40 accent-emerald-500"
        aria-label="Session recording"
      />
    );
  }

  if (state === 'error') {
    return (
      <button
        onClick={() => setState('idle')}
        className="text-xs text-red-400 hover:text-red-300 transition-colors"
        title="Retry"
      >
        Error — retry
      </button>
    );
  }

  return (
    <button
      onClick={load}
      disabled={state === 'loading'}
      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors font-semibold"
      aria-label="Play recording"
    >
      {state === 'loading' ? (
        <>
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Loading…
        </>
      ) : (
        <>
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
          </svg>
          Play
        </>
      )}
    </button>
  );
}

function TranscriptRow({ transcript, colSpan }: { transcript: string; colSpan: number }) {
  return (
    <tr className="bg-slate-800/30">
      <td colSpan={colSpan} className="px-6 py-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">Transcript</p>
        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
          {transcript}
        </p>
      </td>
    </tr>
  );
}

const STAGE_NAMES: Record<number, string> = {
  1: 'Breathing',
  2: 'Easy Onset',
  3: 'Light Contacts',
  4: 'Pausing',
  5: 'Conversation',
};

const PAGE_SIZE = 20;

function calcBpm(blocks: number, seconds: number): number {
  if (seconds <= 0) return 0;
  return blocks / (seconds / 60);
}

function blocksColor(blocks: number): string {
  if (blocks === 0) return 'text-emerald-400';
  if (blocks <= 4) return 'text-amber-400';
  return 'text-red-400';
}

function bpmBarWidth(bpm: number): number {
  const MAX_BPM = 10;
  return Math.min(100, (bpm / MAX_BPM) * 100);
}

function bpmBarColor(bpm: number): string {
  if (bpm < 2) return 'bg-emerald-500';
  if (bpm <= 5) return 'bg-amber-500';
  return 'bg-red-500';
}

interface Props {
  sessions: PracticeSession[];
}

export function HistoryClient({ sessions }: Props) {
  const [filter, setFilter] = useState('');
  const [stageFilter, setStageFilter] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = sessions;
    if (stageFilter !== null) result = result.filter(s => s.stage_id === stageFilter);
    const q = filter.trim().toLowerCase();
    if (q) result = result.filter(s => formatDate(s.created_at).toLowerCase().includes(q));
    return result;
  }, [sessions, filter, stageFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  function PageButtons() {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={safePage === 1}
          className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Prev
        </button>
        <span className="text-xs text-slate-500 tabular-nums">
          Page {safePage} of {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={safePage === totalPages}
          className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    );
  }

  const pageSlice = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Summary stats over ALL sessions (not just filtered)
  const totalSessions = sessions.length;
  const totalSeconds = sessions.reduce((a, s) => a + s.duration_seconds, 0);

  const qualifiedSessions = sessions.filter((s) => s.duration_seconds >= 30);
  const bestSession =
    qualifiedSessions.length > 0
      ? qualifiedSessions.reduce((best, s) => {
          const bpm = calcBpm(s.total_blocks_detected, s.duration_seconds);
          const bestBpm = calcBpm(best.total_blocks_detected, best.duration_seconds);
          return bpm < bestBpm ? s : best;
        })
      : null;
  const bestBpm = bestSession
    ? calcBpm(bestSession.total_blocks_detected, bestSession.duration_seconds)
    : null;

  const avgBpm =
    sessions.length > 0
      ? sessions.reduce((a, s) => a + calcBpm(s.total_blocks_detected, s.duration_seconds), 0) /
        sessions.length
      : null;

  if (totalSessions === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Session History</h1>
          <p className="text-slate-400 text-sm mt-1">All your practice sessions in one place.</p>
        </div>
        <div className="mt-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <p className="text-slate-900 dark:text-white font-semibold text-lg">No sessions yet.</p>
          <p className="text-slate-400 text-sm">
            Start your first practice session to see your history here.
          </p>
          <Link
            href="/dashboard/practice"
            className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 dark:text-white text-sm font-semibold transition-colors"
          >
            Start practising
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Session History</h1>
        <p className="text-slate-400 text-sm mt-1">
          {totalSessions} session{totalSessions !== 1 ? 's' : ''} recorded
        </p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Total sessions',
            value: String(totalSessions),
            sub: 'lifetime',
          },
          {
            label: 'Practice time',
            value: formatTotalTime(totalSeconds),
            sub: 'total',
          },
          {
            label: 'Best session',
            value: bestBpm !== null ? bestBpm.toFixed(1) : '—',
            sub: 'lowest bpm (≥30s)',
          },
          {
            label: 'Avg blocks / min',
            value: avgBpm !== null ? avgBpm.toFixed(1) : '—',
            sub: 'all time',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-2"
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              {card.label}
            </span>
            <span className="text-3xl font-bold text-slate-900 dark:text-white leading-none">{card.value}</span>
            <span className="text-slate-400 text-xs">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* Search / filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            placeholder="Filter by date (e.g. Jul)"
            className="pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 text-sm text-slate-900 dark:text-white placeholder-slate-600 outline-none transition-colors w-52"
          />
        </div>
        <select
          value={stageFilter ?? ''}
          onChange={e => { setStageFilter(e.target.value === '' ? null : Number(e.target.value)); setPage(1); }}
          className="py-2 pl-3 pr-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500/60 text-sm text-slate-900 dark:text-white outline-none transition-colors appearance-none cursor-pointer"
        >
          <option value="">All stages</option>
          {Object.entries(STAGE_NAMES).map(([id, name]) => (
            <option key={id} value={id}>Stage {id} — {name}</option>
          ))}
        </select>
        {(filter || stageFilter !== null) && (
          <span className="text-xs text-slate-500">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
        {(filter || stageFilter !== null) && (
          <button
            onClick={() => { setFilter(''); setStageFilter(null); setPage(1); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-slate-900 dark:text-white font-semibold text-sm">All sessions</h2>
          <PageButtons />
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-500 text-sm">
            No sessions match &ldquo;{filter}&rdquo;
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-800/60">
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600 whitespace-nowrap">
                    Date
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600 whitespace-nowrap">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600 whitespace-nowrap">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600 whitespace-nowrap">
                    Blocks
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600 whitespace-nowrap">
                    Blocks / min
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600 whitespace-nowrap min-w-[100px]">
                    Intensity
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600 whitespace-nowrap">
                    Prolong
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600 whitespace-nowrap">
                    Reps
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600 whitespace-nowrap">
                    Transcript
                  </th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600 whitespace-nowrap">
                    Recording
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {pageSlice.map((s) => {
                  const bpm = calcBpm(s.total_blocks_detected, s.duration_seconds);
                  const barWidth = bpmBarWidth(bpm);
                  const stageName = s.stage_id ? (STAGE_NAMES[s.stage_id] ?? `Stage ${s.stage_id}`) : '—';
                  const isExpanded = expandedId === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                          {formatDate(s.created_at)}
                        </td>
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap">
                          {stageName}
                        </td>
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap">
                          {formatDuration(s.duration_seconds)}
                        </td>
                        <td className={`px-6 py-3 text-xs font-semibold tabular-nums ${blocksColor(s.total_blocks_detected)}`}>
                          {s.total_blocks_detected}
                        </td>
                        <td className="px-6 py-3 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {bpm.toFixed(1)}
                        </td>
                        <td className="px-6 py-3">
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden min-w-[80px]">
                            <div
                              className={`h-full rounded-full transition-all ${bpmBarColor(bpm)}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-3 text-xs tabular-nums font-mono text-center">
                          {s.total_prolongations_detected > 0
                            ? <span className="text-violet-400 font-semibold">{s.total_prolongations_detected}</span>
                            : <span className="text-slate-700">—</span>}
                        </td>
                        <td className="px-6 py-3 text-xs tabular-nums font-mono text-center">
                          {s.total_repetitions_detected > 0
                            ? <span className="text-amber-400 font-semibold">{s.total_repetitions_detected}</span>
                            : <span className="text-slate-700">—</span>}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {s.transcript ? (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : s.id)}
                              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-semibold"
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'Hide transcript' : 'Show transcript'}
                            >
                              {isExpanded ? 'Hide' : 'View'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-700">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {s.has_recording
                            ? <RecordingPlayer sessionId={s.id} />
                            : <span className="text-xs text-slate-700">—</span>}
                        </td>
                      </tr>
                      {isExpanded && s.transcript && (
                        <TranscriptRow transcript={s.transcript} colSpan={10} />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-600 tabular-nums">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <PageButtons />
          </div>
        )}
      </div>
    </div>
  );
}
