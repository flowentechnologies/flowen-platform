import Link from 'next/link';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#04050A]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
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
            <p className="text-slate-400 text-xs leading-relaxed mb-4">
              Real-time acoustic biofeedback for fluency practice — for individuals, clinicians, and funded programmes.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://www.instagram.com/flowenspeech" target="_blank" rel="noopener noreferrer" aria-label="Flowen on Instagram" className="text-slate-500 hover:text-emerald-400 transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 2 .3 2.4.5.6.2 1 .5 1.5 1 .4.4.7.9 1 1.5.2.5.4 1.2.5 2.4.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 2-.5 2.4-.2.6-.5 1-1 1.5-.4.4-.9.7-1.5 1-.5.2-1.2.4-2.4.5-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-2-.3-2.4-.5-.6-.2-1-.5-1.5-1-.4-.4-.7-.9-1-1.5-.2-.5-.4-1.2-.5-2.4C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-2 .5-2.4.2-.6.5-1 1-1.5.4-.4.9-.7 1.5-1 .5-.2 1.2-.4 2.4-.5C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1 .1-1.6.2-1.9.4-.5.2-.8.4-1.2.7-.3.3-.6.7-.7 1.2-.1.3-.3.9-.4 1.9-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c.1 1 .2 1.6.4 1.9.2.5.4.8.7 1.2.3.3.7.6 1.2.7.3.1.9.3 1.9.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1-.1 1.6-.2 1.9-.4.5-.2.8-.4 1.2-.7.3-.3.6-.7.7-1.2.1-.3.3-.9.4-1.9.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1-.2-1.6-.4-1.9-.2-.5-.4-.8-.7-1.2-.3-.3-.7-.6-1.2-.7-.3-.1-.9-.3-1.9-.4-1.2-.1-1.6-.1-4.7-.1zm0 3.6a5.4 5.4 0 110 10.8 5.4 5.4 0 010-10.8zm0 1.8a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2zm5.6-3.9a1.26 1.26 0 110 2.52 1.26 1.26 0 010-2.52z" />
                </svg>
              </a>
              <a href="https://www.snapchat.com/add/flowenspeech" target="_blank" rel="noopener noreferrer" aria-label="Flowen on Snapchat" className="text-slate-500 hover:text-emerald-400 transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12.03 2c3.7 0 5.24 2.9 5.36 5.14.06 1.1-.01 2.02.06 2.53.06.4.2.5.5.68.28.16 1.02.4 1.3.53.42.2.62.42.6.72-.03.4-.5.66-1.01.86-.36.14-.8.24-1 .5-.1.14-.1.35-.03.6.24.9 1.05 1.5 1.9 1.78.34.11.63.34.5.7-.1.28-.5.42-.86.5-.3.08-.66.1-.86.32-.16.18-.13.4-.1.66.05.4.05.72-.42.86-.34.1-.75.02-1.1.12-.5.14-.72.55-1.1.9-.6.55-1.4.9-2.24.9-.6 0-1.13-.16-1.66-.34-.5-.17-1-.34-1.55-.34-.55 0-1.05.17-1.55.34-.53.18-1.06.34-1.66.34-.84 0-1.64-.35-2.24-.9-.38-.35-.6-.76-1.1-.9-.35-.1-.76-.02-1.1-.12-.47-.14-.47-.46-.42-.86.03-.26.06-.48-.1-.66-.2-.22-.56-.24-.86-.32-.36-.08-.76-.22-.86-.5-.13-.36.16-.59.5-.7.85-.28 1.66-.88 1.9-1.78.07-.25.07-.46-.03-.6-.2-.26-.64-.36-1-.5-.5-.2-.98-.46-1.01-.86-.02-.3.18-.52.6-.72.28-.13 1.02-.37 1.3-.53.3-.18.44-.28.5-.68.07-.51 0-1.43.06-2.53C6.79 4.9 8.33 2 12.03 2z" />
                </svg>
              </a>
              <a href="https://www.facebook.com/flowenspeech" target="_blank" rel="noopener noreferrer" aria-label="Flowen on Facebook" className="text-slate-500 hover:text-emerald-400 transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z" />
                </svg>
              </a>
              <a href="https://www.linkedin.com/company/flowen-technologies/" target="_blank" rel="noopener noreferrer" aria-label="Flowen on LinkedIn" className="text-slate-500 hover:text-emerald-400 transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Product</h3>
            <ul className="space-y-2.5">
              <li><Link href="/how-it-works" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">How it works</Link></li>
              <li><Link href="/#technology" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Technology</Link></li>
              <li><Link href="/#pricing" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Pricing</Link></li>
              <li><Link href="/clinicians" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">For SLTs</Link></li>
              <li><Link href="/waitlist" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Join Waitlist</Link></li>
              <li><Link href="/resources" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Resources</Link></li>
              <li><Link href="/training" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Training</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Company</h3>
            <ul className="space-y-2.5">
              <li><Link href="/about" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">About Us</Link></li>
              <li><Link href="/faq" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">FAQ</Link></li>
              <li><Link href="/affiliates" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Affiliates</Link></li>
              <li><Link href="/media-kit" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Media Kit</Link></li>
              <li><Link href="/security" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Security</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Research</h3>
            <ul className="space-y-2.5">
              <li><Link href="/whitepaper" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">White Paper</Link></li>
              <li><Link href="/resources/biofeedback-evidence" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Clinical Evidence</Link></li>
              <li><Link href="/nhs-framework" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">NHS Framework</Link></li>
              <li><Link href="/how-it-works" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">How It Works</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Legal</h3>
            <ul className="space-y-2.5">
              <li><Link href="/legal" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Terms &amp; Privacy</Link></li>
              <li><Link href="/cookie-policy" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Cookie Policy</Link></li>
              <li><Link href="/accessibility" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Accessibility</Link></li>
              <li><Link href="/security#dcb0129" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">DCB0129</Link></li>
              <li><Link href="/dpa" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">Data Processing</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/60 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-400 text-xs">
            © 2026 Flowen Speech Technology Ltd. All rights reserved. Registered under UK GDPR &amp; DCB0129 Clinical Safety Governance.
          </p>
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-400">DCB0129</span>
            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-400">UK GDPR</span>
            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-400">NHS</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
