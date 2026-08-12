'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import Image from 'next/image';
import { submitContactForm, FormState } from './actions/submit-form';
import { LegalPoliciesModal } from '@/components/LegalPoliciesModal';
import MarketingNavbar from '@/components/MarketingNavbar';

export default function LandingPage() {
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState<FormState>({ success: false, message: '' });
  const [selectedTier, setSelectedTier] = useState<string>('Standard Access (£39.90/mo)');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'terms' | 'privacy' | 'dcb0129'>('terms');

  const demoVideoRef = useRef<HTMLVideoElement>(null);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoMuted, setDemoMuted] = useState(true);

  useEffect(() => {
    const video = demoVideoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().then(() => setDemoPlaying(true)).catch(() => {});
        } else {
          video.pause();
          setDemoPlaying(false);
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

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

  const videoRef        = useRef<HTMLVideoElement>(null);
  const heroRef         = useRef<HTMLElement>(null);
  const heroContentRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video   = videoRef.current;
    const hero    = heroRef.current;
    const content = heroContentRef.current;
    if (!video || !hero) return;

    // Autoplay immediately — first frame shows before any scroll.
    // On first scroll we pause and take manual control of currentTime.
    let scrubbing  = false;
    let rafPending = false;
    let targetTime = 0;

    const startPlay = () => { video.play().catch(() => {}); };
    if (video.readyState >= 3) {
      startPlay();
    } else {
      video.addEventListener('canplay', startPlay, { once: true });
    }

    const applyFrame = () => {
      rafPending = false;
      if (video.readyState >= 2 && Math.abs(video.currentTime - targetTime) > 0.008) {
        video.currentTime = targetTime;
      }
    };

    const onScroll = () => {
      const heroScrollable = hero.offsetHeight - window.innerHeight;
      const scrolled       = window.scrollY - hero.offsetTop;
      const progress       = heroScrollable > 0
        ? Math.max(0, Math.min(1, scrolled / heroScrollable))
        : 0;

      if (!scrubbing && window.scrollY > 0) {
        scrubbing = true;
        video.pause();
      }

      if (scrubbing) {
        targetTime = progress * (video.duration || 0);
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(applyFrame);
        }
      }

      if (content) {
        const opacity    = Math.max(0, 1 - progress * 2.2);
        const translateY = progress * -70;
        content.style.opacity   = String(opacity);
        content.style.transform = `translateY(${translateY}px)`;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => { window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <>
    {/* Preload the hero video at highest browser priority */}
    {/* eslint-disable-next-line @next/next/no-head-element */}
    <link
      rel="preload"
      href="/assets/videos/Flowen_Hero.mp4"
      as="video"
      type="video/mp4"
    />
    <div className="min-h-screen bg-[#06080F] text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-black">
      
      {/* Navigation Header */}
      <MarketingNavbar />

      {/* Hero Section — 200vh tall; inner viewport is sticky so video scrubs as user scrolls */}
      <section ref={heroRef} id="hero" className="relative" style={{ height: '200vh' }}>
        <div className="sticky top-0 h-screen overflow-hidden">

          {/* Scroll-scrubbed background video — autoplays to show first frame immediately,
              switches to manual currentTime control on first scroll */}
          <video
            ref={videoRef}
            muted
            playsInline
            preload="auto"
            poster="/assets/videos/Flowen_Hero_poster.jpg"
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/assets/videos/Flowen_Hero.mp4" type="video/mp4" />
          </video>

          {/* Gradient overlays — darken edges for nav legibility, keep centre clear */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#06080F]/75 via-[#06080F]/20 to-[#06080F]/85 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06080F]/50 via-transparent to-[#06080F]/50 pointer-events-none" />

          {/* Hero content — fades and lifts as the user scrolls through the 200vh section */}
          <div
            ref={heroContentRef}
            className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center"
            style={{ paddingTop: '80px' }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8 backdrop-blur-sm">
              Sub-80ms Neural Biofeedback Engine
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight drop-shadow-2xl">
              The Neural Standard for{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                Speech Coordination
              </span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-slate-200 max-w-2xl mx-auto leading-relaxed drop-shadow-lg">
              Flowen converts real-time acoustic telemetry into instantaneous viseme feedback and easy-onset coaching. Built for individuals, clinical SLTs, and institutional public funding programs.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="/auth/signup"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base transition-all shadow-lg shadow-emerald-500/30"
              >
                Get started free →
              </a>
              <a
                href="/auth/login"
                className="w-full sm:w-auto px-8 py-4 rounded-xl border border-white/25 hover:border-white/50 text-white font-semibold text-base bg-white/5 backdrop-blur-sm transition-all"
              >
                Sign in
              </a>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40 select-none">
              <span className="text-xs font-mono uppercase tracking-widest">Scroll</span>
              <div className="w-px h-10 bg-gradient-to-b from-white/50 to-transparent animate-pulse" />
            </div>
          </div>
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

      {/* How It Works — 5-step flow */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="text-center mb-16">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            HOW IT WORKS
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-4">Your path to fluent speech</h2>
          <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">
            From sign-up to clinical review — five steps, fully guided.
          </p>
        </div>
        <div className="space-y-20">
          {[
            { n:'01', title:'Create your account', body:'Join the waitlist and get your personalised invitation. Sign up in under 60 seconds — no card required.', src:'/assets/screenshots/auth-signup.jpg', alt:'Sign up screen' },
            { n:'02', title:'Set up your profile', body:'Choose your role — PWS, clinician, researcher or carer. Flowen personalises your programme from day one.', src:'/assets/screenshots/onboarding.jpg', alt:'Onboarding screen' },
            { n:'03', title:'Begin daily practice', body:'Work through 5 progressive therapy stages with 10 rotating exercises each, built on evidence-based fluency techniques.', src:'/assets/screenshots/dashboard-practice.jpg', alt:'Practice session' },
            { n:'04', title:'Track your progress', body:'Every session is logged. See fluency trends, session streaks, and stage completion in your analytics dashboard.', src:'/assets/screenshots/dashboard-analytics.jpg', alt:'Analytics dashboard' },
            { n:'05', title:'Clinical review', body:'Your assigned SLT monitors telemetry remotely, adjusts your programme, and reviews session data — all in-platform.', src:'/assets/screenshots/clinician.jpg', alt:'Clinician dashboard' },
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

      {/* Platform Demo Video */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="text-center mb-10">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
            PLATFORM WALKTHROUGH
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-4">See Flowen in Action</h2>
          <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">
            Multi-angle walkthrough of the real-time neural biofeedback interface, viseme alignment, and clinical analytics suite.
          </p>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-black/60 bg-slate-900">
          <video
            ref={demoVideoRef}
            muted={demoMuted}
            loop
            playsInline
            preload="metadata"
            poster="/assets/videos/flowen_demo_poster.jpg"
            className="w-full aspect-video object-cover"
          >
            <source src="/assets/videos/flowen_demo.mp4" type="video/mp4" />
          </video>

          {!demoPlaying && (
            <button
              onClick={() => {
                const vid = demoVideoRef.current;
                if (!vid) return;
                setDemoMuted(false);
                vid.muted = false;
                vid.play().then(() => setDemoPlaying(true)).catch(() => {});
              }}
              className="absolute inset-0 flex items-center justify-center group"
              aria-label="Play demo"
            >
              <span className="w-16 h-16 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-lg shadow-emerald-500/40 group-hover:bg-emerald-400 transition-colors">
                <svg className="w-7 h-7 text-slate-950 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>
          )}

          {demoPlaying && (
            <button
              onClick={() => {
                const vid = demoVideoRef.current;
                if (!vid) return;
                vid.muted = !vid.muted;
                setDemoMuted(vid.muted);
              }}
              className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
              aria-label={demoMuted ? 'Unmute' : 'Mute'}
            >
              {demoMuted ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97V10.18L16.45 12.63C16.48 12.42 16.5 12.21 16.5 12M19 12C19 12.94 18.8 13.82 18.46 14.64L19.97 16.15C20.63 14.91 21 13.5 21 12C21 7.72 18.01 4.14 14 3.23V5.29C16.89 6.15 19 8.83 19 12M4.27 3L3 4.27L7.73 9H3V15H7L12 20V13.27L16.25 17.52C15.58 18.04 14.83 18.45 14 18.7V20.76C15.38 20.43 16.63 19.78 17.68 18.9L19.73 21L21 19.73L12 10.73L4.27 3M12 4L9.91 6.09L12 8.18V4Z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </button>
          )}

          {/* Subtle gradient border glow */}
          <div className="absolute inset-0 rounded-2xl ring-1 ring-emerald-500/10 pointer-events-none" />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-5 py-4">
            <div className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">Real-Time Biofeedback</div>
            <div className="text-slate-400 text-sm">Sub-80ms acoustic processing with live laryngeal tension overlay</div>
          </div>
          <a href="/viseme" className="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 rounded-xl px-5 py-4 transition-colors group block">
            <div className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              Viseme Alignment
              <span className="text-emerald-500/60 group-hover:text-emerald-400 transition-colors text-xs">↗</span>
            </div>
            <div className="text-slate-400 text-sm">42-state ARKit avatar driven by formant analysis and phoneme prediction — explore all states</div>
          </a>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-5 py-4">
            <div className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">Clinical Analytics</div>
            <div className="text-slate-400 text-sm">Disfluency telemetry, session trends, and SLT remote monitoring</div>
          </div>
        </div>
      </section>

      {/* See the Platform — screenshot gallery */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="text-center mb-12">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/30">
            PLATFORM PREVIEW
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-4">See the platform</h2>
          <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">
            Every screen you need — from daily practice to clinical monitoring.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { src:'/assets/screenshots/dashboard-home.jpg',     label:'Dashboard', desc:'Daily overview and session launcher' },
            { src:'/assets/screenshots/dashboard-practice.jpg', label:'Practice',  desc:'5 stages · 10 rotating exercises each' },
            { src:'/assets/screenshots/dashboard-analytics.jpg',label:'Analytics', desc:'Fluency trends and stage progress' },
            { src:'/assets/screenshots/clinician.jpg',          label:'Clinician', desc:'Remote patient monitoring for SLTs' },
            { src:'/assets/screenshots/viseme-reference.jpg',   label:'Viseme System', desc:'42-state ARKit face tracking reference' },
            { src:'/assets/screenshots/practice-micro.jpg',     label:'Micro Exercises', desc:'30–60 second targeted drills' },
          ].map(item => (
            <div key={item.label} className="group rounded-2xl overflow-hidden border border-slate-800 hover:border-emerald-500/30 transition-colors bg-slate-900/40">
              <div className="overflow-hidden">
                <Image src={item.src} alt={item.label} width={1280} height={800} className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
              </div>
              <div className="px-4 py-3 border-t border-slate-800">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Form Submission Section */}
      <section id="contact" className="py-20 px-6 max-w-4xl mx-auto border-t border-slate-800/60">
        <div className="bg-[#0A0D14] border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white">Direct Access & Inquiry Portal</h2>
            <p className="text-slate-400 mt-2 text-sm">
              All inquiries are dispatched directly to our clinical and commercial team at <strong className="text-emerald-400">hello@flowen.digital</strong>.
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
                {isPending ? 'Dispatching to hello@flowen.digital...' : 'Submit Inquiry'}
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
              <div className="flex items-center gap-2 mb-4">
                <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
                  <defs>
                    <linearGradient id="fw-lp-footer" x1="0%" y1="50%" x2="100%" y2="50%">
                      <stop offset="0%" stopColor="#F59E0B"/>
                      <stop offset="35%" stopColor="#10B981"/>
                      <stop offset="100%" stopColor="#06B6D4"/>
                    </linearGradient>
                  </defs>
                  <path d="M 10 25 C 20 25, 25 38, 35 38 C 48 38, 52 12, 65 12 C 78 12, 82 42, 95 42 C 105 42, 108 30, 115 30" stroke="url(#fw-lp-footer)" strokeWidth="6" strokeLinecap="round" fill="none"/>
                  <path d="M 10 33 C 20 33, 25 46, 35 46 C 48 46, 52 20, 65 20 C 78 20, 82 50, 95 50 C 105 50, 108 38, 115 38" stroke="url(#fw-lp-footer)" strokeWidth="6" strokeLinecap="round" fill="none"/>
                </svg>
                <span className="text-white font-bold text-lg">FLOWEN</span>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed">Neural biofeedback speech coordination for individuals, clinicians, and public programs.</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><a href="/how-it-works" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">How it works</a></li>
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
    </>
  );
}
