'use client';

import React, { useState, useTransition } from 'react';
import { submitContactForm, FormState } from './actions/submit-form';
import { LegalPoliciesModal } from '@/components/LegalPoliciesModal';

export default function LandingPage() {
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState<FormState>({ success: false, message: '' });
  const [selectedTier, setSelectedTier] = useState<string>('Standard Access (£39.90/mo)');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'terms' | 'privacy' | 'dcb0129'>('terms');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('tier', selectedTier);

    startTransition(async () => {
      const result = await submitContactForm(formState, formData);
      setFormState(result);
    });
  };

  const openLegal = (tab: 'terms' | 'privacy' | 'dcb0129') => {
    setModalTab(tab);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-black">
      
      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-[#06080F]/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => scrollToSection('hero')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-black text-black text-xl shadow-lg shadow-emerald-500/20">
              F
            </div>
            <span className="text-2xl font-black tracking-tight text-white">FLOWEN</span>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
            <button onClick={() => scrollToSection('technology')} className="hover:text-emerald-400 transition-colors">Technology</button>
            <button onClick={() => scrollToSection('pricing')} className="hover:text-emerald-400 transition-colors">Pricing</button>
            <button onClick={() => scrollToSection('contact')} className="hover:text-emerald-400 transition-colors">Enterprise & Public Funds</button>
          </div>

          <button 
            onClick={() => scrollToSection('contact')}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all transform hover:scale-105 shadow-md shadow-emerald-500/20"
          >
            Access Portal
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="pt-36 pb-20 px-6 max-w-7xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8">
          Sub-80ms Neural Biofeedback Engine
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          The Neural Standard for <span className="bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">Speech Coordination</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Flowen converts real-time acoustic telemetry into instantaneous viseme feedback and easy-onset coaching. Built for individuals, clinical SLTs, and institutional public funding programs.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={() => scrollToSection('pricing')}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base transition-all shadow-lg shadow-emerald-500/25"
          >
            View Subscription Tiers
          </button>
          <button 
            onClick={() => scrollToSection('contact')}
            className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-200 font-semibold text-base bg-slate-900/50 transition-all"
          >
            Inquire for Public Funds (Access to Work / NHS)
          </button>
        </div>
      </section>

      {/* Technology Section */}
      <section id="technology" className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="text-center mb-16">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
            CLINICAL ENGINEERING
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-4">Built for Precision, Not Approximation</h2>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Every layer of the Flowen stack is optimised for the sub-100ms round-trip required to deliver effective biofeedback during live speech.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-7 hover:border-emerald-500/30 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:bg-emerald-500/20 transition-all">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Neural Biofeedback Engine</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              WebRTC AudioContext pipeline captures raw PCM at 16kHz. Laryngeal tension index, RMS amplitude, and fundamental frequency are computed per-frame and streamed in real time.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs font-mono text-emerald-400">&lt;80ms latency</span>
              <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-400">16kHz PCM</span>
            </div>
          </div>

          <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-7 hover:border-teal-500/30 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-5 group-hover:bg-teal-500/20 transition-all">
              <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Clinical Viseme Alignment</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              42 viseme states mapped to IPA phoneme symbols drive a 3D avatar in real time. Easy-onset coaching overlays guide air flow, lip position, and laryngeal relaxation simultaneously.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="px-2 py-1 bg-teal-500/10 border border-teal-500/20 rounded-lg text-xs font-mono text-teal-400">42 viseme states</span>
              <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-400">IPA mapped</span>
            </div>
          </div>

          <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-7 hover:border-slate-600/50 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-slate-700/50 border border-slate-700 flex items-center justify-center mb-5 group-hover:bg-slate-700 transition-all">
              <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">DCB0129 Safety Framework</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Immutable consent audit ledger, GDPR Article 9 data erasure pipeline, and UK data residency enforce clinical governance at every layer. All voice biomarkers are processed on-device.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-400">DCB0129</span>
              <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-400">UK GDPR Art.9</span>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { label: 'Pipeline Latency', value: '<80ms' },
            { label: 'Sample Rate', value: '16kHz' },
            { label: 'Viseme States', value: '42' },
            { label: 'Encryption', value: 'AES-256' },
            { label: 'Data Residency', value: 'UK-GBR' },
            { label: 'Clinical Standard', value: 'DCB0129' },
          ].map(stat => (
            <div key={stat.label} className="bg-[#0A0D14] border border-slate-800 rounded-xl p-4 text-center">
              <div className="text-xl font-black text-emerald-400 font-mono">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Tiers Section */}
      <section id="pricing" className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white">Commercial & Institutional Tiers</h2>
          <p className="mt-3 text-slate-400">Structured for individual practitioners, clinics, and government block contracts.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Founding Member */}
          <div className="bg-[#0E121E] border border-slate-800 rounded-2xl p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
            <div>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Early Cohort</span>
              <h3 className="text-2xl font-bold text-white mt-2">Founding Member</h3>
              <div className="mt-4 flex items-baseline text-white">
                <span className="text-4xl font-extrabold">£19.95</span>
                <span className="text-slate-400 ml-2">/ month</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Locked price for early adopters.</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                <li className="flex items-center">✓ Full Sub-80ms Speech Biofeedback</li>
                <li className="flex items-center">✓ 3D Avatar & Viseme Alignment</li>
                <li className="flex items-center">✓ Personal Progress Metrics</li>
              </ul>
            </div>
            <button 
              onClick={() => { setSelectedTier('Founding Member (£19.95/mo)'); scrollToSection('contact'); }}
              className="mt-8 w-full py-3 rounded-xl border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 font-semibold text-sm transition-all"
            >
              Select Tier
            </button>
          </div>

          {/* Standard Consumer */}
          <div className="bg-[#0E121E] border-2 border-emerald-500/80 rounded-2xl p-8 flex flex-col justify-between relative shadow-xl shadow-emerald-500/10">
            <div className="absolute -top-3 right-6 bg-emerald-500 text-black text-xs font-bold px-3 py-1 rounded-full uppercase">Most Popular</div>
            <div>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Consumer Tier</span>
              <h3 className="text-2xl font-bold text-white mt-2">Standard Access</h3>
              <div className="mt-4 flex items-baseline text-white">
                <span className="text-4xl font-extrabold">£39.90</span>
                <span className="text-slate-400 ml-2">/ month</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Standard individual commercial rate.</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                <li className="flex items-center">✓ Unlimited Real-Time Speech Practice</li>
                <li className="flex items-center">✓ Dynamic Easy-Onset Prompts</li>
                <li className="flex items-center">✓ Disfluency Telemetry Analytics</li>
              </ul>
            </div>
            <button 
              onClick={() => { setSelectedTier('Standard Access (£39.90/mo)'); scrollToSection('contact'); }}
              className="mt-8 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all"
            >
              Select Tier
            </button>
          </div>

          {/* Government / Public Funds */}
          <div className="bg-[#0E121E] border border-slate-800 rounded-2xl p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
            <div>
              <span className="text-xs font-semibold text-teal-400 uppercase tracking-widest">Institutional</span>
              <h3 className="text-2xl font-bold text-white mt-2">Government / Public Funds</h3>
              <div className="mt-4 flex items-baseline text-white">
                <span className="text-4xl font-extrabold">£79.99</span>
                <span className="text-slate-400 ml-2">/ seat / mo</span>
              </div>
              <p className="text-xs text-emerald-400 mt-1">Billed annually upfront (£959.88/yr).</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                <li className="flex items-center">✓ Access to Work / NHS / DSA Approved</li>
                <li className="flex items-center">✓ DCB0129 Clinical Audit & Compliance</li>
                <li className="flex items-center">✓ Dedicated Account Manager & Block Portal</li>
              </ul>
            </div>
            <button 
              onClick={() => { setSelectedTier('Public Sector / Gov Block Contract (£79.99/mo)'); scrollToSection('contact'); }}
              className="mt-8 w-full py-3 rounded-xl border border-slate-700 hover:border-teal-400 hover:text-teal-400 font-semibold text-sm transition-all"
            >
              Request Institutional Block
            </button>
          </div>
        </div>
      </section>

      {/* Form Submission Section */}
      <section id="contact" className="py-20 px-6 max-w-4xl mx-auto border-t border-slate-800/60">
        <div className="bg-[#0A0D14] border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white">Direct Access & Inquiry Portal</h2>
            <p className="text-slate-400 mt-2 text-sm">
              All inquiries are dispatched directly to our clinical and commercial team at <strong className="text-emerald-400">flowenspeech@outlook.com</strong>.
            </p>
          </div>

          {formState.success ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
              <div className="text-3xl">✓</div>
              <h3 className="text-xl font-bold text-emerald-400">Submission Received</h3>
              <p className="text-slate-300 text-sm">{formState.message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Selected Tier</label>
                <input 
                  type="text" 
                  value={selectedTier} 
                  readOnly 
                  className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-emerald-400 font-semibold text-sm cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Full Name *</label>
                  <input 
                    name="name" 
                    type="text" 
                    required 
                    placeholder="Howard Henry" 
                    className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                  {formState.errors?.name && <p className="text-red-400 text-xs mt-1">{formState.errors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address *</label>
                  <input 
                    name="email" 
                    type="email" 
                    required 
                    placeholder="howard@example.com" 
                    className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                  {formState.errors?.email && <p className="text-red-400 text-xs mt-1">{formState.errors.email}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Organization / Program (Optional)</label>
                <input 
                  name="role" 
                  type="text" 
                  placeholder="Access to Work / NHS ICB / Private Practice" 
                  className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Inquiry / Requirements *</label>
                <textarea 
                  name="message" 
                  rows={4} 
                  required 
                  placeholder="Describe your inquiry or institutional seat block requirement..." 
                  className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                />
                {formState.errors?.message && <p className="text-red-400 text-xs mt-1">{formState.errors.message}</p>}
              </div>

              <p className="text-xs text-slate-500">
                By submitting this form, you acknowledge that your details will be processed in accordance with our{' '}
                <button type="button" onClick={() => openLegal('privacy')} className="text-emerald-400 underline">
                  Privacy Policy & UK GDPR
                </button>.
              </p>

              <button 
                type="submit" 
                disabled={isPending}
                className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
              >
                {isPending ? 'Dispatching to flowenspeech@outlook.com...' : 'Submit Inquiry'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#04050A]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-black text-black text-sm">F</div>
                <span className="text-white font-bold text-lg">FLOWEN</span>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed">Neural biofeedback speech coordination for individuals, clinicians, and public programs.</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><button onClick={() => scrollToSection('technology')} className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Technology</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Pricing</button></li>
                <li><a href="/waitlist" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Join Waitlist</a></li>
                <li><a href="/resources" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Resources</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Company</h4>
              <ul className="space-y-2.5">
                <li><a href="/about" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">About Us</a></li>
                <li><a href="/faq" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">FAQ</a></li>
                <li><a href="/media-kit" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Media Kit</a></li>
                <li><a href="/security" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Security</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Legal</h4>
              <ul className="space-y-2.5">
                <li><button onClick={() => openLegal('terms')} className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Terms of Service</button></li>
                <li><button onClick={() => openLegal('privacy')} className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Privacy &amp; UK GDPR</button></li>
                <li><button onClick={() => openLegal('dcb0129')} className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">DCB0129 Statement</button></li>
                <li><a href="/cookie-policy" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Cookie Policy</a></li>
                <li><a href="/accessibility" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Accessibility</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800/60 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-600 text-xs">© 2026 Flowen Group HoldCo. All rights reserved. Registered under UK GDPR &amp; DCB0129 Clinical Safety Governance.</p>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-600">DCB0129</span>
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-600">UK GDPR</span>
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-600">NHS</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Legal Policy Modal */}
      <LegalPoliciesModal 
        isOpen={modalOpen} 
        initialTab={modalTab} 
        onClose={() => setModalOpen(false)} 
      />
    </div>
  );
}
