import Link from 'next/link';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#04050A]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 group w-fit">
              <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
                <defs>
                  <linearGradient id="fw-footer" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="#F59E0B"/>
                    <stop offset="35%" stopColor="#10B981"/>
                    <stop offset="100%" stopColor="#06B6D4"/>
                  </linearGradient>
                </defs>
                <path d="M 10 25 C 20 25, 25 38, 35 38 C 48 38, 52 12, 65 12 C 78 12, 82 42, 95 42 C 105 42, 108 30, 115 30" stroke="url(#fw-footer)" strokeWidth="6" strokeLinecap="round" fill="none"/>
                <path d="M 10 33 C 20 33, 25 46, 35 46 C 48 46, 52 20, 65 20 C 78 20, 82 50, 95 50 C 105 50, 108 38, 115 38" stroke="url(#fw-footer)" strokeWidth="6" strokeLinecap="round" fill="none"/>
              </svg>
              <span className="text-white font-bold text-lg group-hover:text-emerald-400 transition-colors">FLOWEN</span>
            </Link>
            <p className="text-slate-500 text-xs leading-relaxed">
              Neural biofeedback speech coordination for individuals, clinicians, and public programs.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Product</h4>
            <ul className="space-y-2.5">
              <li><Link href="/how-it-works" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">How it works</Link></li>
              <li><Link href="/#technology" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Technology</Link></li>
              <li><Link href="/#pricing" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Pricing</Link></li>
              <li><Link href="/waitlist" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Join Waitlist</Link></li>
              <li><Link href="/resources" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Resources</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Company</h4>
            <ul className="space-y-2.5">
              <li><Link href="/about" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">About Us</Link></li>
              <li><Link href="/faq" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">FAQ</Link></li>
              <li><Link href="/media-kit" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Media Kit</Link></li>
              <li><Link href="/security" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Security</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Legal</h4>
            <ul className="space-y-2.5">
              <li><Link href="/legal" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Terms &amp; Privacy</Link></li>
              <li><Link href="/cookie-policy" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Cookie Policy</Link></li>
              <li><Link href="/accessibility" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Accessibility</Link></li>
              <li><Link href="/security#dcb0129" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">DCB0129</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/60 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-xs">
            © 2026 Flowen Group HoldCo. All rights reserved. Registered under UK GDPR &amp; DCB0129 Clinical Safety Governance.
          </p>
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-600">DCB0129</span>
            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-600">UK GDPR</span>
            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-600">NHS</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
