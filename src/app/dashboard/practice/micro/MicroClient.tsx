'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Exercise definitions
// ---------------------------------------------------------------------------

const EXERCISES = [
  {
    id: 1,
    name: 'Diaphragmatic Breath',
    duration: 30,
    phases: [
      { label: 'Breathe in', duration: 4, color: 'emerald' },
      { label: 'Hold', duration: 2, color: 'amber' },
      { label: 'Breathe out', duration: 6, color: 'sky' },
    ],
    tip: 'Feel your belly expand — not your chest.',
  },
  {
    id: 2,
    name: 'Easy Onset',
    duration: 45,
    phases: [
      { label: 'Inhale gently', duration: 3, color: 'emerald' },
      { label: 'Float into sound', duration: 5, color: 'sky' },
      { label: 'Rest', duration: 2, color: 'slate' },
    ],
    tip: 'Start each word as if your voice is floating into it.',
  },
  {
    id: 3,
    name: 'Light Contacts',
    duration: 45,
    phases: [
      { label: 'Prepare', duration: 2, color: 'slate' },
      { label: 'Speak lightly', duration: 6, color: 'emerald' },
      { label: 'Pause', duration: 2, color: 'amber' },
    ],
    tip: 'Barely touch lips and tongue — just enough to shape the sound.',
  },
  {
    id: 4,
    name: 'Phrase & Pause',
    duration: 60,
    phases: [
      { label: 'Speak 3–5 words', duration: 5, color: 'sky' },
      { label: 'Pause & breathe', duration: 3, color: 'emerald' },
    ],
    tip: 'Each pause is yours — take ownership of it.',
  },
  {
    id: 5,
    name: 'Mindful Check-in',
    duration: 30,
    phases: [
      { label: 'Notice', duration: 5, color: 'violet' },
      { label: 'Accept', duration: 5, color: 'sky' },
      { label: 'Release', duration: 5, color: 'emerald' },
    ],
    tip: 'Observe any tension in your throat and jaw without judgment.',
  },
] as const;

type ExerciseId = (typeof EXERCISES)[number]['id'];
type Exercise = (typeof EXERCISES)[number];

// ---------------------------------------------------------------------------
// Color map
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<string, string> = {
  emerald: 'stroke-emerald-400',
  amber: 'stroke-amber-400',
  sky: 'stroke-sky-400',
  violet: 'stroke-violet-400',
  slate: 'stroke-slate-600',
};

const BG_COLOR_MAP: Record<string, string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  sky: 'text-sky-400',
  violet: 'text-violet-400',
  slate: 'text-slate-400',
};

