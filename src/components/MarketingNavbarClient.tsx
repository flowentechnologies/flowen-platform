'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FlowenLogo } from '@/components/FlowenLogo';
import { createClient } from '@/lib/supabase/client';

const NAV_LINKS = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Technology',   href: '/#technology' },
  { label: 'For SLTs',    href: '/clinicians' },
  { label: 'Pricing',     href: '/pricing'  },
  { label: 'About',       href: '/about' },
  { label: 'Resources',   href: '/resources' },
];

export default function MarketingNavbarClient({ initialLoggedIn = false }: { initialLoggedIn?: boolean }) {
  const pathname  = usePathname();
  const [open, setOpen] = useState(false);
  // Start from server-resolved value to avoid flash, then keep in sync client-side
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn);

  useEffect(() => {
    const supabase = createClient();
    // Verify session client-side (handles tab switches, logouts, etc.)
    supabase.auth.getUser().then(({ data: { user } }) => setLoggedIn(!!user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className="sticky top-0 z-40 bg-[#06080F]/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <FlowenLogo className="h-7" />

        {/* Desktop nav */}
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`hover:text-emerald-400 transition-colors ${
                pathname === link.href ? 'text-emerald-400' : ''
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="hidden sm:block text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Dashboard →
            </Link>
          ) : (
            <Link
              href="/auth/login"
              className="hidden sm:block text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Sign In
            </Link>
          )}

          <Link
            href={loggedIn ? '/dashboard' : '/waitlist'}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all hover:scale-105 shadow-md shadow-emerald-500/20"
          >
            {loggedIn ? 'Open Dashboard' : 'Join Waitlist'}
          </Link>

          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            <span className={`block w-5 h-0.5 bg-slate-300 transition-transform duration-200 ${open ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block w-5 h-0.5 bg-slate-300 transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-slate-300 transition-transform duration-200 ${open ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-slate-800/80 bg-[#06080F] px-6 py-4 space-y-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block py-3 text-sm font-medium border-b border-slate-800/60 last:border-0 transition-colors ${
                pathname === link.href
                  ? 'text-emerald-400'
                  : 'text-slate-300 hover:text-emerald-400'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={loggedIn ? '/dashboard' : '/auth/login'}
            onClick={() => setOpen(false)}
            className="block pt-3 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            {loggedIn ? 'Dashboard →' : 'Sign In →'}
          </Link>
        </div>
      )}
    </nav>
  );
}
