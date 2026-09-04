import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security & Compliance — Flowen Speech Platform',
  description: 'Flowen\'s technical and clinical security posture: UK GDPR, DCB0129, AES-256 encryption, UK data residency, and penetration testing.',
};

const CONTROLS = [
  {
    category: 'Data Protection',
    items: [
      { label: 'Encryption at rest', detail: 'AES-256-GCM. All database rows, object storage, and backups are encrypted at rest.' },
      { label: 'Encryption in transit', detail: 'TLS 1.3 minimum. HSTS enforced with 1-year max-age. HTTP Strict Transport Security preloading.' },
      { label: 'Key management', detail: 'Database encryption keys managed by Supabase (UK data centres). Application-layer secrets stored in Vercel encrypted environment variables.' },
      { label: 'Data residency', detail: 'All personal data stored in UK-GBR data centres. No cross-border transfers without an Article 46 safeguard in place.' },
    ],
  },
  {
    category: 'Authentication & Access',
    items: [
      { label: 'User authentication', detail: 'Supabase Auth with JWT tokens. Email/password and magic link. JWT expiry enforced server-side.' },
      { label: 'Row-level security', detail: 'PostgreSQL RLS policies enforce per-user data isolation at the database layer. Service-role access is BYPASSRLS only for privileged backend operations.' },
      { label: 'Admin access', detail: 'Admin routes gated by is_admin flag in profiles table, verified on every request in the proxy layer. Not based on JWT claims alone.' },
      { label: 'API rate limiting', detail: 'In-process rate limiter in proxy.ts: 60 req/min for /api routes, 120 req/min for all other paths, per IP. Distributed limiting via Upstash Redis planned for multi-region.' },
    ],
  },
  {
    category: 'Clinical Governance',
    items: [
      { label: 'Clinical safety standard', detail: 'DCB0129 compliance. Clinical Safety Officer appointed. Hazard Log and Clinical Safety Case Report maintained.' },
      { label: 'Consent audit ledger', detail: 'Immutable, append-only consent_audit_log table. All consent grants, withdrawals, KYC events, and erasure requests are permanently recorded.' },
      { label: 'Data erasure pipeline', detail: 'UK GDPR Article 17 right to erasure. apply_gdpr_erasure() function anonymises PII, deletes voice biomarkers and telemetry, and records completion timestamp.' },
      { label: 'Voice data', detail: 'Raw audio is never persisted. Acoustic biomarkers (RMS, LTI, fundamental frequency) are aggregated per session and subject to the user\'s configurable retention policy (default: 30 days).' },
    ],
  },
  {
    category: 'Infrastructure',
    items: [
      { label: 'Hosting', detail: 'Vercel (frontend/edge functions). Supabase PostgreSQL (UK data centres). Redis for ephemeral biofeedback state via managed provider.' },
      { label: 'DDoS protection', detail: 'Vercel edge network provides automatic DDoS mitigation. Cloudflare proxying can be activated for additional L3/L4 protection.' },
      { label: 'Vulnerability management', detail: 'Dependencies audited via npm audit and Dependabot. Critical/high CVEs are patched within 72 hours of disclosure.' },
      { label: 'Observability', detail: 'Sentry error monitoring with PHI masking (maskAllText, blockAllMedia). No personally-identifying data captured in error payloads. Error logs retained for 90 days.' },
    ],
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />

      <main id="main-content" className="flex-1">
        {/* Header */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            TRUST & COMPLIANCE
          </span>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4">Security & Compliance</h1>
          <p className="text-slate-400 text-sm mt-3 max-w-2xl leading-relaxed">
            Flowen is a clinical-grade platform. Our security posture is designed to meet the requirements of NHS Digital, UK GDPR, and the DCB0129 clinical safety standard. This page documents our technical and organisational controls.
          </p>
        </section>

        {/* Summary badges */}
        <section className="max-w-5xl mx-auto px-6 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Encryption', value: 'AES-256' },
              { label: 'Transport', value: 'TLS 1.3' },
              { label: 'Data Residency', value: 'UK-GBR' },
              { label: 'Clinical Standard', value: 'DCB0129' },
            ].map(b => (
              <div key={b.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-lg font-black text-emerald-400 font-mono">{b.value}</div>
                <div className="text-xs text-slate-400 mt-1">{b.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Controls */}
        <section className="max-w-4xl mx-auto px-6 pb-16 space-y-12">
          {CONTROLS.map(group => (
            <div key={group.category}>
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 mb-6 pb-3 border-b border-slate-800">
                {group.category}
              </h2>
              <div className="space-y-4">
                {group.items.map(item => (
                  <div key={item.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500 mt-2" />
                      <div>
                        <div className="text-white font-semibold text-sm">{item.label}</div>
                        <p className="text-slate-400 text-sm leading-relaxed mt-1">{item.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* DCB0129 section */}
        <section id="dcb0129" className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 mb-6 pb-3 border-b border-slate-800">
            DCB0129 Clinical Safety
          </h2>
          <div className="bg-[#0A0D14] border border-slate-700 rounded-2xl p-7 space-y-5">
            <p className="text-slate-300 text-sm leading-relaxed">
              DCB0129 is the NHS Digital Clinical Safety Standard for Health IT. It requires organisations developing clinical health software to:
            </p>
            <ul className="space-y-3">
              {[
                'Appoint a Clinical Safety Officer with appropriate clinical and technical competence.',
                'Maintain a Hazard Log identifying clinical risks and mitigation measures.',
                'Produce a Clinical Safety Case Report demonstrating the system is safe for clinical use.',
                'Establish a safety management process covering the full system lifecycle.',
                'Engage with Deployment and Operational Clinical Safety Officers at NHS organisations.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-400 text-sm">
                  <span className="text-emerald-500 flex-shrink-0 font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-slate-400 text-sm leading-relaxed">
              Flowen maintains all four DCB0129 artefacts. NHS commissioners can request our Clinical Safety Case Report and Hazard Log summary by contacting{' '}
              <a href="mailto:security@flowen.digital" className="text-emerald-400 hover:underline">security@flowen.digital</a>.
            </p>
          </div>
        </section>

        {/* Responsible disclosure */}
        <section className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-6 pb-3 border-b border-slate-800">
            Responsible Disclosure
          </h2>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              If you believe you have found a security vulnerability in Flowen, please report it responsibly. We commit to:
            </p>
            <ul className="space-y-2 text-slate-400 text-sm mb-5">
              <li className="flex items-start gap-3"><span className="text-emerald-500 flex-shrink-0">✓</span>Acknowledging your report within 48 hours.</li>
              <li className="flex items-start gap-3"><span className="text-emerald-500 flex-shrink-0">✓</span>Providing a timeline for investigation and resolution.</li>
              <li className="flex items-start gap-3"><span className="text-emerald-500 flex-shrink-0">✓</span>Not pursuing legal action for good-faith security research.</li>
              <li className="flex items-start gap-3"><span className="text-emerald-500 flex-shrink-0">✓</span>Crediting researchers in our security acknowledgements (if desired).</li>
            </ul>
            <p className="text-slate-400 text-sm">
              Report to:{' '}
              <a href="mailto:security@flowen.digital?subject=%5BSECURITY%5D Vulnerability Report" className="text-emerald-400 hover:underline font-mono">
                security@flowen.digital
              </a>{' '}
              with subject line <span className="font-mono text-slate-300">[SECURITY]</span>. Please include steps to reproduce, impact assessment, and any relevant proof of concept.
            </p>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