// ---------------------------------------------------------------------------
// Timer ring component
// ---------------------------------------------------------------------------

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function TimerRing({
  progress,
  color,
}: {
  progress: number; // 0–1, where 1 = full ring
  color: string;
}) {
  const strokeClass = COLOR_MAP[color] ?? 'stroke-emerald-400';
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <svg
      width="104"
      height="104"
      viewBox="0 0 104 104"
      className="rotate-[-90deg]"
      aria-hidden="true"
    >
      {/* Background track */}
      <circle
        cx="52"
        cy="52"
        r={RADIUS}
        fill="none"
        className="stroke-slate-800"
        strokeWidth="8"
      />
      {/* Progress arc */}
      <circle
        cx="52"
        cy="52"
        r={RADIUS}
        fill="none"
        className={`${strokeClass} transition-all duration-1000 ease-linear`}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MicroClient() {
  const [activeId, setActiveId] = useState<ExerciseId | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState<Set<ExerciseId>>(new Set());
  const [showDone, setShowDone] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeExercise = EXERCISES.find(e => e.id === activeId) as Exercise | undefined;

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current);
    };
  }, []);

  function openExercise(exercise: Exercise) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current);
    setActiveId(exercise.id);
    setSecondsLeft(exercise.duration);
    setPhaseIndex(0);
    setPhaseSecondsLeft(exercise.phases[0].duration);
    setRunning(false);
    setShowDone(false);
  }

  function closeExercise() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActiveId(null);
    setRunning(false);
    setShowDone(false);
  }

  function startTimer(exercise: Exercise, currentPhaseIndex: number, currentPhaseSecondsLeft: number, currentSecondsLeft: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);

    let pIdx = currentPhaseIndex;
    let pSecs = currentPhaseSecondsLeft;
    let totalSecs = currentSecondsLeft;

    intervalRef.current = setInterval(() => {
      totalSecs -= 1;

      if (totalSecs <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setSecondsLeft(0);
        setRunning(false);
        setShowDone(true);
        setCompleted(prev => {
          const next = new Set(prev);
          next.add(exercise.id);
          return next;
        });
        doneTimeoutRef.current = setTimeout(() => setShowDone(false), 2000);
        return;
      }

      setSecondsLeft(totalSecs);

      pSecs -= 1;
      if (pSecs <= 0) {
        pIdx = (pIdx + 1) % exercise.phases.length;
        pSecs = exercise.phases[pIdx].duration;
        setPhaseIndex(pIdx);
      }
      setPhaseSecondsLeft(pSecs);
    }, 1000);
  }

  function handleStartPause() {
    if (!activeExercise) return;

    if (running) {
      // Pause
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setRunning(false);
    } else {
      // Start / Resume
      setRunning(true);
      startTimer(activeExercise, phaseIndex, phaseSecondsLeft, secondsLeft);
    }
  }

  const currentPhase = activeExercise?.phases[phaseIndex];
  const phaseProgress = currentPhase
    ? 1 - (phaseSecondsLeft - 1) / currentPhase.duration
    : 0;

  // ---------------------------------------------------------------------------
  // Render: exercise detail view
  // ---------------------------------------------------------------------------

  if (activeId && activeExercise) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Back link */}
        <Link
          href="/dashboard/practice"
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          &larr; Practice
        </Link>

        {/* Header */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
            Quick Practice
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {activeExercise.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeExercise.duration}s exercise
          </p>
        </div>

        {/* Timer card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center gap-6">
          {showDone ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4,12 9,17 20,6" />
                </svg>
              </div>
              <p className="text-xl font-bold text-emerald-400">Done!</p>
            </div>
          ) : (
            <>
              {/* Timer ring with phase seconds inside */}
              <div className="relative flex items-center justify-center">
                <TimerRing
                  progress={running ? phaseProgress : 1}
                  color={currentPhase?.color ?? 'emerald'}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold font-mono ${BG_COLOR_MAP[currentPhase?.color ?? 'emerald']}`}>
                    {phaseSecondsLeft}s
                  </span>
                </div>
              </div>

              {/* Phase label */}
              <div className="text-center space-y-1">
                <p className={`text-xl font-semibold ${BG_COLOR_MAP[currentPhase?.color ?? 'emerald']}`}>
                  {currentPhase?.label}
                </p>
                <p className="text-sm text-slate-500 font-mono">
                  {secondsLeft}s remaining
                </p>
              </div>

              {/* Tip */}
              <div className="w-full border-t border-slate-800 pt-4">
                <p className="text-xs text-slate-500 text-center italic leading-relaxed">
                  {activeExercise.tip}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        {!showDone && (
          <button
            onClick={handleStartPause}
            className="w-full rounded-xl px-6 py-4 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 transition-colors shadow-lg shadow-emerald-500/20"
          >
            {running ? 'Pause' : secondsLeft < activeExercise.duration ? 'Resume' : 'Start'}
          </button>
        )}

        <button
          onClick={closeExercise}
          className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
        >
          &larr; Back to exercises
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: exercise grid
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/practice"
        className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        &larr; Practice
      </Link>

      {/* Header */}
      <div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
          Quick Practice
        </span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Choose an exercise
        </h1>
        <p className="text-sm text-slate-500 mt-1">3&ndash;5 minute daily exercises</p>
      </div>

      {/* Exercise grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EXERCISES.map(exercise => {
          const isDone = completed.has(exercise.id);
          return (
            <button
              key={exercise.id}
              onClick={() => openExercise(exercise)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-5 text-left transition-all active:scale-[0.98] group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors truncate">
                    {exercise.name}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{exercise.duration}s</p>
                </div>
                {isDone && (
                  <div className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <svg viewBox="0 0 14 14" className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,7 5.5,11 12,3" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500 leading-relaxed line-clamp-2">
                {exercise.tip}
              </p>
            </button>
          );
        })}
      </div>

      {completed.size > 0 && (
        <p className="text-center text-xs text-slate-600 font-mono">
          {completed.size} of {EXERCISES.length} completed today
        </p>
      )}
    </div>
  );
}
