export default function WelcomeLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 animate-pulse">
      <div className="w-full max-w-lg">
        <div className="h-8 bg-slate-800 rounded-lg w-64 mb-3" />
        <div className="h-4 bg-slate-800 rounded w-full mb-8" />
        <div className="space-y-3 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-4">
              <div className="h-6 w-6 rounded-full bg-slate-800 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="h-4 bg-slate-800 rounded w-32 mb-2" />
                <div className="h-3 bg-slate-800 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-12 bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
}
