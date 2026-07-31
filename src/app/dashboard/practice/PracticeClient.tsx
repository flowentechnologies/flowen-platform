'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Stage definitions
// ---------------------------------------------------------------------------

const STAGES = [
  {
    id: 1,
    name: 'Diaphragmatic Breathing',
    target: 'Pacing Rate: 6 BPM',
    desc: 'Regulate airflow and establish vocal rhythm before speech.',
    instruction:
      'Breathe in for 4 counts through your nose, then exhale slowly for 6 counts. Feel your diaphragm expand, not your chest.',
    cue: 'Breathe in... 2... 3... 4... Out... 2... 3... 4... 5... 6',
    minMins: 2,
  },
  {
    id: 2,
    name: 'Easy Onset & Prolongation',
    target: 'Soft Vocal Start',
    desc: 'Initiate sound with minimal laryngeal tension — no hard glottal attacks.',
    instruction:
      'Begin words softly, as if your voice is "floating" into sound. Practise starting vowel-initial words gently: "eeeasy", "ooopen", "aaaaim".',
    cue: 'Start each word softly... ease into sound... no pushing',
    minMins: 2,
  },
  {
    id: 3,
    name: 'Light Articulatory Contacts',
    target: 'Reduced Pressure',
    desc: 'Use minimal contact pressure on plosive consonants (/p/, /b/, /t/, /d/, /k/, /g/).',
    instruction:
      'Speak aloud a word list with plosive sounds. Focus on barely touching your lips or tongue — just enough to shape the sound.',
    cue: 'Light touch... barely there... keep moving forward',
    minMins: 3,
  },
  {
    id: 4,
    name: 'Pausing & Phrasing',
    target: 'Chunk Size: 3-5 Words',
    desc: 'Group speech into short thought chunks with deliberate, comfortable pauses between them.',
    instruction:
      'Read aloud or speak spontaneously. Every 3–5 words, take a relaxed pause before continuing. Let the pause belong to you.',
    cue: 'Speak... pause... breathe... continue',
    minMins: 3,
  },
  {
    id: 5,
    name: 'Conversational Flow',
    target: 'Fluency > 85%',
    desc: 'Apply all techniques in natural, spontaneous speech without conscious monitoring.',
    instruction:
      'Speak freely — describe your day, read a passage, or narrate something. Apply your techniques naturally, without over-monitoring each word.',
    cue: 'Speak freely... techniques in the background',
    minMins: 5,
  },
] as const;

type StageId = 1 | 2 | 3 | 4 | 5;
type Screen = 'select' | 'ready' | 'recording' | 'summary';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecentSession {
  id: string;
  duration_seconds: number;
  total_blocks_detected: number;
  created_at: string;
  bpm: number;
}

interface Props {
  recommendedStage: number;
  recentSessions: RecentSession[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDurationLong(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function bpmLabel(bpm: number): string {
  return `${bpm.toFixed(1)} blocks/min`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PracticeClient({ recommendedStage, recentSessions }: Props) {
  const [screen, setScreen] = useState<Screen>('select');
  const [stageId, setStageId] = useState<StageId>(
    Math.min(5, Math.max(1, recommendedStage)) as StageId,
  );
  const [elapsed, setElapsed] = useState(0);
  const [blocks, setBlocks] = useState(0);
  const [amplitude, setAmplitude] = useState(0);
  const [freqData, setFreqData] = useState<number[]>(new Array(32).fill(0));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Block detection refs (mutable, source of truth during recording)
  const isSpeakingRef = useRef(false);
  const silenceStartRef = useRef<number | null>(null);
  const blocksRef = useRef(0);

  const stage = STAGES[stageId - 1];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------

  const startRecording = useCallback(async () => {
    setMicError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setMicError(
        'Microphone access denied. Please allow microphone access in your browser settings and try again.',
      );
      return;
    }

    streamRef.current = stream;

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    analyserRef.current = analyser;

    // Reset state
    blocksRef.current = 0;
    isSpeakingRef.current = false;
    silenceStartRef.current = null;
    setBlocks(0);
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);

    const buf = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(buf);

      // RMS amplitude
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      setAmplitude(Math.round(rms));

      // 32 waveform bars
      const step = Math.floor(buf.length / 32);
      const bars: number[] = [];
      for (let i = 0; i < 32; i++) {
        bars.push(buf[i * step]);
      }
      setFreqData(bars);

      // Block detection heuristic
      const SPEECH_THRESH = 18;
      const BLOCK_SILENCE_MS = 280;
      const now = Date.now();

      if (rms > SPEECH_THRESH) {
        isSpeakingRef.current = true;
        silenceStartRef.current = null;
      } else if (isSpeakingRef.current) {
        if (silenceStartRef.current === null) {
          silenceStartRef.current = now;
        } else if (now - silenceStartRef.current > BLOCK_SILENCE_MS) {
          blocksRef.current += 1;
          setBlocks(blocksRef.current);
          isSpeakingRef.current = false;
          silenceStartRef.current = null;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    setScreen('recording');
  }, []);

  const stopRecording = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    setScreen('summary');
  }, []);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const saveSession = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    const res = await fetch('/api/practice/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duration_seconds: elapsed,
        total_blocks_detected: blocksRef.current,
        stage_id: stageId,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      setSaveError(json.error ?? 'Failed to save session');
      setSaving(false);
      return;
    }
    window.location.href = '/dashboard';
  }, [elapsed, stageId]);

