'use client';

import { useEffect, useRef } from 'react';

export default function HeroVideo() {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const heroRef        = useRef<HTMLElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video   = videoRef.current;
    const hero    = heroRef.current;
    const content = heroContentRef.current;
    if (!video || !hero) return;

    // Auto-play and loop
    const startPlay = () => { video.play().catch(() => {}); };
    if (video.readyState >= 3) {
      startPlay();
    } else {
      video.addEventListener('canplay', startPlay, { once: true });
    }

    const MAX_BLUR = 12; // px — "35%" blur at scroll progress 0

    const onScroll = () => {
      const heroScrollable = hero.offsetHeight - window.innerHeight;
      const scrolled       = window.scrollY - hero.offsetTop;
      const progress       = heroScrollable > 0
        ? Math.max(0, Math.min(1, scrolled / heroScrollable))
        : 0;

      // Blur: MAX_BLUR → 0 as user scrolls through the hero.
      // Scale compensates for edge bleed so blurred pixels don't show
      // the container background at the borders.
      const blurPx = MAX_BLUR * (1 - progress);
      const scale  = 1 + blurPx * 0.004; // ~1.048 at max blur → 1.0 at clear
      video.style.filter    = blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : '';
      video.style.transform = `scale(${scale.toFixed(4)})`;

      // Hero content: fade out and lift as user scrolls away
      if (content) {
        const opacity    = Math.max(0, 1 - progress * 2.2);
        const translateY = progress * -70;
        content.style.opacity   = String(opacity);
        content.style.transform = `translateY(${translateY}px)`;
      }
    };

    // Apply initial state immediately (blur on load)
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <section ref={heroRef} id="hero" className="relative" style={{ height: '200vh' }}>
      <div className="sticky top-0 h-screen overflow-hidden">

        {/* Auto-playing looping background video — blur clears as user scrolls */}
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          poster="/assets/videos/Flowen_Hero_poster.jpg"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: `blur(${12}px)`, transform: 'scale(1.048)' }}
        >
          <source src="/assets/videos/Flowen_Hero.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#06080F]/75 via-[#06080F]/20 to-[#06080F]/85 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06080F]/50 via-transparent to-[#06080F]/50 pointer-events-none" />

        {/* Hero content — fades and lifts on scroll */}
        <div
          ref={heroContentRef}
          className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center"
          style={{ paddingTop: '80px' }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8 backdrop-blur-sm">
            Sub-80ms Acoustic Biofeedback Engine
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight drop-shadow-2xl">
            Build fluency through{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              daily practice
            </span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-slate-200 max-w-2xl mx-auto leading-relaxed drop-shadow-lg">
            Flowen listens as you speak and gives you instant feedback — showing you whether your speech onset was gentle or tense, and how to improve it. Built on the evidence-based techniques used in clinical speech therapy.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/auth/signup"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base transition-all shadow-lg shadow-emerald-500/30"
            >
              Get started free →
            </a>
          </div>

          <p className="mt-4 text-xs text-emerald-400/80 font-semibold drop-shadow">
            3 free sessions included · No card required
          </p>
        </div>
      </div>
    </section>
  );
}
