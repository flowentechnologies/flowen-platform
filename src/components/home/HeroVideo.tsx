'use client';

import { useEffect, useRef } from 'react';
import { createScrollVideoController, heroProgress } from '@/lib/hero/scroll-video';

export default function HeroVideo() {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const heroRef        = useRef<HTMLElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video   = videoRef.current;
    const hero    = heroRef.current;
    const content = heroContentRef.current;
    if (!video || !hero) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const controller = createScrollVideoController(video);
    let frame: number | null = null;
    let failed = false;

    const render = () => {
      frame = null;
      const rect = hero.getBoundingClientRect();
      const progress = heroProgress(rect.top, rect.height);
      const still = reducedMotion.matches || failed;
      // Text stays readable/in normal flow. Only the decorative background moves.
      video.style.visibility = still ? 'hidden' : '';
      if (content) {
        content.style.opacity = '1';
        content.style.transform = '';
      }
      if (!still) {
        const blur = 12 * (1 - progress);
        video.style.filter = `blur(${blur.toFixed(2)}px)`;
        video.style.transform = `scale(${(1 + blur * 0.004).toFixed(4)})`;
        controller.update(progress);
      }
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(render);
    };
    const onError = () => { failed = true; schedule(); };
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(hero);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reducedMotion.addEventListener('change', schedule);
    video.addEventListener('error', onError);
    const source = video.querySelector('source');
    source?.addEventListener('error', onError);
    render();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controller.dispose();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reducedMotion.removeEventListener('change', schedule);
      video.removeEventListener('error', onError);
      source?.removeEventListener('error', onError);
    };
  }, []);

  return (
    <section ref={heroRef} id="hero" className="relative">
      <div className="relative overflow-hidden" style={{ minHeight: 'calc(100svh - 80px)' }}>
        <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/assets/videos/Flowen_Hero_poster.jpg')" }} />

        {/* Paused decorative video: scroll selects frames, poster survives media failure. */}
        <video
          ref={videoRef}
          muted
          aria-hidden="true"
          tabIndex={-1}
          playsInline
          preload="metadata"
          poster="/assets/videos/Flowen_Hero_poster.jpg"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(12px)', transform: 'scale(1.048)' }}
        >
          <source src="/assets/videos/Flowen_Hero.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlays — darken edges for nav legibility, keep centre clear */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#06080F]/75 via-[#06080F]/20 to-[#06080F]/85 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06080F]/50 via-transparent to-[#06080F]/50 pointer-events-none" />

        {/* Normal-flow content: never fades into an empty pinned viewport. */}
        <div
          ref={heroContentRef}
          className="relative z-10 flex flex-col items-center justify-center px-6 py-12 text-center"
          style={{ minHeight: 'calc(100svh - 80px)' }}
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
