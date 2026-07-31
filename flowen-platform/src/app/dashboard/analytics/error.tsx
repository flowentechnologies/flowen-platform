'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function AnalyticsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <p className="text-slate-400 text-sm">Analytics failed to load.</p>
        {error.digest && <p className="text-[10px] text-slate-600 font-mono">ref: {error.digest}</p>}
        <button onClick={reset} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors">
          Try again
        </button>
      </div>
    </div>
  );
}
