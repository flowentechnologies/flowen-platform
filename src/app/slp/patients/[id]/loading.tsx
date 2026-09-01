export default function PatientDetailLoading() {
  return (
    <div className="px-6 py-8 max-w-4xl mx-auto animate-pulse">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <div className="h-3 bg-slate-800 rounded w-16" />
        <div className="h-3 bg-slate-700 rounded w-2" />
        <div className="h-3 bg-slate-800 rounded w-24" />
      </div>

      {/* Patient header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-12 w-12 rounded-full bg-slate-800 shrink-0" />
        <div>
          <div className="h-6 bg-slate-800 rounded w-40 mb-2" />
          <div className="h-4 bg-slate-800 rounded w-52" />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="h-6 bg-slate-800 rounded w-12 mb-1" />
            <div className="h-3 bg-slate-800 rounded w-24" />
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8">
        <div className="h-4 bg-slate-800 rounded w-48 mb-4" />
        <div className="flex items-end gap-0.5 h-16">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-slate-800 rounded-sm"
              style={{ height: `${Math.random() * 80 + 20}%` }}
            />
          ))}
        </div>
      </div>

      {/* Plan placeholder */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8">
        <div className="h-4 bg-slate-800 rounded w-32 mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="h-3 bg-slate-800 rounded w-16 mb-1" />
              <div className="h-4 bg-slate-800 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
