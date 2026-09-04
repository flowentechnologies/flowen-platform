'use client';

import React, { useState } from 'react';

const SCORES = [0,1,2,3,4,5,6,7,8,9,10];

function scoreColor(s: number) {
  if (s <= 6) return { bg: 'bg-red-500/10 border-red-500/30 text-red-400',    ring: 'ring-red-500'    };
  if (s <= 8) return { bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', ring: 'ring-amber-500' };
  return             { bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', ring: 'ring-emerald-500' };
}

function scoreLabel(s: number) {
  if (s <= 2)  return 'Very unlikely';
  if (s <= 4)  return 'Unlikely';
  if (s <= 6)  return 'Neutral';
  if (s <= 8)  return 'Likely';
  return 'Extremely likely';
}

interface Props {
  initialScore: number | null;
  token: string;
  alreadyResponded: boolean;
}

export default function NpsClient({ initialScore, token, alreadyResponded }: Props) {
  const [score,   setScore]   = useState<number | null>(initialScore);
  const [comment, setComment] = useState('');
  const [state,   setState]   = useState<'idle' | 'submitting' | 'done' | 'error'>(
    alreadyResponded ? 'done' : 'idle'
  );

  async function submit() {
    if (score === null) return;
    setState('submitting');
    try {
      const res = await fetch('/api/nps/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, score, comment }),
      });
      if (!res.ok) throw new Error();
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Thanks for your feedback</h2>
        <p className="text-slate-400 text-sm">
          {score !== null && score >= 9
            ? 'We\'re glad you\'re enjoying Flowen.'
            : score !== null && score >= 7
            ? 'Thanks — we\'re always working to improve.'
            : 'Thanks for your honesty. We\'ll use this to make Flowen better.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Score picker */}
      <div>
        <p className="text-sm text-slate-400 mb-4">
          On a scale of 0–10, how likely are you to recommend Flowen to a friend or colleague?
        </p>
        <div className="flex flex-wrap gap-2">
          {SCORES.map(s => {
            const c = scoreColor(s);
            const selected = score === s;
            return (
              <button
                key={s}
                onClick={() => setScore(s)}
                className={`w-10 h-10 rounded-lg border text-sm font-bold transition-all
                  ${c.bg}
                  ${selected ? `ring-2 ${c.ring} scale-110` : 'opacity-60 hover:opacity-100'}`}
              >
                {s}
              </button>
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-slate-400">Not at all likely</span>
          <span className="text-xs text-slate-400">Extremely likely</span>
        </div>
        {score !== null && (
          <p className="mt-3 text-sm font-medium text-slate-300">
            {score}/10 — {scoreLabel(score)}
          </p>
        )}
      </div>

      {/* Follow-up comment */}
      {score !== null && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <label className="block text-sm text-slate-400">
            {score >= 9
              ? 'What do you love most about Flowen? (optional)'
              : score >= 7
              ? 'What could we improve? (optional)'
              : 'What\'s the main reason for your score? (optional)'}
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Your thoughts…"
            rows={4}
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
          />
          <button
            onClick={submit}
            disabled={state === 'submitting'}
            className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors disabled:opacity-50"
          >
            {state === 'submitting' ? 'Saving…' : 'Submit feedback'}
          </button>
          {state === 'error' && (
            <p className="text-xs text-red-400 text-center">Something went wrong — please try again.</p>
          )}
        </div>
      )}
    </div>
  );
}
