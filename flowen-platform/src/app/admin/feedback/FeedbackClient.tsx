'use client';

import React, { useState } from 'react';

type FeedbackType = 'issue' | 'idea' | 'compliment' | 'general';

interface FeedbackRow {
  id: string;
  user_id: string | null;
  type: FeedbackType;
  rating: number | null;
  comment: string | null;
  page: string | null;
  created_at: string;
}

interface Props {
  initialFeedback: FeedbackRow[];
}

const TYPE_CONFIG: Record<FeedbackType, { label: string; color: string }> = {
  issue:      { label: 'Issue',      color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  idea:       { label: 'Idea',       color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  compliment: { label: 'Compliment', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  general:    { label: 'General',    color: 'bg-slate-700 text-slate-400 border-slate-600' },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Stars({ n }: { n: number }) {
  return (
    <span>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? 'text-amber-400' : 'text-slate-700'}>★</span>
      ))}
    </span>
  );
}

export default function FeedbackClient({ initialFeedback }: Props) {
  const [filter, setFilter] = useState<FeedbackType | 'all'>('all');

  const visible = filter === 'all'
    ? initialFeedback
    : initialFeedback.filter(f => f.type === filter);

  const counts = {
    all:        initialFeedback.length,
    issue:      initialFeedback.filter(f => f.type === 'issue').length,
    idea:       initialFeedback.filter(f => f.type === 'idea').length,
    compliment: initialFeedback.filter(f => f.type === 'compliment').length,
    general:    initialFeedback.filter(f => f.type === 'general').length,
  };

  const avgRating = (() => {
    const rated = initialFeedback.filter(f => f.rating !== null);
    if (!rated.length) return null;
    return (rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length).toFixed(1);
  })();

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          { label: 'Total',       value: String(counts.all)        },
          { label: 'Issues',      value: String(counts.issue)      },
          { label: 'Ideas',       value: String(counts.idea)       },
          { label: 'Avg rating',  value: avgRating ? `${avgRating}/5` : '—' },
        ] as {label:string;value:string}[]).map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-slate-100">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'issue', 'idea', 'compliment', 'general'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filter === t
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'all' ? 'All' : TYPE_CONFIG[t].label} ({counts[t]})
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {visible.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-600 text-center">No feedback yet.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {visible.map(f => {
              const tc = TYPE_CONFIG[f.type] ?? TYPE_CONFIG.general;
              return (
                <div key={f.id} className="px-5 py-4 flex items-start gap-4">
                  <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded border text-xs font-semibold ${tc.color}`}>
                    {tc.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    {f.rating !== null && (
                      <div className="mb-1"><Stars n={f.rating} /></div>
                    )}
                    {f.comment ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">&ldquo;{f.comment}&rdquo;</p>
                    ) : (
                      <p className="text-sm text-slate-600 italic">No comment</p>
                    )}
                    <p className="mt-1 text-xs text-slate-600">
                      {fmt(f.created_at)}
                      {f.page ? ` · ${f.page}` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
