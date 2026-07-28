'use client';

import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { UseAudioPipelineReturn } from '@/lib/hooks/useAudioPipeline';

// ── Spring profiles ───────────────────────────────────────────────────────────
// Three distinct tensions create the layered elastic depth effect.
// Outer glow is inertial (sluggish), inner core is snappy.
const SPRING_OUTER = { stiffness: 55,  damping: 11, mass: 1.4 } as const;
const SPRING_BODY  = { stiffness: 160, damping: 18, mass: 0.9 } as const;
const SPRING_CORE  = { stiffness: 380, damping: 24, mass: 0.5 } as const;

export interface PacerOrbProps {
  pipeline: UseAudioPipelineReturn;
  size?: number;
  className?: string;
}

export function PacerOrb({ pipeline, size = 200, className }: PacerOrbProps) {
  // Raw RMS motion value — updated directly from the audio thread callback,
  // never touches React's render cycle.
  const rmsRaw = useMotionValue(0);

  useEffect(
    () => pipeline.onFrame((_, rms) => rmsRaw.set(rms)),
    [pipeline, rmsRaw],
  );

  // Normalize RMS to [0,1]. Speech typically peaks around 0.25–0.3.
  const norm = useTransform(rmsRaw, [0, 0.3], [0, 1]);

  // Each layer gets its own spring-wrapped transform chain.
  // `useSpring` wraps the live MotionValue output of `useTransform`.
  const outerScale = useSpring(useTransform(norm, [0, 1], [1.0, 1.85]), SPRING_OUTER);
  const outerOpac  = useSpring(useTransform(norm, [0, 1], [0.12, 0.65]), SPRING_OUTER);
  const bodyScale  = useSpring(useTransform(norm, [0, 1], [1.0, 1.45]),  SPRING_BODY);
  const coreScale  = useSpring(useTransform(norm, [0, 1], [1.0, 1.26]),  SPRING_CORE);
  const coreOpac   = useSpring(useTransform(norm, [0, 1], [0.55, 1.0]),  SPRING_CORE);

  const blurPx = Math.round(size * 0.22);

  return (
    <div
      className={`relative flex items-center justify-center select-none${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      aria-label="Biofeedback pacer"
      role="img"
    >
      {/* ── 1. Ambient glow halo — slowest spring, widest spread ─────────── */}
      <motion.div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width:   size * 1.55,
          height:  size * 1.55,
          scale:   outerScale,
          opacity: outerOpac,
          background: 'radial-gradient(circle, #3b82f6 0%, #1d4ed8 38%, transparent 68%)',
          filter:  `blur(${blurPx}px)`,
          willChange: 'transform, opacity',
        }}
      />

      {/* ── 2. VAD pulse ring — animates only during active speech ───────── */}
      <motion.div
        aria-hidden
        className="absolute rounded-full border border-cyan-400/50 pointer-events-none"
        style={{ width: size * 1.08, height: size * 1.08, willChange: 'transform, opacity' }}
        animate={
          pipeline.isVoiceActive
            ? { opacity: [0, 0.75, 0], scale: [0.94, 1.14, 0.94] }
            : { opacity: 0, scale: 1 }
        }
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
      />

      {/* ── 3. Orb body — medium-tension spring, radial gradient ─────────── */}
      <motion.div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width:  size,
          height: size,
          scale:  bodyScale,
          background: 'radial-gradient(circle at 38% 32%, #93c5fd 0%, #3b82f6 22%, #2563eb 45%, #1e3a8a 68%, #0f172a 100%)',
          boxShadow: [
            `0 0 ${size * 0.18}px rgba(59,130,246,0.45)`,
            `0 0 ${size * 0.06}px rgba(147,197,253,0.25)`,
            'inset 0 1px 0 rgba(255,255,255,0.13)',
          ].join(', '),
          willChange: 'transform',
        }}
      />

      {/* ── 4. Gloss specular — static position, follows body scale ─────── */}
      <motion.div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          width:  size * 0.46,
          height: size * 0.28,
          top:    size * 0.13,
          left:   size * 0.19,
          scale:  bodyScale,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.20) 0%, transparent 75%)',
          filter: 'blur(3px)',
          willChange: 'transform',
        }}
      />

      {/* ── 5. Inner core — fastest spring, snappy transient response ────── */}
      <motion.div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width:   size * 0.30,
          height:  size * 0.30,
          scale:   coreScale,
          opacity: coreOpac,
          background: 'radial-gradient(circle, rgba(224,242,254,0.97) 0%, rgba(96,165,250,0.65) 48%, transparent 100%)',
          willChange: 'transform, opacity',
        }}
      />

      {/* ── 6. Idle breathing ring — visible only while recording ─────────── */}
      {pipeline.isRecording && (
        <motion.div
          aria-hidden
          className="absolute rounded-full border border-blue-400/15 pointer-events-none"
          style={{ width: size * 0.88, height: size * 0.88 }}
          animate={{ scale: [1, 1.045, 1], opacity: [0.22, 0.42, 0.22] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}
