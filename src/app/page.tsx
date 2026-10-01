import Image from 'next/image';
import MarketingNavbar from '@/components/MarketingNavbarClient';
import MarketingFooter from '@/components/MarketingFooter';
import HeroVideo from '@/components/home/HeroVideo';
import DemoVideoPlayer from '@/components/home/DemoVideoPlayer';
import ContactFormSection from '@/components/home/ContactFormSection';

export default function LandingPage() {
  return (
    <>
      {/* Preload hero poster — signals the LCP candidate to the browser immediately */}
      <link rel="preload" as="image" href="/assets/videos/Flowen_Hero_poster.jpg" fetchPriority="high" />

      <div className="min-h-screen bg-[#06080F] text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-black">

        <MarketingNavbar />

        <main id="main-content">
        {/* ── Hero — client island (scroll scrubbing + video) ───────────────── */}
        <HeroVideo />

        {/* ── Problem Statement ─────────────────────────────────────────────── */}
        <section className="py-16 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                THE PROBLEM
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-4 leading-snug">
                A place to practise between everyday conversations.
              </h2>
              <p className="text-slate-400 text-sm mt-4 leading-relaxed">
                Flowen brings speech exercises, microphone-based feedback and session history into one browser-based practice space. Use it at your own pace. If you need assessment or treatment, speak to a qualified Speech and Language Therapist.
              </p>
              <a href="/resources/easy-onset-techniques" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors mt-6">
                Explore speech practice →
              </a>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: 'Practice', label: 'guided speech exercises' },
                { value: 'Feedback', label: 'microphone-based visual cues' },
                { value: 'History', label: 'review completed sessions' },
                { value: 'Web', label: 'use a supported browser' },
              ].map(s => (
                <div key={s.label} className="bg-[#0A0D14] border border-slate-800 rounded-xl p-5 text-center">
                  <div className="text-3xl font-black text-emerald-400 font-mono">{s.value}</div>
                  <div className="text-xs text-slate-400 mt-1 leading-snug">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Technology Section ────────────────────────────────────────────── */}
        <section id="technology" className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
              HOW THE PRODUCT WORKS
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-4">Feedback while you practise</h2>
            <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
              The browser analyses microphone audio to display live feedback. Timing and signal quality depend on your device, browser and environment; no end-to-end latency guarantee is published.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-7 hover:border-emerald-500/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:bg-emerald-500/20 transition-all">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Acoustic Biofeedback Engine</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Microphone audio drives visual cues based on acoustic features such as amplitude and pitch. These estimates support practice; they are not clinical measurements of vocal tension or a diagnosis.
              </p>
              <div className="mt-5 flex items-center gap-2">
                <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs font-mono text-emerald-400">Live visual cues</span>
                <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-400">16kHz PCM</span>
              </div>
            </div>

            <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-7 hover:border-teal-500/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-5 group-hover:bg-teal-500/20 transition-all">
                <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Avatar demonstration</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Explore animated mouth shapes in the avatar demonstration. During AI conversation, avatar motion is driven by the AI voice audio, not a clinical measurement of your mouth or larynx.
              </p>
              <div className="mt-5 flex items-center gap-2">
                <span className="px-2 py-1 bg-teal-500/10 border border-teal-500/20 rounded-lg text-xs font-mono text-teal-400">Animated mouth shapes</span>
                <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-400">Visual demonstration</span>
              </div>
            </div>

            <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-7 hover:border-slate-600/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-slate-700/50 border border-slate-700 flex items-center justify-center mb-5 group-hover:bg-slate-700 transition-all">
                <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Privacy and safety information</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Read how Flowen handles recordings, audio processing and account data. Some features send audio to service providers or store recordings. Clinical safety documents remain drafts; this is not a claim of NHS approval or certification.
              </p>
              <div className="mt-5 flex items-center gap-2">
                <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-400">Safety information</span>
                <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-400">Privacy policy</span>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Feedback', value: 'Live' },
              { label: 'Sample Rate',      value: '16kHz' },
              { label: 'Session History', value: 'In app' },
              { label: 'Platform', value: 'Browser' },
            ].map(stat => (
              <div key={stat.label} className="bg-[#0A0D14] border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-xl font-black text-emerald-400 font-mono">{stat.value}</div>
                <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="mt-10 pt-8 border-t border-slate-800/60 text-center">
            <div className="text-2xl font-black text-emerald-400 font-mono">At your pace</div>
            <div className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Build a routine without a promised outcome</div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <section id="pricing" className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Simple, transparent pricing</h2>
            <p className="mt-3 text-slate-400">Individual plans and organisational enquiries. External funding requires a separate decision by the relevant provider.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Founding Member */}
            <div className="bg-[#0E121E] border border-slate-800 rounded-2xl p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Early Cohort</span>
                <h3 className="text-2xl font-bold text-white mt-2">Founding Member</h3>
                <div className="mt-4 flex items-baseline text-white">
                  <span className="text-4xl font-extrabold">£19.96</span>
                  <span className="text-slate-400 ml-2">/ month</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">£239.52 billed annually, equivalent to £19.96/month. Review the final price and terms at checkout.</p>
                <ul className="mt-6 space-y-3 text-sm text-slate-300">
                  <li className="flex items-center">✓ Live speech practice feedback</li>
                  <li className="flex items-center">✓ 3D avatar demonstration</li>
                  <li className="flex items-center">✓ Session history and practice metrics</li>
                </ul>
              </div>
              <a
                href="/auth/signup"
                className="mt-8 w-full py-3 rounded-xl border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 font-semibold text-sm transition-all text-center block"
              >
                Get started →
              </a>
            </div>

            {/* Standard Consumer */}
            <div className="bg-[#0E121E] border-2 border-emerald-500/80 rounded-2xl p-8 flex flex-col justify-between relative shadow-xl shadow-emerald-500/10">
              <div className="absolute -top-3 right-6 bg-emerald-500 text-black text-xs font-bold px-3 py-1 rounded-full uppercase">Individual Access</div>
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Consumer Tier</span>
                <h3 className="text-2xl font-bold text-white mt-2">Standard Access</h3>
                <div className="mt-4 flex items-baseline text-white">
                  <span className="text-4xl font-extrabold">£39.99</span>
                  <span className="text-slate-400 ml-2">/ month</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Standard individual rate.</p>
                <ul className="mt-6 space-y-3 text-sm text-slate-300">
                  <li className="flex items-center">✓ Unlimited real-time speech practice</li>
                  <li className="flex items-center">✓ Dynamic easy-onset prompts</li>
                  <li className="flex items-center">✓ Practice activity analytics</li>
                </ul>
              </div>
              <a
                href="/auth/signup"
                className="mt-8 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all text-center block"
              >
                Get started →
              </a>
            </div>

            {/* Funded Access */}
            <div className="bg-[#0E121E] border border-slate-800 rounded-2xl p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <span className="text-xs font-semibold text-teal-400 uppercase tracking-widest">Institutional</span>
                <h3 className="text-2xl font-bold text-white mt-2">Funded Access</h3>
                <div className="mt-4 flex items-baseline text-white">
                  <span className="text-4xl font-extrabold">£79.99</span>
                  <span className="text-slate-400 ml-2">/ seat / mo</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Indicative organisational rate, billed annually. Setup fees and agreed terms may apply.</p>
                <ul className="mt-6 space-y-3 text-sm text-slate-300">
                  <li className="flex items-center">Funding approval is not guaranteed</li>
                  <li className="flex items-center">Clinical safety status — <a href="/security#dcb0129" className="text-teal-400 underline ml-1">docs</a></li>
                  <li className="flex items-center">Contact us to discuss organisational access</li>
                </ul>
              </div>
              <a
                href="#contact"
                className="mt-8 w-full py-3 rounded-xl border border-slate-700 hover:border-teal-400 hover:text-teal-400 font-semibold text-sm transition-all text-center block"
              >
                Request Institutional Block
              </a>
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────────────── */}
        <section className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              HOW IT WORKS
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-4">Your practice routine</h2>
            <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">
              Explore the account, practice and session-history tools. No improvement in fluency is guaranteed.
            </p>
          </div>
          <div className="space-y-20">
            {[
              { n:'01', title:'Create your account',        body:'Create an account without a payment card. Three introductory practice sessions are included.',                                                                                                                                                       src:'/assets/screenshots/auth-signup.jpg',        alt:'Sign up screen' },
              { n:'02', title:'Set up your profile',        body:'Choose your role and enter your practice preferences during onboarding.',                                                                                                             src:'/assets/screenshots/onboarding.jpg',          alt:'Onboarding screen' },
              { n:'03', title:'Begin daily practice',       body:'Explore guided practice stages and exercises. The exercises are not a personalised clinical treatment plan.',                                                                                src:'/assets/screenshots/dashboard-practice.jpg',  alt:'Practice session' },
              { n:'04', title:'Track your progress',        body:'Review saved session summaries, practice activity and stage completion in your dashboard. Automated scores are estimates, not validated clinical outcomes.',                                                                                                               src:'/assets/screenshots/dashboard-analytics.jpg', alt:'Analytics dashboard' },
              { n:'05', title:'Clinician tools', body:'The platform includes clinician interfaces for assigned accounts. Access requires an appropriate clinician relationship and account permissions; a subscription does not supply a therapist.',                                                                                          src:'/assets/screenshots/clinician.jpg',           alt:'Clinician dashboard' },
            ].map((step, i) => (
              <div key={step.n} className={`flex flex-col ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-10 md:gap-16`}>
                <div className="w-full md:w-1/2 order-first md:order-none">
                  <Image src={step.src} alt={step.alt} width={1280} height={800} className="w-full rounded-2xl border border-slate-800 shadow-2xl shadow-black/40" />
                </div>
                <div className="w-full md:w-1/2 flex flex-col gap-3">
                  <span className="text-7xl font-black bg-gradient-to-br from-emerald-400 to-cyan-500 bg-clip-text text-transparent leading-none select-none" aria-hidden="true">{step.n}</span>
                  <h3 className="text-2xl font-bold text-white">{step.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-md">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-14 text-center">
            <a href="/how-it-works" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Full walkthrough with screenshots →
            </a>
          </div>
        </section>

        {/* ── Platform Demo Video — client island ───────────────────────────── */}
        <section className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
          <div className="text-center mb-10">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
              PLATFORM WALKTHROUGH
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-4">See Flowen in Action</h2>
            <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">
              Multi-angle walkthrough of the real-time acoustic biofeedback interface, viseme alignment, and session analytics.
            </p>
          </div>

          <DemoVideoPlayer />

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-5 py-4">
              <div className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">Real-Time Biofeedback</div>
              <div className="text-slate-400 text-sm">Live acoustic feedback with estimated practice cues</div>
            </div>
            <a href="/viseme" className="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 rounded-xl px-5 py-4 transition-colors group block">
              <div className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                Viseme Alignment
                <span className="text-emerald-500/60 group-hover:text-emerald-400 transition-colors text-xs">↗</span>
              </div>
              <div className="text-slate-400 text-sm">ARKit viseme avatar driven by real-time frequency analysis of the AI audio — explore all states</div>
            </a>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-5 py-4">
              <div className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">Session Analytics</div>
              <div className="text-slate-400 text-sm">Session history and estimated practice metrics</div>
            </div>
          </div>
        </section>

        {/* ── Contact Form — client island ──────────────────────────────────── */}
        <ContactFormSection />
        </main>

        <MarketingFooter />
      </div>
    </>
  );
}
