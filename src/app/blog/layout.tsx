import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Wordmark — links back to the main site */}
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            aria-label="Flowen — go to homepage"
          >
            {/* Dual-waveform mark */}
            <svg
              viewBox="0 0 120 60"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-auto"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="blog-wave-grad" x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%"   stopColor="#F59E0B" />
                  <stop offset="35%"  stopColor="#10B981" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
              <path
                d="M 10 25 C 20 25, 25 38, 35 38 C 48 38, 52 12, 65 12 C 78 12, 82 42, 95 42 C 105 42, 108 30, 115 30"
                stroke="url(#blog-wave-grad)" strokeWidth="6" strokeLinecap="round" fill="none"
              />
              <path
                d="M 10 33 C 20 33, 25 46, 35 46 C 48 46, 52 20, 65 20 C 78 20, 82 50, 95 50 C 105 50, 108 38, 115 38"
                stroke="url(#blog-wave-grad)" strokeWidth="6" strokeLinecap="round" fill="none"
              />
            </svg>
            <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
              FLOWEN
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="hidden sm:inline-flex items-center rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              Get Flowen →
            </Link>
          </div>
        </div>
      </header>

      {children}
    </>
  );
}
