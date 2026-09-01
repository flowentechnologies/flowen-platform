'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report admin errors to Sentry with elevated priority
    Sentry.captureException(error, {
      tags: { area: 'admin', digest: error.digest },
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="bg-slate-900 border border-red-500/30 rounded-xl p-8 max-w-lg w-full">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-red-400 text-xl">⚠️</span>
          <h1 className="text-lg font-bold text-slate-100">Admin error</h1>
        </div>
        <p className="text-slate-400 text-sm mb-2">
          Something went wrong loading this page. The error has been reported automatically.
        </p>
        {error.digest && (
          <p className="text-slate-600 text-xs font-mono mb-6">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/admin'}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg transition-colors"
          >
            Back to admin home
          </button>
        </div>
      </div>
    </div>
  );
}
