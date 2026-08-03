'use client';

import { useState } from 'react';
import { EXERCISES } from '@/lib/exercises';

interface Props {
  stageId: number;
}

function WordGrid({ words }: { words: string[] }) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {words.map((word, i) => (
        <button
          key={i}
          onClick={() => setActive(active === i ? null : i)}
          className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-all ${
            active === i
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
          }`}
        >
          {word}
        </button>
      ))}
    </div>
  );
}

function PhraseList({ phrases }: { phrases: string[] }) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <div className="space-y-1.5">
      {phrases.map((phrase, i) => (
        <button
          key={i}
          onClick={() => setActive(active === i ? null : i)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-all ${
            active === i
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:border-slate-600'
          }`}
        >
          {phrase.split(' / ').map((chunk, j, arr) => (
            <span key={j}>
              {chunk}
              {j < arr.length - 1 && (
                <span className="text-slate-500 mx-1">/</span>
              )}
            </span>
          ))}
        </button>
      ))}
    </div>
  );
}

function PassageDisplay({ text }: { text: string }) {
  const segments = text.split(' / ');
  return (
    <div className="bg-slate-800/40 rounded-xl px-4 py-4 text-sm text-slate-200 leading-loose">
      {segments.map((seg, i) => (
        <span key={i}>
          {seg}
          {i < segments.length - 1 && (
            <>
              {' '}
              <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold bg-slate-700 text-slate-400 mx-0.5 leading-none">
                /
              </span>{' '}
            </>
          )}
        </span>
      ))}
    </div>
  );
}

function PromptCard({ prompt }: { prompt: string }) {
  const [lines, ...rest] = prompt.split('\n\n');
  return (
    <div className="bg-slate-800/40 rounded-xl px-4 py-4 space-y-2">
      <p className="text-white text-sm font-semibold leading-relaxed">{lines}</p>
      {rest.map((para, i) => (
        <p key={i} className="text-slate-400 text-xs leading-relaxed">{para}</p>
      ))}
    </div>
  );
}

// Rotate starting exercise daily so users don't always begin at the same one
function dailyOffset(stageId: number, total: number): number {
  if (total === 0) return 0;
  const dayOfYear = Math.floor(Date.now() / 86_400_000);
  return (dayOfYear + stageId) % total;
}

export function ExercisePanel({ stageId }: Props) {
  const exercises = EXERCISES[stageId] ?? [];
  const [idx, setIdx] = useState(() => dailyOffset(stageId, exercises.length));
  if (exercises.length === 0) return null;

  const ex = exercises[Math.min(idx, exercises.length - 1)];
  const total = exercises.length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
            Exercise material
          </p>
          <p className="text-white font-semibold text-sm mt-0.5 truncate">{ex.title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Previous exercise"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
          </button>
          <span className="text-[10px] font-mono text-slate-500 w-8 text-center">{idx + 1}/{total}</span>
          <button
            onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Next exercise"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4l4 4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-slate-400 text-xs leading-relaxed italic border-l-2 border-slate-700 pl-3">
        {ex.instructions}
      </p>

      {ex.type === 'words' && <WordGrid words={ex.content} />}
      {ex.type === 'phrases' && <PhraseList phrases={ex.content} />}
      {ex.type === 'passage' && <PassageDisplay text={ex.content[0]} />}
      {ex.type === 'prompt' && <PromptCard prompt={ex.content[0]} />}

      <div className="flex gap-1 justify-center pt-1">
        {exercises.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-emerald-400 w-4' : 'bg-slate-700 hover:bg-slate-500'}`}
            aria-label={`Go to exercise ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