  const discardAndReset = useCallback(() => {
    blocksRef.current = 0;
    isSpeakingRef.current = false;
    silenceStartRef.current = null;
    setBlocks(0);
    setElapsed(0);
    setAmplitude(0);
    setFreqData(new Array(32).fill(0));
    setSaveError(null);
    setScreen('select');
  }, []);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const currentBpm = elapsed > 0 ? (blocks / (elapsed / 60)) : 0;
  const lastSession = recentSessions[0] ?? null;

  // ---------------------------------------------------------------------------
  // Screen: select
  // ---------------------------------------------------------------------------

  if (screen === 'select') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Practice Engine
            </span>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Choose your stage
            </h1>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            STAGE {stageId} OF 5
          </span>
        </div>

        {/* Stage selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
            Select stage
          </p>
          <div className="flex gap-3 justify-center">
            {STAGES.map(s => (
              <div key={s.id} className="flex flex-col items-center gap-1">
                {s.id === recommendedStage && (
                  <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400">
                    rec.
                  </span>
                )}
                {s.id !== recommendedStage && (
                  <span className="text-[9px] font-mono uppercase tracking-widest text-transparent select-none">
                    rec.
                  </span>
                )}
                <button
                  onClick={() => setStageId(s.id as StageId)}
                  className={`w-11 h-11 rounded-full text-sm font-bold border transition-all ${
                    s.id === stageId
                      ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-slate-200'
                  }`}
                >
                  {s.id}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Stage detail card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              {stage.target}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">{stage.name}</h2>
          <p className="text-slate-400 leading-relaxed text-sm">{stage.desc}</p>
          <div className="border-t border-slate-800 pt-4 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Instruction
            </p>
            <p className="text-slate-300 text-sm leading-relaxed">{stage.instruction}</p>
          </div>
          <div className="border-t border-slate-800 pt-4 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Cue
            </p>
            <p className="text-slate-400 text-sm italic">{stage.cue}</p>
          </div>
          <div className="border-t border-slate-800 pt-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Recommended duration: {stage.minMins} min
            </p>
          </div>
        </div>

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Recent sessions
            </p>
            <div className="space-y-3">
              {recentSessions.slice(0, 3).map((s, i) => {
                const prevBpm = recentSessions[i + 1]?.bpm ?? null;
                let trendChar = '';
                if (prevBpm !== null) {
                  trendChar = s.bpm < prevBpm ? 'v' : s.bpm > prevBpm ? '^' : '-';
                }
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-500 font-mono text-xs">
                      {formatDate(s.created_at)}
                    </span>
                    <span className="text-slate-400">
                      {formatDurationLong(s.duration_seconds)}
                    </span>
                    <span className="text-slate-400 font-mono text-xs">
                      {bpmLabel(s.bpm)}{' '}
                      {trendChar && (
                        <span
                          className={
                            trendChar === 'v'
                              ? 'text-emerald-400'
                              : trendChar === '^'
                                ? 'text-red-400'
                                : 'text-slate-500'
                          }
                        >
                          {trendChar === 'v' ? 'down' : trendChar === '^' ? 'up' : 'same'}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => setScreen('ready')}
          className="w-full rounded-xl px-6 py-3 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
        >
          Begin session
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Screen: ready
  // ---------------------------------------------------------------------------

  if (screen === 'ready') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <button
          onClick={() => { setMicError(null); setScreen('select'); }}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Back
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
            {stage.target}
          </span>
          <h2 className="text-xl font-bold text-white">{stage.name}</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{stage.instruction}</p>

          <div className="border-t border-slate-800 pt-4 space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Before you begin
            </p>
            <p className="text-slate-400 text-sm">
              Click Start to allow microphone access. Audio is processed locally and not recorded.
            </p>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              {stage.minMins} min recommended
            </p>
          </div>

          {micError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-red-400 text-sm">{micError}</p>
            </div>
          )}
        </div>

        <button
          onClick={startRecording}
          className="w-full rounded-xl px-6 py-3 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
        >
          Start session
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Screen: recording
  // ---------------------------------------------------------------------------

  if (screen === 'recording') {
    const speaking = amplitude > 18;
    const canStop = elapsed >= 10;

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Waveform card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          {/* Recording indicator */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              {stage.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-red-400">
                Recording
              </span>
            </div>
          </div>

          {/* Waveform bars */}
          <div className="flex items-end gap-0.5 h-16 justify-center">
            {freqData.map((v, i) => {
              const h = Math.max(2, Math.round((v / 255) * 64));
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm transition-all duration-75 ${
                    speaking ? 'bg-emerald-400' : 'bg-slate-700'
                  }`}
                  style={{ height: `${h}px` }}
                />
              );
            })}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 border-t border-slate-800 pt-4">
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
                Time
              </p>
              <p className="text-xl font-bold font-mono text-white">
                {formatDuration(elapsed)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
                Blocks
              </p>
              <p className={`text-xl font-bold font-mono ${blocks > 0 ? 'text-red-400' : 'text-white'}`}>
                {blocks}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
                Blocks/min
              </p>
              <p className="text-xl font-bold font-mono text-amber-400">
                {elapsed > 0 ? currentBpm.toFixed(1) : '—'}
              </p>
            </div>
          </div>

          {/* Cue */}
          <p className="text-center text-slate-400 text-sm italic">{stage.cue}</p>
        </div>

        {/* Stop button */}
        <button
          onClick={canStop ? stopRecording : undefined}
          disabled={!canStop}
          className={`w-full rounded-xl px-6 py-3 font-bold text-sm transition-colors ${
            canStop
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {canStop
            ? 'End session'
            : `Recording — ${elapsed}s (minimum 10s)`}
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Screen: summary
  // ---------------------------------------------------------------------------

  const summaryBpm = elapsed > 0 ? blocks / (elapsed / 60) : 0;
  const lastBpm = lastSession?.bpm ?? null;
  let comparisonText = '';
  let comparisonClass = 'text-slate-400';
  if (lastBpm !== null) {
    if (summaryBpm < lastBpm - 0.05) {
      comparisonText = 'down — improved vs last session';
      comparisonClass = 'text-emerald-400';
    } else if (summaryBpm > lastBpm + 0.05) {
      comparisonText = 'up — more blocks than last session';
      comparisonClass = 'text-red-400';
    } else {
      comparisonText = 'same as last session';
      comparisonClass = 'text-slate-400';
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
          Session complete
        </span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Your results
        </h1>
      </div>

      {/* Stats grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Duration
            </p>
            <p className="text-2xl font-bold font-mono text-white">
              {formatDurationLong(elapsed)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Blocks detected
            </p>
            <p className={`text-2xl font-bold font-mono ${blocks === 0 ? 'text-emerald-400' : blocks < 5 ? 'text-amber-400' : 'text-red-400'}`}>
              {blocks}
            </p>
            {blocks === 0 && (
              <p className="text-[10px] font-mono text-emerald-400">great session!</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Blocks per min
            </p>
            <p className="text-2xl font-bold font-mono text-amber-400">
              {summaryBpm.toFixed(1)}
            </p>
            <p className="text-[10px] font-mono text-slate-600">lower is better</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Stage
            </p>
            <p className="text-base font-bold text-white">{stage.name}</p>
          </div>
        </div>
      </div>

      {/* Comparison */}
      {lastBpm !== null && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
            vs last session
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-sm text-slate-400">
              Last: {lastBpm.toFixed(1)} blocks/min
            </span>
            <span className="text-slate-600">—</span>
            <span className="text-sm text-slate-400">
              This: {summaryBpm.toFixed(1)} blocks/min
            </span>
          </div>
          <p className={`text-sm font-mono ${comparisonClass}`}>{comparisonText}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={saveSession}
          disabled={saving}
          className="w-full rounded-xl px-6 py-3 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && (
            <svg className="animate-spin h-4 w-4 text-slate-950" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {saving ? 'Saving...' : 'Save & return to dashboard'}
        </button>

        {saveError && (
          <p className="text-red-400 text-sm text-center font-mono">{saveError}</p>
        )}

        <button
          onClick={discardAndReset}
          className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
        >
          Discard & practice again
        </button>
      </div>
    </div>
  );
}
