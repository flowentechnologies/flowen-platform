'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FlowenLogo } from '@/components/FlowenLogo';
import { logout } from '@/app/auth/actions';
import { ThemeToggle } from '@/components/ThemeToggle';

export interface UserProfile {
  email: string;
  displayName: string | null;
  tier: string | null;
  isAdmin: boolean;
  role: string | null;
  hasClinician: boolean;
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

// Order matters for MobileBottomNav — it slices the first 5.
// Slots 1-5 appear on mobile; slot 6 (Analytics) is desktop-only.
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
  // Slot 3 — Guide: important for onboarding, shown on mobile
  {
    label: 'Guide',
    href: '/dashboard/guide',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
      </svg>
    ),
    iconActive: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
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
  // Slot 6 — Analytics: complex charts, desktop-only on mobile bottom nav
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
];

export function MobileBottomNav({ user }: { user: UserProfile }) {
  const pathname = usePathname();
  const clinicianExcluded = new Set(['/dashboard/analytics', '/dashboard/history', '/dashboard/messages']);
  const links = [
    ...NAV_LINKS.filter(l => {
      if (user.role === 'clinician' && clinicianExcluded.has(l.href)) return false;
      // Hide Messages when the user has no assigned clinician
      if (l.href === '/dashboard/messages' && !user.hasClinician && user.role !== 'clinician') return false;
      return true;
    }),
    ...(user.role === 'clinician'
      ? [{ label: 'Clinician', href: '/dashboard/clinician', icon: null, iconActive: null }]
      : []),
  ];
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 pb-safe">
      <div className="flex items-stretch h-16">
        {links.slice(0, 5).map(link => {
          const active = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-colors ${
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
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
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/unread');
      if (res.ok) {
        const data = (await res.json()) as { count: number };
        setUnread(data.count);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUnread().catch(() => {});
    const id = setInterval(() => fetchUnread().catch(() => {}), 30000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  useEffect(() => {
    if (pathname === '/dashboard/messages' || pathname.startsWith('/dashboard/clinician')) {
      fetchUnread().catch(() => {});
    }
  }, [pathname, fetchUnread]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const tierLabel = user.tier ? (TIER_LABELS[user.tier] ?? user.tier) : null;

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">

        {/* Logo */}
        <FlowenLogo className="h-7 shrink-0" />

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(link => {
            if (user.role === 'clinician' && (
              link.href === '/dashboard/messages' ||
              link.href === '/dashboard/analytics' ||
              link.href === '/dashboard/history'
            )) return null;
            // Hide Messages when no clinician assigned
            if (link.href === '/dashboard/messages' && !user.hasClinician && user.role !== 'clinician') return null;
            const active = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
            const isMessages = link.href === '/dashboard/messages';
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                {link.label}
                {isMessages && unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-red-500 text-slate-900 dark:text-white text-[9px] font-bold px-0.5 leading-none">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
            );
          })}
          {user.role === 'clinician' && (
            <Link
              href="/dashboard/clinician"
              className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                pathname.startsWith('/dashboard/clinician')
                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              Clinician View
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-red-500 text-slate-900 dark:text-white text-[9px] font-bold px-0.5 leading-none">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )}
          {user.isAdmin && (
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition-colors ml-2"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Right side: theme toggle + profile */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle className="hidden sm:flex" />

          {/* Profile button */}
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              {/* Avatar */}
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-[10px] font-black shrink-0">
                {initials(user)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight truncate max-w-[120px]">
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
              <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/60 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user.displayName ?? user.email.split('@')[0]}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{user.email}</p>
                  {tierLabel && (
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      {tierLabel}
                    </span>
                  )}
                </div>

                {/* Theme toggle (mobile — hidden on sm+) */}
                <div className="sm:hidden px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Theme</span>
                  <ThemeToggle />
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  {[
                    ...(user.role !== 'clinician' && user.tier !== 'founding' && user.tier !== 'public_funds' ? [{
                      label: 'Upgrade',
                      href: '/dashboard/upgrade',
                      icon: (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd"/>
                        </svg>
                      ),
                    }] : []),
                    {
                      label: 'Refer a friend',
                      href: '/dashboard/refer',
                      icon: (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM6 8a2 2 0 11-4 0 2 2 0 014 0zM14.5 13.5a4.5 4.5 0 00-9 0v.5a.5.5 0 00.5.5h8a.5.5 0 00.5-.5v-.5zM18 14.5v-.5a3.5 3.5 0 00-3.5-3.5h-.146A5.49 5.49 0 0115.5 13.5v.5H18zM5.646 10.5H5.5A3.5 3.5 0 002 14v.5h2.5v-.5a5.49 5.49 0 011.146-3.5z"/>
                        </svg>
                      ),
                    },
                    {
                      label: 'Billing',
                      href: '/dashboard/billing',
                      icon: (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6zM3 13.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm4.75-.75a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" clipRule="evenodd"/>
                        </svg>
                      ),
                    },
                    {
                      label: 'Settings',
                      href: '/dashboard/settings',
                      icon: (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
                        </svg>
                      ),
                    },
                    {
                      label: 'Support Centre',
                      href: '/dashboard/support',
                      icon: (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 001.28.53l3.658-3.658A8.975 8.975 0 0010 14c2.236 0 4.43-.18 6.57-.524C18.007 13.245 19 11.986 19 10.574V5.426c0-1.413-.993-2.67-2.43-2.902A41.102 41.102 0 0010 2zm0 8a1 1 0 100-2 1 1 0 000 2zm-2-1a2 2 0 114 0 2 2 0 01-4 0zm-3 1a1 1 0 100-2 1 1 0 000 2zm11-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd"/>
                        </svg>
                      ),
                    },
                  ].map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}
                </div>

                {/* Sign out */}
                <div className="border-t border-slate-100 dark:border-slate-800 py-1.5">
                  <form action={logout}>
                    <button
                      type="submit"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors text-left"
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
      </div>
    </header>
  );
}
