'use client';

export default function SentryTestButton() {
  return (
    <button
      onClick={() => { throw new Error('Sentry test error — safe to delete'); }}
      className="text-xs font-mono px-3 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
    >
      Throw Sentry test error
    </button>
  );
}
