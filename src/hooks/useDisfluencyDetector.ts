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
import { RuleEngine }                              from '@/lib/disfluency/RuleEngine';
import type { DisfluencyEvent, SpeakerBaseline }  from '@/lib/disfluency/types';
import type { UseAudioPipelineReturn }             from '@/lib/hooks/useAudioPipeline';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MIN_CONFIDENCE = 0.65;
const MAX_EVENT_HISTORY      = 30;  // keep last 30 events in state

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
  /** Wipe all events and reset the speaker baseline. */
  resetSession: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDisfluencyDetector(
  pipeline: UseAudioPipelineReturn,
  opts: UseDisfluencyDetectorOptions = {},
): UseDisfluencyDetectorReturn {
  const { onEvent, minConfidence = DEFAULT_MIN_CONFIDENCE } = opts;

  const engineRef   = useRef<RuleEngine>(new RuleEngine());
  const onEventRef  = useRef(onEvent);
  onEventRef.current = onEvent; // keep ref fresh without triggering re-subscribe

  const [events, setEvents]   = useState<DisfluencyEvent[]>([]);
  const [baseline, setBaseline] = useState<SpeakerBaseline>({
    segmentCount: 0, mean: 0, stddev: 0, isCalibrated: false,
  });

  // Subscribe to audio frames
  useEffect(() => {
    const engine = engineRef.current;

    const unsubscribe = pipeline.onFrame((_frame, rms) => {
      const newEvents = engine.processFrame(rms);

      // Filter by confidence and emit accepted events
      for (const ev of newEvents) {
        if (ev.confidence < minConfidence) continue;

        onEventRef.current?.(ev);

        setEvents(prev => {
          const next = [...prev, ev];
          return next.length > MAX_EVENT_HISTORY ? next.slice(-MAX_EVENT_HISTORY) : next;
        });
      }

      // Periodically sync baseline into React state (every ~20 frames = 200ms)
      // We use the engine's internal frame count via a closure counter
      frameCount.current++;
      if (frameCount.current % 20 === 0) {
        setBaseline({ ...engine.speakerBaseline });
      }
    });

    return unsubscribe;
  // minConfidence: re-subscribe if the threshold changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline, minConfidence]);

  // Separate ref for the per-subscription frame counter (avoids closure issues)
  const frameCount = useRef(0);

  const resetSession = useCallback(() => {
    engineRef.current.reset();
    setEvents([]);
    setBaseline({ segmentCount: 0, mean: 0, stddev: 0, isCalibrated: false });
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
    resetSession,
  };
}
