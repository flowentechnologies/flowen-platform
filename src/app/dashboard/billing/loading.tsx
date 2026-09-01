export default function BillingLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse">
      <div className="h-7 bg-slate-800 rounded-lg w-32 mb-8" />
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
        <div className="h-4 bg-slate-800 rounded w-24 mb-4" />
        <div className="h-8 bg-slate-800 rounded w-48 mb-2" />
        <div className="h-4 bg-slate-800 rounded w-64" />
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="h-4 bg-slate-800 rounded w-32 mb-4" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-slate-800 rounded-lg mb-3 last:mb-0" />
        ))}
      </div>
    </div>
  );
}
