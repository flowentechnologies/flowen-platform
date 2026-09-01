export default function GuideLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse">
      <div className="h-7 bg-slate-800 rounded-lg w-48 mb-4" />
      <div className="h-4 bg-slate-800 rounded w-80 mb-10" />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-4">
          <div className="h-5 bg-slate-800 rounded w-40 mb-3" />
          <div className="h-4 bg-slate-800 rounded w-full mb-2" />
          <div className="h-4 bg-slate-800 rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}
