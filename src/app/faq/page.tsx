import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ — Flowen Speech Platform',
  description: 'Answers to common questions about Flowen, how the biofeedback engine works, pricing, NHS funding, and clinical governance.',
  alternates: {
    canonical: '/faq',
  },
};

const FAQS: { section: string; items: { q: string; a: string }[] }[] = [
  {
    section: 'General',
    items: [
      {
        q: 'What is Flowen?',
        a: 'Flowen is a real-time neural biofeedback platform designed to support people who stutter (PWS). It processes your voice in under 80ms, detects laryngeal tension and disfluency patterns, and delivers immediate visual and vibrotactile feedback to guide easy-onset speech techniques.',
      },
      {
        q: 'Who is Flowen for?',
        a: 'Flowen is built for three audiences: individuals who stutter who want a structured, private practice environment; Speech and Language Therapists (SLTs) who want to extend their clinical reach with remote monitoring; and institutional commissioners — NHS ICBs, Access to Work, and Disabled Students\' Allowance (DSA) providers — who want a DCB0129-compliant digital therapeutic.',
      },
      {
        q: 'Is Flowen a medical device?',
        a: 'Flowen is a digital health tool governed under the UK\'s DCB0129 Clinical Safety Standard for Health IT. It is not a Class I, IIa, IIb, or III medical device under the UK MDR 2002 (as amended). It is designed as a supplementary therapeutic aid and does not replace clinical assessment or diagnosis.',
      },
      {
        q: 'Does Flowen cure stuttering?',
        a: 'No. Flowen does not cure stuttering. It provides structured practice tools based on established fluency-shaping techniques — easy onset, reduced speaking rate, controlled breathing — which are well-evidenced for reducing disfluency frequency and severity. Results vary by individual.',
      },
    ],
  },
  {
    section: 'Product & Technology',
    items: [
      {
        q: 'How does the biofeedback work?',
        a: 'Your microphone captures raw PCM audio at 16kHz. Our on-device engine computes RMS amplitude, fundamental frequency (pitch), and a laryngeal tension index — all within a single 80ms processing frame. The results drive a 3D avatar (42 viseme states) and an easy-onset coaching overlay in real time.',
      },
      {
        q: 'What devices does Flowen work on?',
        a: 'Flowen runs in any modern browser via WebRTC. A dedicated native iOS and Android app (React Native / Expo) with hardware-optimised audio capture (RemoteIO on iOS; Oboe on Android) is in development.',
      },
      {
        q: 'Is my voice data stored?',
        a: 'Raw audio is never stored. Acoustic biomarkers (aggregated RMS, pitch, laryngeal tension index) are retained per your data retention policy — defaulting to 30 days for session snapshots. All data is stored in UK data centres, encrypted at rest (AES-256) and in transit (TLS 1.3). You can request erasure at any time under UK GDPR Article 17.',
      },
      {
        q: 'What is a viseme?',
        a: 'A viseme is a visual representation of a phoneme — the smallest unit of sound — as produced by the mouth and lips. Flowen maps 42 viseme states to IPA phoneme symbols and drives a 3D avatar to give real-time visual feedback on lip position, jaw aperture, and laryngeal engagement.',
      },
      {
        q: 'What is the laryngeal tension index?',
        a: 'The laryngeal tension index (LTI) is a proprietary Flowen metric — a normalised score between 0.0 and 1.0 — that approximates the degree of laryngeal constriction based on acoustic signatures (perturbation, shimmer, harmonic-to-noise ratio). High LTI values typically precede blocks and are flagged to prompt easy-onset resets.',
      },
    ],
  },
  {
    section: 'Pricing & Access',
    items: [
      {
        q: 'How much does Flowen cost?',
        a: 'Flowen offers three tiers: Founding Member at £19.95/month (price-locked for early cohort), Standard Access at £39.90/month, and Government/Public Funds at £79.99/seat/month (billed annually). NHS and Access to Work procurement is handled through our institutional inquiry form.',
      },
      {
        q: 'Can I use Access to Work funding to pay for Flowen?',
        a: 'Yes. Access to Work can cover assistive technology and digital therapeutic tools for employees with a disability or health condition that affects their ability to work. Flowen\'s Government tier is structured to comply with AtW procurement requirements. Contact us to discuss your specific situation.',
      },
      {
        q: 'Is Flowen available through the NHS?',
        a: 'We are actively engaging with NHS Integrated Care Boards. Flowen is structured for NHS procurement under the Digital Technology Assessment Criteria (DTAC). Contact our clinical team at clinical@flowen.digital for a procurement conversation.',
      },
      {
        q: 'Is there a free trial?',
        a: 'We are currently in an early access program. Join our waitlist to be notified when free trial allocations open.',
      },
    ],
  },
  {
    section: 'Privacy & Security',
    items: [
      {
        q: 'Where is my data stored?',
        a: 'All Flowen user data is stored in UK data centres (UK-GBR data residency region). We do not transfer personal data to the EEA, USA, or any third country without an adequate safeguard in place. Our data controller entity is Flowen Group HoldCo.',
      },
      {
        q: 'Do you share my voice data with anyone?',
        a: 'We do not sell or share raw audio. Clinicians linked to your account (with your explicit consent) can view your disfluency telemetry reports. Aggregated, anonymised acoustic features may be used to improve our AI models — you can opt out in account settings.',
      },
      {
        q: 'How do I request data erasure?',
        a: 'You can submit a UK GDPR Article 17 erasure request from your account settings. Our automated pipeline anonymises PII and deletes voice biomarker data within 30 days of request. The request and completion timestamps are logged in an immutable audit ledger.',
      },
      {
        q: 'What is DCB0129?',
        a: 'DCB0129 is the NHS Digital Clinical Safety Standard for Health IT systems in England. It requires health software developers to appoint a Clinical Safety Officer, maintain a hazard log, and produce a Clinical Safety Case Report. Flowen complies with DCB0129 as a condition of its institutional offering.',
      },
    ],
  },
];

export default function FAQPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': FAQS.flatMap(group =>
      group.items.map(item => ({
        '@type': 'Question',
        'name': item.q,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': item.a,
        },
      }))
    ),
  };

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <JsonLd data={faqSchema} />
      <MarketingNavbar />

      <main id="main-content" className="flex-1 max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            SUPPORT
          </span>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4">Frequently Asked Questions</h1>
          <p className="text-slate-400 text-sm mt-3 max-w-xl mx-auto">
            Can&apos;t find what you&apos;re looking for? Email us at{' '}
            <a href="mailto:hello@flowen.digital" className="text-emerald-400 hover:underline">hello@flowen.digital</a>.
          </p>
        </div>

        <div className="space-y-14">
          {FAQS.map(group => (
            <div key={group.section}>
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 mb-6 pb-3 border-b border-slate-800">
                {group.section}
              </h2>
              <div className="space-y-6">
                {group.items.map(item => (
                  <div key={item.q} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-white font-semibold text-sm mb-3">{item.q}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
