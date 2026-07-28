'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { UseAudioPipelineReturn } from '@/lib/hooks/useAudioPipeline';

// dB scale tick marks rendered on the label gutter
const DB_TICKS = [0, -3, -6, -10, -20, -40, -60] as const;

// Gradient runs bottom→top. scaleY (origin: bottom) reveals more as level rises.
// Color zones: cyan (noise floor) → lime (nominal) → amber (hot) → red (clip)
const FILL_GRADIENT =
  'linear-gradient(to top, #22d3ee 0%, #34d399 18%, #a3e635 38%, #fbbf24 62%, #f97316 80%, #ef4444 100%)';

const SPRING_FILL = { stiffness: 220, damping: 22, mass: 0.7 } as const;
const SPRING_PEAK = { stiffness: 80,  damping: 30, mass: 1.0 } as const;

const PEAK_HOLD_MS  = 1500;  // ms before peak starts decaying
const PEAK_DECAY_DB = 26;    // dB per second decay rate

function rmsToDb(rms: number): number {
  if (rms <= 0) return -60;
  return Math.max(-60, Math.min(0, 20 * Math.log10(rms)));
}

function dbToFill(db: number): number {
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

export interface VolumeMeterProps {
  pipeline: UseAudioPipelineReturn;
  height?: number;
  showLabels?: boolean;
  className?: string;
}

export function VolumeMeter({
  pipeline,
  height = 240,
  showLabels = true,
  className,
}: VolumeMeterProps) {
  // Motion values updated directly from the audio frame callback —
  // no React state, no re-renders on the hot path.
  const fillMV = useMotionValue(0);
  const peakMV = useMotionValue(0);

  const fillSpring = useSpring(fillMV, SPRING_FILL);
  const peakSpring = useSpring(peakMV, SPRING_PEAK);

  // Peak hold state lives in refs so the frame callback closure is stable.
  const peakDbRef      = useRef(-60);
  const holdStartRef   = useRef(0);
  const inHoldRef      = useRef(false);
  const lastFrameRef   = useRef(0);

  useEffect(() => {
    peakDbRef.current    = -60;
    holdStartRef.current = 0;
    inHoldRef.current    = false;
    lastFrameRef.current = 0;

    return pipeline.onFrame((_, rms) => {
      const db  = rmsToDb(rms);
      const now = performance.now();
      const dt  = lastFrameRef.current ? (now - lastFrameRef.current) / 1000 : 0;
      lastFrameRef.current = now;

      fillMV.set(dbToFill(db));

      // Peak hold & decay algorithm
      if (db >= peakDbRef.current) {
        peakDbRef.current    = db;
        holdStartRef.current = now;
        inHoldRef.current    = true;
      } else {
        if (inHoldRef.current && now - holdStartRef.current > PEAK_HOLD_MS) {
          inHoldRef.current = false;
        }
        if (!inHoldRef.current) {
          peakDbRef.current = Math.max(db, peakDbRef.current - PEAK_DECAY_DB * dt);
        }
      }
      peakMV.set(dbToFill(peakDbRef.current));
    });
  }, [pipeline, fillMV, peakMV]);

  // Peak indicator vertical position: 0 fill (silence) → 0px offset,
  // 1.0 fill (0 dB) → -height offset. Anchor is bottom: 0.
  const peakY = useTransform(peakSpring, [0, 1], [0, -height]);

  const barW   = 20;
  const totalW = showLabels ? barW + 36 : barW;

  return (
    <div
      className={`relative flex gap-2 items-stretch${className ? ` ${className}` : ''}`}
      style={{ width: totalW, height }}
      aria-label={`Volume meter, ${Math.round(rmsToDb(pipeline.rms))} dB`}
      role="meter"
      aria-valuenow={Math.round(pipeline.decibelLevel)}
      aria-valuemin={-60}
      aria-valuemax={0}
    >
      {/* ── Meter track ─────────────────────────────────────────────────── */}
      <div
        className="relative flex-shrink-0 rounded overflow-hidden bg-slate-800/80 ring-1 ring-white/5"
        style={{ width: barW, height }}
      >
        {/* Fill bar — scaleY from bottom; GPU-only transform, no layout triggers */}
        <motion.div
          aria-hidden
          className="absolute inset-x-0 bottom-0 origin-bottom rounded"
          style={{
            height:     '100%',
            background: FILL_GRADIENT,
            scaleY:     fillSpring,
            willChange: 'transform',
          }}
        />

        {/* Threshold grid lines at key dB levels */}
        {DB_TICKS.slice(1).map(db => (
          <div
            key={db}
            aria-hidden
            className="absolute inset-x-0 h-px bg-black/30"
            style={{ bottom: `${dbToFill(db) * 100}%` }}
          />
        ))}

        {/* Peak hold indicator line */}
        <motion.div
          aria-hidden
          className="absolute inset-x-0 h-0.5 bg-white/85 rounded-full"
          style={{ bottom: 0, y: peakY, willChange: 'transform' }}
        />

        {/* Clip indicator — flashes red at 0 dB */}
        {pipeline.decibelLevel >= -1 && (
          <motion.div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1 bg-red-500 rounded-sm"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.2, repeat: Infinity }}
          />
        )}
      </div>

      {/* ── dB scale labels ─────────────────────────────────────────────── */}
      {showLabels && (
        <div
          aria-hidden
          className="relative flex-shrink-0"
          style={{ height }}
        >
          {DB_TICKS.map(db => (
            <span
              key={db}
              className="absolute right-0 text-[9px] leading-none text-slate-500 tabular-nums -translate-y-1/2"
              style={{ bottom: `${dbToFill(db) * 100}%` }}
            >
              {db}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
