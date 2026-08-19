/**
 * Disfluency detection types — shared across the rule engine, model inference
 * (future), and UI consumers.
 *
 * The rule-based detector covers BLOCK, PROLONG, REP_START, and REP_END
 * acoustically. INTERJ requires transcription and is reserved for the
 * ML model (flowen-asr-v1.x).
 */

export type DisfluencyEventType =
  | 'BLOCK'      // Pre-vocalic silence ≥ 200 ms → hard block onset
  | 'PROLONG'    // Voiced segment > speaker baseline + 2.1 σ
  | 'REP_START'  // Start of acoustically repeated segment pair
  | 'REP_END'    // End of repeated segment pair
  | 'INTERJ';    // Filler (um/uh/er) — requires ASR model, not emitted by rule engine

/** A single detected disfluency event. */
export interface DisfluencyEvent {
  /** Unique ID (incrementing counter) */
  id: number;
  type: DisfluencyEventType;
  /** Session-relative onset in milliseconds */
  onset_ms: number;
  /** Duration of the detected phenomenon in milliseconds */
  duration_ms: number;
  /** Confidence in [0, 1]. Rule engine values are calibrated to 0.65–0.95. */
  confidence: number;
  /** Which detector produced this event */
  source: 'rule-based' | 'model';
}

/** An ended voiced speech segment, used for baseline calibration and rep detection. */
export interface VoicedSegment {
  onset_ms: number;
  duration_ms: number;
  /** Per-frame RMS values during the segment (raw, before downsampling) */
  rmsValues: number[];
  peakRms: number;
}

/** Speaker baseline statistics at a point in time. */
export interface SpeakerBaseline {
  /** Number of completed voiced segments observed */
  segmentCount: number;
  /** Mean voiced segment duration in ms */
  mean: number;
  /** Standard deviation of voiced segment duration in ms */
  stddev: number;
  /** True once segmentCount ≥ MIN_BASELINE_SEGMENTS */
  isCalibrated: boolean;
}
