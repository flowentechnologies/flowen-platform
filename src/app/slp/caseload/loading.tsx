export default function CaseloadLoading() {
  return (
    <div className="px-6 py-8 max-w-5xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-7 bg-slate-800 rounded-lg w-32 mb-2" />
          <div className="h-4 bg-slate-800 rounded w-40" />
        </div>
        <div className="h-9 bg-slate-800 rounded-xl w-32" />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="h-7 bg-slate-800 rounded w-10 mb-1" />
            <div className="h-3 bg-slate-800 rounded w-24" />
          </div>
        ))}
      </div>

      {/* Patient rows */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-full bg-slate-800 shrink-0" />
              <div>
                <div className="h-4 bg-slate-800 rounded w-36 mb-1.5" />
                <div className="h-3 bg-slate-800 rounded w-48" />
              </div>
            </div>
            <div className="flex items-center gap-6 shrink-0">
              <div className="h-5 bg-slate-800 rounded-full w-16" />
              <div className="h-4 bg-slate-800 rounded w-10 hidden sm:block" />
              <div className="h-4 bg-slate-800 rounded w-10 hidden sm:block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
