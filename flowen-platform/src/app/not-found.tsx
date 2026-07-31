import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">404</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Page not found</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors"
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
