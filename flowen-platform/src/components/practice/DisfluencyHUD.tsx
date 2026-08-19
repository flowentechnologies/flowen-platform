'use client';

/**
 * DisfluencyHUD — real-time disfluency event display for the practice screen.
 *
 * Shows:
 *  • Live event feed (last 8 events, colour-coded by type)
 *  • Per-type event counts for the session
 *  • Speaker baseline calibration status
 *  • Current voice activity (RMS bar)
 *
 * Designed to sit below the avatar or in a side panel without ocluding the
 * primary practice UI.
 */
import { useEffect, useRef } from 'react';
import type { DisfluencyEvent, SpeakerBaseline } from '@/lib/disfluency/types';

// ── Type colour config ─────────────────────────────────────────────────────────

const TYPE_META: Record<DisfluencyEvent['type'], {
  label: string;
  badge: string;       // Tailwind classes for the event badge
  dot:   string;       // Tailwind classes for the count dot
  icon:  string;       // emoji shorthand
}> = {
  BLOCK:     { label: 'Block',       badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',     dot: 'bg-rose-500',    icon: '⛔' },
  PROLONG:   { label: 'Prolongation', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30', dot: 'bg-violet-500', icon: '〰️' },
  REP_START: { label: 'Rep ↓',       badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',   dot: 'bg-amber-500',   icon: '🔁' },
  REP_END:   { label: 'Rep ↑',       badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',   dot: 'bg-amber-500',   icon: '🔁' },
  INTERJ:    { label: 'Filler',      badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',         dot: 'bg-sky-500',     icon: '💬' },
};

// ── Summary event counts (collapses REP_START + REP_END into REP) ─────────────

const SUMMARY_TYPES: { key: DisfluencyEvent['type'] | 'REP'; label: string; dot: string }[] = [
  { key: 'BLOCK',   label: 'Blocks',        dot: 'bg-rose-500' },
  { key: 'PROLONG', label: 'Prolongations', dot: 'bg-violet-500' },
  { key: 'REP',     label: 'Repetitions',   dot: 'bg-amber-500' },
];

interface Props {
  events:       DisfluencyEvent[];
  eventCounts:  Record<DisfluencyEvent['type'], number>;
  baseline:     SpeakerBaseline;
  isCalibrated: boolean;
  /** Current RMS amplitude in [0, 1] for the voice meter bar */
  rms:          number;
  isRecording:  boolean;
}

export function DisfluencyHUD({
  events,
  eventCounts,
  baseline,
  isCalibrated,
  rms,
  isRecording,
}: Props) {
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the event feed to the latest entry
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events.length]);

  const recentEvents = events.slice(-8);

  const repCount = (eventCounts['REP_START'] ?? 0); // one rep = one START

  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800
                    bg-white dark:bg-slate-900 overflow-hidden text-sm select-none">

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5
                      border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            isRecording ? 'bg-rose-500 animate-pulse' : 'bg-slate-600'
          }`} />
          <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
            Disfluency Detector
          </span>
          <span className="text-[10px] font-mono text-slate-600 bg-slate-100 dark:bg-slate-800
                           px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            rule-based
          </span>
        </div>

        {/* Calibration status */}
        {isRecording && (
          <div className="flex items-center gap-1.5">
            {isCalibrated ? (
              <span className="text-[10px] font-mono text-emerald-400">
                ✓ calibrated ({baseline.segmentCount} segs)
              </span>
            ) : (
              <span className="text-[10px] font-mono text-amber-400">
                calibrating… {baseline.segmentCount}/8
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-0">

        {/* ── Left: event feed ───────────────────────────────────────────────── */}
        <div className="border-r border-slate-100 dark:border-slate-800">

          {/* Voice activity meter */}
          {isRecording && (
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 w-5">MIC</span>
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${Math.min(100, rms * 800)}%`,
                      background: rms > 0.05 ? '#10b981' : '#475569',
                    }}
                  />
                </div>
                {rms > 0.05 && (
                  <span className="text-[10px] font-mono text-emerald-400 w-8 text-right tabular-nums">
                    {(rms * 100).toFixed(0)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Event feed */}
          <div
            ref={feedRef}
            className="h-32 overflow-y-auto px-4 py-2 space-y-1.5 scroll-smooth"
            aria-label="Disfluency event feed"
            aria-live="polite"
          >
            {recentEvents.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <span className="text-[11px] font-mono text-slate-600">
                  {isRecording ? 'Listening…' : 'Start recording to begin detection'}
                </span>
              </div>
            ) : (
              recentEvents.map(ev => {
                const meta = TYPE_META[ev.type];
                const durationSec = (ev.duration_ms / 1000).toFixed(2);
                return (
                  <div
                    key={ev.id}
                    className={`flex items-center justify-between gap-2 px-2 py-1
                                rounded-lg border text-[11px] font-mono ${meta.badge}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span>{meta.icon}</span>
                      <span className="font-bold truncate">{meta.label}</span>
                      <span className="opacity-60">{durationSec}s</span>
                    </div>
                    <span className="opacity-50 shrink-0">
                      {(ev.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Baseline stats */}
          {isCalibrated && (
            <div className="px-4 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800
                            flex items-center gap-4 text-[10px] font-mono text-slate-500">
              <span>μ {(baseline.mean / 1000).toFixed(2)}s</span>
              <span>σ {(baseline.stddev / 1000).toFixed(2)}s</span>
              <span>prolong &gt; {((baseline.mean + 2.1 * baseline.stddev) / 1000).toFixed(2)}s</span>
            </div>
          )}
        </div>

        {/* ── Right: session counts ──────────────────────────────────────────── */}
        <div className="flex flex-col justify-center gap-3 px-5 py-4 min-w-[110px]">
          <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1">
            This session
          </p>
          {SUMMARY_TYPES.map(({ key, label, dot }) => {
            const count = key === 'REP'
              ? repCount
              : (eventCounts[key as DisfluencyEvent['type']] ?? 0);
            return (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  <span className="text-[11px] font-mono text-slate-400">{label}</span>
                </div>
                <span className={`text-sm font-bold font-mono tabular-nums ${
                  count > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-600'
                }`}>
                  {count}
                </span>
              </div>
            );
          })}

          {/* Total */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-1
                          flex items-center justify-between gap-3">
            <span className="text-[11px] font-mono text-slate-500">Total</span>
            <span className="text-sm font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {events.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
