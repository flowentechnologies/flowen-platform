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
  { label: 'Dashboard',       href: '/dashboard' },
  { label: 'Practice',        href: '/dashboard/practice' },
  { label: 'Analytics',       href: '/dashboard/analytics' },
];

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
