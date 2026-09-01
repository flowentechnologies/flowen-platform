export default function ReferLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-pulse">
      <div className="h-7 bg-slate-800 rounded-lg w-44 mb-2" />
      <div className="h-4 bg-slate-800 rounded w-72 mb-8" />
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
        <div className="h-4 bg-slate-800 rounded w-28 mb-3" />
        <div className="h-12 bg-slate-800 rounded-lg mb-4" />
        <div className="flex gap-3">
          <div className="h-10 bg-slate-800 rounded-lg flex-1" />
          <div className="h-10 bg-slate-800 rounded-lg w-28" />
        </div>
      </div>
    </div>
  );
}
