export default function SupportLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-pulse">
      <div className="h-7 bg-slate-800 rounded-lg w-28 mb-2" />
      <div className="h-4 bg-slate-800 rounded w-64 mb-8" />
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="h-5 bg-slate-800 rounded w-32 mb-4" />
        <div className="h-10 bg-slate-800 rounded-lg mb-3" />
        <div className="h-32 bg-slate-800 rounded-lg mb-4" />
        <div className="h-10 bg-slate-800 rounded-lg w-28" />
      </div>
    </div>
  );
}
