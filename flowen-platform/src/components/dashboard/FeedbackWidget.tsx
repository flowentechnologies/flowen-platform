'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';

type FeedbackType = 'issue' | 'idea' | 'compliment';

const TYPES: { key: FeedbackType; label: string; icon: string }[] = [
  { key: 'issue',     label: 'Report an issue',  icon: '⚠' },
  { key: 'idea',      label: 'Share an idea',    icon: '💡' },
  { key: 'compliment',label: 'Give a compliment', icon: '✦' },
];

const RATINGS = [1,2,3,4,5];

export default function FeedbackWidget() {
  const [open,    setOpen]    = useState(false);
  const [type,    setType]    = useState<FeedbackType>('idea');
  const [rating,  setRating]  = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [state,   setState]   = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const panelRef  = useRef<HTMLDivElement>(null);
  const pathname  = usePathname();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Reset on open
  function handleOpen() {
    setOpen(true);
    setType('idea');
    setRating(null);
    setComment('');
    setState('idle');
  }

  async function submit() {
    if (!comment.trim() && !rating) return;
    setState('submitting');
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type, rating, comment: comment.trim(), page: pathname }),
      });
      if (!res.ok) throw new Error();
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 z-50" ref={panelRef}>

      {/* Panel */}
      {open && (
        <div className="absolute bottom-14 right-0 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
          <div className="h-0.5 bg-emerald-500" />

          {state === 'done' ? (
            <div className="p-6 text-center">
              <div className="text-3xl mb-3">✓</div>
              <p className="text-slate-200 font-semibold text-sm mb-1">Thanks for your feedback</p>
              <p className="text-slate-500 text-xs">It goes straight to the product team.</p>
              <button
                onClick={() => setOpen(false)}
                className="mt-5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-500">
                  Feedback
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-600 hover:text-slate-400 text-lg leading-none transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* Type selector */}
              <div className="flex gap-2">
                {TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setType(t.key)}
                    title={t.label}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                      type === t.key
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span className="block text-base mb-0.5">{t.icon}</span>
                    {t.key.charAt(0).toUpperCase() + t.key.slice(1)}
                  </button>
                ))}
              </div>

              {/* Star rating */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Overall experience</p>
                <div className="flex gap-1">
                  {RATINGS.map(r => (
                    <button
                      key={r}
                      onClick={() => setRating(rating === r ? null : r)}
                      className={`text-xl transition-all ${
                        rating !== null && r <= rating
                          ? 'text-amber-400 scale-110'
                          : 'text-slate-700 hover:text-amber-400/60'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder={
                    type === 'issue'      ? 'Describe what happened…'
                    : type === 'idea'    ? 'What would you like to see?'
                    : 'What did you enjoy?'
                  }
                  rows={3}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                />
              </div>

              {/* Submit */}
              <button
                onClick={submit}
                disabled={state === 'submitting' || (!comment.trim() && !rating)}
                className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors disabled:opacity-40"
              >
                {state === 'submitting' ? 'Sending…' : 'Send feedback'}
              </button>

              {state === 'error' && (
                <p className="text-xs text-red-400 text-center">Something went wrong — try again.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-full shadow-lg text-sm font-semibold text-slate-300 transition-all hover:scale-105"
        aria-label="Give feedback"
      >
        <span className="text-emerald-400 text-base leading-none">✦</span>
        Feedback
      </button>

    </div>
  );
}
