'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { label: 'Technology', href: '/#technology' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'About', href: '/about' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Resources', href: '/resources' },
];

export default function MarketingNavbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 bg-[#06080F]/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-black text-black text-xl shadow-lg shadow-emerald-500/20">
            F
          </div>
          <span className="text-2xl font-black tracking-tight text-white">FLOWEN</span>
        </Link>

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

        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="hidden sm:block text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/waitlist"
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all hover:scale-105 shadow-md shadow-emerald-500/20"
          >
            Join Waitlist
          </Link>
        </div>
      </div>
    </nav>
  );
}
