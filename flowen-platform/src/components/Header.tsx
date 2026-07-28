'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  isAuthenticated?: boolean;
}

export function Header({ isAuthenticated = false }: Props) {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-[#06080F]/85 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-black text-black text-xl shadow-lg shadow-emerald-500/20">
            F
          </div>
          <span className="text-2xl font-black tracking-tight text-white">FLOWEN</span>
        </Link>

        {isAuthenticated ? (
          <div className="flex items-center space-x-6 text-sm font-medium">
            <Link 
              href="/app" 
              className={`transition-colors ${pathname === '/app' ? 'text-emerald-400 font-semibold' : 'text-slate-300 hover:text-emerald-400'}`}
            >
              Dashboard
            </Link>
            <Link 
              href="/app/practice" 
              className={`transition-colors ${pathname === '/app/practice' ? 'text-emerald-400 font-semibold' : 'text-slate-300 hover:text-emerald-400'}`}
            >
              Practice Engine
            </Link>
            <Link 
              href="/app/analytics" 
              className={`transition-colors ${pathname === '/app/analytics' ? 'text-emerald-400 font-semibold' : 'text-slate-300 hover:text-emerald-400'}`}
            >
              Telemetry Analytics
            </Link>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            <Link
              href="/auth/login"
              className="px-5 py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-200 font-semibold text-sm transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/auth/login"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all shadow-md shadow-emerald-500/20"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
