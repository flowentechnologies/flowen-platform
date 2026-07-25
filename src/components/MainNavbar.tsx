'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MainNavbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Admin Hub', href: '/admin' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Waitlist', href: '/waitlist' },
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Practice Engine', href: '/dashboard/practice' },
    { name: 'Analytics', href: '/dashboard/analytics' },
    { name: 'Telemetry', href: '/telemetry' },
    { name: 'Legal', href: '/legal' },
  ];

  return (
    <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 text-white">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-950 font-black">
            F
          </div>
          <span>Flowen Platform</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition"
          >
            Admin Panel
          </Link>
        </div>
      </div>
    </header>
  );
}
