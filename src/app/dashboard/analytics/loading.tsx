function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-800/70 ${className}`} />;
}

export default function AnalyticsLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="space-y-2">
        <Bone className="h-3 w-20" />
        <Bone className="h-7 w-36" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <Bone className="h-2.5 w-20" />
            <Bone className="h-8 w-14" />
          </div>
        ))}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <Bone className="h-3 w-28" />
        <div className="h-40 flex items-end gap-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="flex-1 animate-pulse bg-slate-800/70 rounded-sm"
              style={{ height: `${30 + Math.random() * 70}%`, animationDelay: `${i * 40}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
