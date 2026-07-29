'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
    section: 'Operations',
    items: [
      { label: 'Data Room', href: '/admin/data-room' },
      { label: 'Tickets', href: '/admin/tickets' },
      { label: 'GDPR Requests', href: '/admin/tickets/gdpr-requests', indent: true },
      { label: 'Audit Log', href: '/admin/audit' },
      { label: 'Staff', href: '/admin/staff' },
      { label: 'Integrations', href: '/admin/integrations' },
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

export default function AdminShell({ children }: { children: React.ReactNode }) {
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

          <Link
            href="/dashboard"
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeftIcon />
            Dashboard
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 md:p-10 space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}
