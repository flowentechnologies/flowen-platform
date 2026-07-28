import Link from 'next/link';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#04050A]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-black text-black text-sm">
                F
              </div>
              <span className="text-white font-bold text-lg">FLOWEN</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              Neural biofeedback speech coordination for individuals, clinicians, and public programs.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Product</h4>
            <ul className="space-y-2.5">
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
