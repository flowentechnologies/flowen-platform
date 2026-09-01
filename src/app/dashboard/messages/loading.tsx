export default function MessagesLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse">
      <div className="h-7 bg-slate-800 rounded-lg w-28 mb-6" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-800 shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-slate-800 rounded w-32 mb-2" />
              <div className="h-3 bg-slate-800 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
