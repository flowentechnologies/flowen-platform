function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-800/70 ${className}`} />;
}

export default function PracticeLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Step bar */}
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className="w-7 h-7 rounded-full animate-pulse bg-slate-800/70 shrink-0" />
            {i < 3 && <div className="flex-1 h-0.5 animate-pulse bg-slate-800/70" />}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-2.5 w-24" />
          <Bone className="h-7 w-40" />
        </div>
        <Bone className="h-6 w-20 rounded-full" />
      </div>

      {/* Stage pills */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <Bone className="h-2.5 w-20" />
        <div className="flex gap-3 justify-center">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-2 w-6 animate-pulse rounded bg-slate-800/70" />
              <div className="w-12 h-12 rounded-full animate-pulse bg-slate-800/70" />
            </div>
          ))}
        </div>
      </div>

      {/* Detail card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <Bone className="h-2.5 w-28" />
        <Bone className="h-6 w-48" />
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-3/4" />
        <div className="border-t border-slate-800 pt-4 space-y-2">
          <Bone className="h-2 w-20" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-4/5" />
        </div>
      </div>

      {/* CTA */}
      <Bone className="h-12 w-full rounded-xl" />
    </div>
  );
}
