'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/auth/actions';

export interface SlpShellUser {
  email: string;
  displayName: string;
}

const NAV = [
  {
    section: 'Clinical',
    items: [
      { label: 'My Caseload', href: '/slp/caseload', icon: CaseloadIcon },
      { label: 'Enrol Patient', href: '/slp/patients/new', icon: AddPatientIcon },
    ],
  },
  {
    section: 'Resources',
    items: [
      { label: 'SLT Training Manual', href: '/training/staff', icon: DocIcon },
    ],
  },
];

function CaseloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function AddPatientIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/>
      <line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function FlowenMark() {
  return (
    <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
      <defs>
        <linearGradient id="slp-logo" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%"   stopColor="#F59E0B" />
          <stop offset="35%"  stopColor="#10B981" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <path d="M 10 25 C 20 25, 25 38, 35 38 C 48 38, 52 12, 65 12 C 78 12, 82 42, 95 42 C 105 42, 108 30, 115 30"
            stroke="url(#slp-logo)" strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M 10 33 C 20 33, 25 46, 35 46 C 48 46, 52 20, 65 20 C 78 20, 82 50, 95 50 C 105 50, 108 38, 115 38"
            stroke="url(#slp-logo)" strokeWidth="6" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export default function SlpShell({
  user, children,
}: {
  user: SlpShellUser;
  children: React.ReactNode;
}) {
  const pathname  = usePathname();
  const [open, setOpen] = useState(false);

  const initials = user.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">

      {/* ── Mobile overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 flex flex-col w-56 bg-slate-900 border-r border-slate-800 shrink-0
        transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-800">
          <FlowenMark />
          <div className="min-w-0">
            <p className="text-xs font-extrabold tracking-tight text-white leading-none">FLOWEN</p>
            <p className="text-[10px] text-emerald-400 font-semibold tracking-widest uppercase mt-0.5">SLT Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
          {NAV.map(group => (
            <div key={group.section}>
              <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                {group.section}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`
                        flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors
                        ${active
                          ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                      `}
                    >
                      <span className={active ? 'text-emerald-400' : 'text-slate-500'}>
                        <Icon />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-800 px-3 py-3">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-7 w-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{user.displayName || 'SLT'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <form action={logout}>
            <button type="submit" className="w-full text-left text-xs text-slate-500 hover:text-slate-300 transition-colors py-1 px-1">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900 shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="text-slate-400 hover:text-white"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5"/>
              <line x1="3" y1="10" x2="17" y2="10"/>
              <line x1="3" y1="15" x2="17" y2="15"/>
            </svg>
          </button>
          <span className="text-sm font-bold text-white">SLT Portal</span>
          <div className="w-5" />
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
