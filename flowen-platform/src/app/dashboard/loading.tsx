function Bone({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-800/70 ${className}`} />
  );
}

export default function DashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Bone className="h-3 w-24" />
        <Bone className="h-7 w-48" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <Bone className="h-2.5 w-20" />
            <Bone className="h-8 w-16" />
            <Bone className="h-2 w-12" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <Bone className="h-3 w-32" />
        <div className="flex items-end gap-1 h-28">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 animate-pulse rounded-sm bg-slate-800/70"
              style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 30}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Two column cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
            <Bone className="h-3 w-24" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <Bone className="h-2.5 w-16" />
                <Bone className="h-2.5 w-20" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
