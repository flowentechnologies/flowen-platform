'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/auth/actions';

export interface AdminUser {
  email:       string;
  displayName: string | null;
  tier:        string | null;
}

interface NavItem {
  label: string;
  href: string;
  indent?: boolean;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    section: 'Overview',
    items: [{ label: 'Command Centre', href: '/admin/command-center' }],
  },
  {
    section: 'Platform',
    items: [
      { label: 'Users', href: '/admin/users' },
      { label: 'Billing', href: '/admin/billing' },
      { label: 'Analytics', href: '/admin/analytics' },
    ],
  },
  {
    section: 'Investment',
    items: [
      { label: 'Venture', href: '/admin/venture' },
      { label: 'Data Room', href: '/admin/data-room' },
      { label: 'Pitch Deck', href: '/admin/pitch-deck' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Tickets', href: '/admin/tickets' },
      { label: 'GDPR Requests', href: '/admin/tickets/gdpr-requests', indent: true },
      { label: 'Audit Log', href: '/admin/audit' },
      { label: 'Staff', href: '/admin/staff' },
      { label: 'Integrations', href: '/admin/integrations' },
      { label: 'Tracking', href: '/admin/tracking' },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { label: 'NHS Readiness', href: '/admin/compliance' },
    ],
  },
  {
    section: 'Infrastructure',
    items: [
      { label: 'Assets', href: '/admin/assets' },
      { label: 'Workflows', href: '/admin/workflows' },
      { label: 'Cron', href: '/admin/cron' },
      { label: 'System', href: '/admin/system' },
    ],
  },
  {
    section: 'Communications',
    items: [
      { label: 'Content', href: '/admin/content' },
      { label: 'Campaign', href: '/admin/campaign' },
    ],
  },
];

function HamburgerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="4" y1="4" x2="16" y2="16" />
      <line x1="16" y1="4" x2="4" y2="16" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 2 4 7 9 12" />
    </svg>
  );
}

interface SidebarContentProps {
  pathname: string;
  onLinkClick?: () => void;
}

function SidebarContent({ pathname, onLinkClick }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-950 font-black text-sm">
            F
          </div>
          <span className="font-bold text-white text-sm tracking-tight">Flowen Admin</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {NAV.map((section) => (
          <div key={section.section}>
            <p className="px-3 mb-1 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-600">
              {section.section}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onLinkClick}
                      className={`flex items-center rounded-lg text-xs font-medium transition-colors duration-150 ${
                        item.indent ? 'pl-6 pr-3 py-1.5' : 'px-3 py-1.5'
                      } ${
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      {item.indent && (
                        <span className="mr-1.5 text-slate-600">&#x2514;</span>
                      )}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Back link */}
      <div className="flex-shrink-0 px-2 py-3 border-t border-slate-800">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
        >
          <ChevronLeftIcon />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

const TIER_LABELS: Record<string, string> = {
  founding:        'Founding Member',
  standard:        'Standard',
  public_funds:    'Public Funds',
  vocali_freemium: 'Freemium',
};

function AdminProfileButton({ user }: { user: AdminUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const name = user.displayName ?? user.email.split('@')[0];
  const initials = name.slice(0, 2).toUpperCase();
  const tierLabel = user.tier ? (TIER_LABELS[user.tier] ?? user.tier) : 'Admin';

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-[10px] font-black shrink-0">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold text-white leading-tight truncate max-w-[100px]">{name}</p>
          <p className="text-[9px] text-slate-500 leading-tight">{tierLabel}</p>
        </div>
        <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-xs font-semibold text-white truncate">{name}</p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{user.email}</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              ADMIN
            </span>
          </div>
          <div className="py-1.5">
            {[
              { label: 'Dashboard',  href: '/dashboard',          icon: '🏠' },
              { label: 'Settings',   href: '/dashboard/settings', icon: '⚙️' },
              { label: 'Support',    href: '/dashboard/support',  icon: '💬' },
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
  );
}

export default function AdminShell({ user, children }: { user: AdminUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/80 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop always visible, mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto lg:flex ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent pathname={pathname} onLinkClick={() => setSidebarOpen(false)} />
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-10 h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center px-4 gap-3 flex-shrink-0">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="lg:hidden text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>

          <div className="flex-1 flex items-center gap-3">
            <span className="text-sm font-bold text-white tracking-tight">Flowen Admin</span>
            <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              ADMIN PANEL
            </span>
          </div>

          <AdminProfileButton user={user} />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 md:p-10 space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}
