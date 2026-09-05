'use client';

/**
 * useDisfluencyDetector — React hook wiring the acoustic rule engine to live
 * microphone audio via useAudioPipeline.
 *
 * Usage
 * ─────
 *   const pipeline = useAudioPipeline();
 *   const detector = useDisfluencyDetector(pipeline, {
 *     onEvent: (e) => console.log('Detected:', e.type, e.confidence),
 *     minConfidence: 0.70,
 *   });
 *
 *   // Start both at once
 *   await pipeline.start();
 *
 * The detector automatically subscribes to frames once mounted and
 * unsubscribes on unmount. Calling pipeline.stop() pauses detection
 * (the engine retains its baseline — resume with pipeline.start()).
 *
 * Call detector.resetSession() to wipe the speaker baseline and event
 * log (e.g., between practice sessions).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { RuleEngine, SILENCE_RMS }                 from '@/lib/disfluency/RuleEngine';
import { AcousticFeatureTracker }                  from '@/lib/disfluency/AcousticFeatures';
import type { DisfluencyEvent, SpeakerBaseline }  from '@/lib/disfluency/types';
import type { UseAudioPipelineReturn }             from '@/lib/hooks/useAudioPipeline';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MIN_CONFIDENCE = 0.65;
const MAX_EVENT_HISTORY      = 30;  // keep last 30 events in state
// Pitch/tension change fast, but syncing every 10ms frame into React state
// would force a re-render at ~100Hz for no perceptible benefit — sync every
// FEATURE_SYNC_FRAMES frames instead (matches the cadence baseline uses).
const FEATURE_SYNC_FRAMES    = 5;   // 50ms

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseDisfluencyDetectorOptions {
  /**
   * Real-time callback fired on every accepted event.
   * Runs synchronously on the main thread — keep it fast.
   */
  onEvent?: (event: DisfluencyEvent) => void;
  /**
   * Events below this confidence are dropped. Default 0.65.
   * Set to 0 to see all rule engine output including low-confidence candidates.
   */
  minConfidence?: number;
}

export interface UseDisfluencyDetectorReturn {
  /** Accepted events in session order (newest last), max MAX_EVENT_HISTORY. */
  events: DisfluencyEvent[];
  /** Most recently accepted event, or null if none yet. */
  latestEvent: DisfluencyEvent | null;
  /** Speaker baseline at the current point in the session. */
  baseline: SpeakerBaseline;
  /** True once the baseline has seen enough voiced segments for reliable PROLONG detection. */
  isCalibrated: boolean;
  /** Counts of each event type since last reset. */
  eventCounts: Record<DisfluencyEvent['type'], number>;
  /** Real-time fundamental-frequency estimate in Hz, or null when unvoiced/unreliable. */
  pitchHz: number | null;
  /** 0–100 jitter/shimmer-based voice-tension proxy, or null until enough voiced history exists. */
  tensionIndex: number | null;
  /** Wipe all events, reset the speaker baseline, and clear pitch/tension history. */
  resetSession: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDisfluencyDetector(
  pipeline: UseAudioPipelineReturn,
  opts: UseDisfluencyDetectorOptions = {},
): UseDisfluencyDetectorReturn {
  const { onEvent, minConfidence = DEFAULT_MIN_CONFIDENCE } = opts;

  const engineRef   = useRef<RuleEngine>(new RuleEngine());
  const featuresRef = useRef<AcousticFeatureTracker>(new AcousticFeatureTracker());
  const onEventRef  = useRef(onEvent);
  // Keep ref fresh without triggering re-subscribe. Previously written directly
  // during render (react-hooks/refs flags mutating a ref outside an effect —
  // this is a real distinction under React's Compiler assumptions, not a
  // style nitpick: a ref write during render can be observed twice under
  // Strict Mode's double-invoke or a bailed-out render). One effect-cycle of
  // staleness for onEventRef is harmless here — it only affects which
  // onEvent callback the *next* audio frame sees, not audio timing itself.
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const [events, setEvents]   = useState<DisfluencyEvent[]>([]);
  const [baseline, setBaseline] = useState<SpeakerBaseline>({
    segmentCount: 0, mean: 0, stddev: 0, isCalibrated: false,
  });
  const [pitchHz, setPitchHz]           = useState<number | null>(null);
  const [tensionIndex, setTensionIndex] = useState<number | null>(null);

  // Subscribe to audio frames
  useEffect(() => {
    const engine   = engineRef.current;
    const features = featuresRef.current;

    const unsubscribe = pipeline.onFrame((frame, rms) => {
      const isVoiced = rms > SILENCE_RMS;
      const newEvents = engine.processFrame(rms);
      const sample = features.processFrame(frame, rms, isVoiced);

      // Filter by confidence and emit accepted events
      for (const ev of newEvents) {
        if (ev.confidence < minConfidence) continue;

        onEventRef.current?.(ev);

        setEvents(prev => {
          const next = [...prev, ev];
          return next.length > MAX_EVENT_HISTORY ? next.slice(-MAX_EVENT_HISTORY) : next;
        });
      }

      // Periodically sync baseline + pitch/tension into React state.
      // We use the engine's internal frame count via a closure counter
      frameCount.current++;
      if (frameCount.current % 20 === 0) {
        setBaseline({ ...engine.speakerBaseline });
      }
      if (frameCount.current % FEATURE_SYNC_FRAMES === 0) {
        setPitchHz(sample.pitchHz);
        setTensionIndex(sample.tensionIndex);
      }
    });

    return unsubscribe;
  // minConfidence: re-subscribe if the threshold changes
  }, [pipeline, minConfidence]);

  // Separate ref for the per-subscription frame counter (avoids closure issues)
  const frameCount = useRef(0);

  const resetSession = useCallback(() => {
    engineRef.current.reset();
    featuresRef.current.reset();
    setEvents([]);
    setBaseline({ segmentCount: 0, mean: 0, stddev: 0, isCalibrated: false });
    setPitchHz(null);
    setTensionIndex(null);
    // frameCount is a private bookkeeping counter (gates how often the
    // baseline syncs into state, line ~104) — it's never read for rendering,
    // so resetting it from this explicit, user-triggered action is correct.
    // react-hooks/immutability flags any mutation of a ref also written
    // inside an effect, but there's no race here: this only runs between
    // sessions, never concurrently with the frame-subscription effect above.
    // eslint-disable-next-line react-hooks/immutability
    frameCount.current = 0;
  }, []);

  // Derived: event counts per type
  const eventCounts = events.reduce(
    (acc, ev) => { acc[ev.type] = (acc[ev.type] ?? 0) + 1; return acc; },
    {} as Record<DisfluencyEvent['type'], number>,
  );

  return {
    events,
    latestEvent: events.length > 0 ? events[events.length - 1] : null,
    baseline,
    isCalibrated: baseline.isCalibrated,
    eventCounts,
    pitchHz,
    tensionIndex,
    resetSession,
  };
}
