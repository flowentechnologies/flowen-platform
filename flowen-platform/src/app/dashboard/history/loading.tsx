function Bone({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-800/70 ${className}`} />
  );
}

export default function HistoryLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Bone className="h-7 w-48" />
        <Bone className="h-3 w-32" />
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <Bone className="h-2.5 w-20" />
            <Bone className="h-8 w-16" />
            <Bone className="h-2 w-12" />
          </div>
        ))}
      </div>

      {/* Search bar skeleton */}
      <Bone className="h-9 w-64 rounded-xl" />

      {/* Table card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="px-6 py-4 border-b border-slate-800">
          <Bone className="h-3 w-24" />
        </div>

        {/* Table rows */}
        <div className="divide-y divide-slate-800">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="px-6 py-3 flex items-center gap-6"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <Bone className="h-2.5 w-24" />
              <Bone className="h-2.5 w-20" />
              <Bone className="h-2.5 w-12" />
              <Bone className="h-2.5 w-8" />
              <Bone className="h-2.5 w-10" />
              <div className="flex-1 h-2 bg-slate-800/70 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-700/70 rounded-full animate-pulse"
                  style={{ width: `${20 + (i * 13) % 70}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
