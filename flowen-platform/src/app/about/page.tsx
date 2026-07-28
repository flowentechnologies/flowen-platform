import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Flowen — Neural Speech Coordination Platform',
  description: 'Flowen was built to give every person who stutters access to clinical-grade biofeedback — without waiting lists, geography, or cost being barriers.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 py-20 text-center">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            OUR MISSION
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mt-6">
            Every word gets there.
          </h1>
          <p className="mt-5 text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Flowen exists to democratise access to clinical-grade speech biofeedback. We build real-time neural tools that give people who stutter the same level of feedback that used to require a specialist clinic and a full therapy session to access.
          </p>
        </section>

        {/* Mission cards */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: 'For Individuals',
                desc: 'Flowen gives people who stutter (PWS) a private, on-demand coaching environment. Practice easy onset, controlled breathing, and viseme alignment at your own pace — with instant acoustic feedback.',
              },
              {
                label: 'For Clinicians',
                desc: 'Speech and Language Therapists can monitor client sessions remotely, review disfluency telemetry, and track progress over time. Integrated into NHS ICB and Access to Work procurement pathways.',
              },
              {
                label: 'For Institutions',
                desc: 'Commissioners, DSA bodies, and NHS integrated care boards can deploy Flowen as a supplementary digital therapeutic under DCB0129 clinical safety governance — with full audit trails.',
              },
            ].map(card => (
              <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-7">
                <h3 className="text-base font-bold text-emerald-400 mb-3 uppercase tracking-wider text-xs font-mono">{card.label}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Story */}
        <section className="border-t border-slate-800/60 max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-white mb-6">Why Flowen Exists</h2>
          <div className="space-y-5 text-slate-400 text-sm leading-relaxed">
            <p>
              Stuttering affects approximately 1% of the global population — around 70 million people. Despite decades of evidence-based therapy, access remains severely limited: NHS waiting lists stretch 12–24 months in many regions, private therapy costs £80–£150 per session, and no digital therapeutic has historically offered the acoustic precision needed to replicate in-clinic biofeedback.
            </p>
            <p>
              Flowen was built to close this gap. By combining sub-80ms audio processing with clinically-informed easy-onset coaching protocols, Flowen delivers the kind of real-time feedback that was previously only available in a specialist clinic — anywhere, at any time.
            </p>
            <p>
              We work within the UK&apos;s clinical governance framework: DCB0129 safety standards, UK GDPR Article 9 (special-category biometric data), and the NHS Digital Technology Assessment Criteria (DTAC). This isn&apos;t a wellness app — it&apos;s a clinical tool built to the standards that commissioners require.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="border-t border-slate-800/60 max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-white mb-10 text-center">Principles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: 'Clinical First', body: 'Every product decision is evaluated against clinical utility and safety, not engagement metrics.' },
              { title: 'Privacy by Design', body: 'Voice biomarkers are processed on-device where possible. No data leaves UK servers. Consent is explicit, revocable, and audited.' },
              { title: 'Radical Access', body: 'We design for NHS, Access to Work, and DSA funding from day one — not as an afterthought. Cost should never be a barrier to fluency.' },
              { title: 'Transparent Governance', body: 'Immutable audit logs, open clinical safety case documentation, and clear data retention policies that users can understand and control.' },
            ].map(v => (
              <div key={v.title} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h3 className="text-white font-bold mb-2">{v.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-slate-800/60 max-w-3xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Interested in Flowen?</h2>
          <p className="text-slate-400 text-sm mb-8">Whether you&apos;re a PWS, a clinician, or a commissioner — we&apos;d like to hear from you.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/waitlist" className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all">
              Join the Waitlist
            </Link>
            <Link href="/#contact" className="px-8 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-200 font-semibold text-sm transition-all">
              Institutional Inquiry
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
