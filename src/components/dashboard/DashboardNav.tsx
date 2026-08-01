'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FlowenLogo } from '@/components/FlowenLogo';
import { logout } from '@/app/auth/actions';

export interface UserProfile {
  email: string;
  displayName: string | null;
  tier: string | null;
  isAdmin: boolean;
  role: string | null;
}

const TIER_LABELS: Record<string, string> = {
  founding:        'Founding Member',
  standard:        'Standard',
  public_funds:    'Public Funds',
  vocali_freemium: 'Freemium',
};

function initials(profile: UserProfile): string {
  const name = profile.displayName ?? profile.email;
  return name.slice(0, 2).toUpperCase();
}

const NAV_LINKS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M2 10.5a8.5 8.5 0 1117 0A8.5 8.5 0 012 10.5zm8.5-6a6.5 6.5 0 100 13 6.5 6.5 0 000-13z"/>
        <path d="M10.5 6.25a.75.75 0 00-1.5 0v4.5a.75.75 0 00.22.53l2.25 2.25a.75.75 0 001.06-1.06L10.5 10.19V6.25z"/>
      </svg>
    ),
    iconActive: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd"/>
      </svg>
    ),
  },
  {
    label: 'Practice',
    href: '/dashboard/practice',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z"/>
        <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z"/>
      </svg>
    ),
    iconActive: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z"/>
        <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z"/>
      </svg>
    ),
  },
  {
    label: 'Analytics',
    href: '/dashboard/analytics',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 003 0v-13A1.5 1.5 0 0015.5 2zM9.5 6A1.5 1.5 0 008 7.5v9a1.5 1.5 0 003 0v-9A1.5 1.5 0 009.5 6zM3.5 10A1.5 1.5 0 002 11.5v5a1.5 1.5 0 003 0v-5A1.5 1.5 0 003.5 10z"/>
      </svg>
    ),
    iconActive: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 003 0v-13A1.5 1.5 0 0015.5 2zM9.5 6A1.5 1.5 0 008 7.5v9a1.5 1.5 0 003 0v-9A1.5 1.5 0 009.5 6zM3.5 10A1.5 1.5 0 002 11.5v5a1.5 1.5 0 003 0v-5A1.5 1.5 0 003.5 10z"/>
      </svg>
    ),
  },
  {
    label: 'History',
    href: '/dashboard/history',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h3.25a.75.75 0 000-1.5H10.75V5z" clipRule="evenodd"/>
      </svg>
    ),
    iconActive: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h3.25a.75.75 0 000-1.5H10.75V5z" clipRule="evenodd"/>
      </svg>
    ),
  },
  {
    label: 'Messages',
    href: '/dashboard/messages',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6l-4 4V5z" clipRule="evenodd"/>
      </svg>
    ),
    iconActive: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6l-4 4V5z" clipRule="evenodd"/>
      </svg>
    ),
  },
];

export function MobileBottomNav({ user }: { user: UserProfile }) {
  const pathname = usePathname();
  const links = [
    ...NAV_LINKS,
    ...(user.role === 'clinician'
      ? [{ label: 'Clinician', href: '/dashboard/clinician', icon: null, iconActive: null }]
      : []),
  ];
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 pb-safe">
      <div className="flex items-stretch h-16">
        {links.slice(0, 4).map(link => {
          const active = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-colors ${
                active ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className={`transition-transform ${active ? 'scale-110' : ''}`}>
                {active ? (link.iconActive ?? link.icon) : link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DashboardNav({ user }: { user: UserProfile }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const tierLabel = user.tier ? (TIER_LABELS[user.tier] ?? user.tier) : null;

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">

        {/* Logo */}
        <FlowenLogo className="h-7 shrink-0" />

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(link => {
            const active = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
              >
                {link.label}
              </Link>
            );
          })}
          {user.role === 'clinician' && (
            <Link
              href="/dashboard/clinician"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${pathname.startsWith('/dashboard/clinician') ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
            >
              Clinician View
            </Link>
          )}
          {user.isAdmin && (
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition-colors ml-2"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Profile button */}
        <div className="relative shrink-0" ref={ref}>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-[10px] font-black shrink-0">
              {initials(user)}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-white leading-tight truncate max-w-[120px]">
                {user.displayName ?? user.email.split('@')[0]}
              </p>
              {tierLabel && (
                <p className="text-[9px] text-slate-500 leading-tight">{tierLabel}</p>
              )}
            </div>
            <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
            </svg>
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
              {/* User info */}
              <div className="px-4 py-3.5 border-b border-slate-800">
                <p className="text-xs font-semibold text-white truncate">{user.displayName ?? user.email.split('@')[0]}</p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">{user.email}</p>
                {tierLabel && (
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {tierLabel}
                  </span>
                )}
              </div>

              {/* Menu items */}
              <div className="py-1.5">
                {[
                  { label: 'Billing',           href: '/dashboard/billing',  icon: '$' },
                  { label: 'Settings',         href: '/dashboard/settings', icon: '⚙️' },
                  { label: 'Support Centre',    href: '/dashboard/support',  icon: '💬' },
                ].map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>

              {/* Sign out */}
              <div className="border-t border-slate-800 py-1.5">
                <form action={logout}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors text-left"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd"/>
                      <path fillRule="evenodd" d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z" clipRule="evenodd"/>
                    </svg>
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
