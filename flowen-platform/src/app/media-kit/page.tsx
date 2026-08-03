import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Media Kit — Flowen Speech Platform',
  description: 'Press resources, brand assets, company overview, and contact details for journalists and PR professionals covering Flowen.',
};

const STATS = [
  { value: '70M', label: 'People globally who stutter' },
  { value: '1%', label: 'Global population affected' },
  { value: '<80ms', label: 'Biofeedback pipeline latency' },
  { value: '42', label: 'Viseme states supported' },
  { value: '£19.95', label: 'Entry price per month' },
  { value: 'DCB0129', label: 'Clinical safety standard' },
];

const BRAND_COLOURS = [
  { name: 'Emerald Primary', hex: '#10B981', class: 'bg-emerald-500' },
  { name: 'Teal Accent', hex: '#14B8A6', class: 'bg-teal-500' },
  { name: 'Background Dark', hex: '#06080F', class: 'bg-[#06080F] border border-slate-700' },
  { name: 'Slate Surface', hex: '#0F172A', class: 'bg-slate-900' },
  { name: 'Text Primary', hex: '#F8FAFC', class: 'bg-slate-50' },
  { name: 'Text Secondary', hex: '#94A3B8', class: 'bg-slate-400' },
];

const KEY_POINTS = [
  'Flowen is the UK\'s first sub-80ms neural biofeedback platform purpose-built for stuttering therapy.',
  'The platform operates within NHS Digital\'s DCB0129 Clinical Safety Standard — eligible for NHS, Access to Work, and DSA funding.',
  'Flowen does not store raw audio. All voice biomarkers are computed on-device and retained as anonymised aggregate metrics.',
  'The technology stack uses WebRTC AudioContext, 16kHz PCM capture, and a proprietary laryngeal tension index for real-time disfluency detection.',
  'Flowen targets three markets: individual PWS subscribers, clinical SLT practices, and NHS/public-sector block contracts.',
  'The company is registered in the United Kingdom. All user data is held under UK GDPR (DPA 2018) within UK-GBR data centres.',
];

export default function MediaKitPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />

      <main className="flex-1">
        {/* Header */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            PRESS & MEDIA
          </span>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4">Media Kit</h1>
          <p className="text-slate-400 text-sm mt-3 max-w-2xl">
            For press inquiries, broadcast media, and editorial coverage. Contact our press team at{' '}
            <a href="mailto:press@flowen.digital" className="text-emerald-400 hover:underline">press@flowen.digital</a>{' '}
            with the subject line <span className="font-mono text-slate-300">[PRESS]</span>.
          </p>
        </section>

        {/* Company at a glance */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-8 pb-3 border-b border-slate-800">
            Company at a Glance
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            {STATS.map(s => (
              <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
                <div className="text-2xl font-black text-emerald-400 font-mono">{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7">
            <h3 className="text-sm font-bold text-white mb-5 uppercase tracking-wider text-xs font-mono">Company Overview</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4 text-sm">
              {[
                ['Company name', 'Flowen Group HoldCo'],
                ['Registered jurisdiction', 'United Kingdom'],
                ['Founded', '2026'],
                ['Sector', 'Digital Health / MedTech'],
                ['Clinical standard', 'DCB0129 (NHS Digital)'],
                ['Data governance', 'UK GDPR / DPA 2018 / Article 9'],
                ['Primary market', 'UK (NHS, Access to Work, DSA)'],
                ['Press contact', 'press@flowen.digital'],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <dt className="text-slate-500 text-xs">{k}</dt>
                  <dd className="text-white font-medium mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Key messages */}
        <section className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-8 pb-3 border-b border-slate-800">
            Key Messages for Journalists
          </h2>
          <ul className="space-y-4">
            {KEY_POINTS.map((point, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center font-mono">
                  {i + 1}
                </span>
                <p className="text-slate-300 text-sm leading-relaxed">{point}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Brand assets */}
        <section className="border-t border-slate-800/60 max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-8 pb-3 border-b border-slate-800">
            Brand Colours
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {BRAND_COLOURS.map(c => (
              <div key={c.name} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex-shrink-0 ${c.class}`} />
                <div>
                  <div className="text-white text-sm font-medium">{c.name}</div>
                  <div className="text-slate-500 font-mono text-xs mt-0.5">{c.hex}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-7">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-4">Logo & Typography</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-black text-black text-2xl shadow-lg shadow-emerald-500/20">
                F
              </div>
              <div>
                <div className="text-white font-black text-2xl tracking-tight">FLOWEN</div>
                <div className="text-slate-500 text-xs font-mono mt-0.5">Wordmark — Inter font family, weight 900</div>
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              High-resolution logo files and brand guidelines are available on request for verified press and media organisations. Email{' '}
              <a href="mailto:press@flowen.digital" className="text-emerald-400 hover:underline">press@flowen.digital</a>{' '}
              with your organisation name and publication.
            </p>
          </div>
        </section>

        {/* Sample press release boilerplate */}
        <section className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-8 pb-3 border-b border-slate-800">
            Boilerplate — About Flowen
          </h2>
          <div className="bg-[#0A0D14] border border-slate-700 rounded-2xl p-7">
            <p className="text-slate-300 text-sm leading-relaxed italic">
              &ldquo;Flowen is a UK-based digital health company developing neural biofeedback technology for speech fluency. Its real-time acoustic processing engine captures and analyses voice data in under 80 milliseconds, delivering immediate visual and coaching feedback to support people who stutter. Flowen operates within the NHS Digital DCB0129 Clinical Safety Standard and is designed for individual, clinical, and institutional deployment across NHS, Access to Work, and Disabled Students&apos; Allowance funding pathways.&rdquo;
            </p>
          </div>
          <p className="text-slate-500 text-xs mt-4">
            You may use the above boilerplate in press coverage of Flowen without prior approval. For longer editorial descriptions, please contact our press team.
          </p>
        </section>

        {/* Press contact */}
        <section className="border-t border-slate-800/60 max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-xl font-bold text-white mb-3">Press Inquiries</h2>
          <p className="text-slate-400 text-sm mb-6">
            For interviews, embargoed announcements, or editorial access to Flowen — reach our press team directly.
          </p>
          <a
            href="mailto:press@flowen.digital?subject=%5BPRESS%5D Media Inquiry"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all"
          >
            Email Press Team
          </a>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
