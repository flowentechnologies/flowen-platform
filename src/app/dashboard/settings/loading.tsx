export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-pulse">
      <div className="h-7 bg-slate-800 rounded-lg w-24 mb-8" />
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-4">
          <div className="h-5 bg-slate-800 rounded w-36 mb-4" />
          <div className="h-10 bg-slate-800 rounded-lg mb-3" />
          <div className="h-10 bg-slate-800 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
