export default function UpgradeLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse">
      <div className="h-8 bg-slate-800 rounded-lg w-56 mx-auto mb-4" />
      <div className="h-4 bg-slate-800 rounded w-80 mx-auto mb-10" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map(i => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="h-6 bg-slate-800 rounded w-24 mb-2" />
            <div className="h-10 bg-slate-800 rounded w-36 mb-4" />
            <div className="space-y-2 mb-6">
              {[1, 2, 3, 4].map(j => (
                <div key={j} className="h-3 bg-slate-800 rounded w-full" />
              ))}
            </div>
            <div className="h-11 bg-slate-800 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
