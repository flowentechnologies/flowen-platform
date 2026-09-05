/**
 * AcousticFeatureTracker — real-time fundamental frequency (pitch) and a
 * jitter/shimmer-based voice-tension proxy, computed directly from the raw
 * 16kHz PCM frames the PCM worklet emits (the same frames RuleEngine
 * consumes for RMS-based disfluency detection).
 *
 * Pitch: normalized autocorrelation over a 40ms NON-overlapping analysis
 * block, searching lags corresponding to 60–500Hz (covers the human voice F0
 * range with margin). This is the same family of algorithm
 * (autocorrelation-based F0 estimation) used in WebRTC and most real-time
 * pitch trackers — it is not a clinical-grade tracker (no sub-harmonic
 * correction beyond first-local-peak picking, no cross-frame dynamic
 * programming like YIN/RAPT), but it is a real, working estimate computed
 * from the live signal, not a placeholder. Blocks are non-overlapping
 * (rather than a sliding window re-analysed every frame) specifically so
 * consecutive pitch estimates are independent samples — an overlapping
 * window smooths successive estimates toward each other and hides the very
 * variability jitter/shimmer are meant to measure (caught by a synthetic
 * jittered-tone test during development; see scratchpad validation).
 *
 * Jitter / shimmer: classic voice-quality perturbation measures — jitter is
 * cycle-to-cycle pitch-period variability, shimmer is cycle-to-cycle
 * amplitude variability. Computed here across consecutive 40ms blocks
 * within the current voiced stretch, which is a coarser, block-level
 * approximation of the per-glottal-cycle measures a clinical tool like
 * Praat computes — documented here so nobody mistakes this for a validated
 * clinical instrument. Elevated jitter+shimmer is a well-established
 * correlate of vocal strain/tension in the voice-quality literature;
 * combined into a single 0–100 "tension index" as a proxy, not a diagnosis.
 */

const SAMPLE_RATE     = 16000;   // matches the PCM worklet's TARGET_RATE
const BLOCK_SAMPLES   = 640;     // 40ms non-overlapping analysis block
const MIN_F0_HZ       = 60;
const MAX_F0_HZ       = 500;
const MIN_LAG         = Math.floor(SAMPLE_RATE / MAX_F0_HZ); // 32 samples
const MAX_LAG         = Math.ceil(SAMPLE_RATE / MIN_F0_HZ);  // 267 samples

/** Normalized autocorrelation peak required before a pitch estimate is trusted. */
const VOICING_THRESHOLD = 0.4;
/** Below this RMS, the signal is too quiet to yield a reliable estimate. */
const MIN_RMS_FOR_PITCH = 0.01;

/** Consecutive voiced blocks averaged into one jitter/shimmer estimate. */
const JITTER_SHIMMER_WINDOW = 8;
/** ~typical relaxed-voice jitter (local), % — reference point for the 0–100 scale. */
const JITTER_REFERENCE_PCT  = 1.0;
/** ~typical relaxed-voice shimmer (local), % — reference point for the 0–100 scale. */
const SHIMMER_REFERENCE_PCT = 3.0;

export interface AcousticFeatureSample {
  /** Estimated fundamental frequency in Hz, or null when unvoiced/unreliable. */
  pitchHz: number | null;
  /** Cycle-to-cycle pitch-period variability, % (block-level approximation). */
  jitterPct: number | null;
  /** Cycle-to-cycle amplitude variability, % (block-level approximation). */
  shimmerPct: number | null;
  /** 0–100 jitter/shimmer composite — a proxy for vocal tension, not a diagnosis. */
  tensionIndex: number | null;
}

const EMPTY_SAMPLE: AcousticFeatureSample = {
  pitchHz: null, jitterPct: null, shimmerPct: null, tensionIndex: null,
};

export class AcousticFeatureTracker {
  // Accumulates incoming samples toward the next non-overlapping analysis
  // block. A plain number[] rather than a fixed typed array — BLOCK_SAMPLES
  // is small (640) and this only fills every ~4 frames, so the simplicity
  // is worth more than the (negligible) allocation cost.
  private block: number[] = [];

  private recentPeriods: number[] = []; // lag in samples, most recent last
  private recentAmps: number[] = [];    // per-block RMS, most recent last
  private lastSample: AcousticFeatureSample = EMPTY_SAMPLE;

  /** Feed one 10ms frame (160 samples @16kHz). Call every frame, voiced or not. */
  processFrame(frame: Float32Array, rms: number, isVoiced: boolean): AcousticFeatureSample {
    if (!isVoiced || rms < MIN_RMS_FOR_PITCH) {
      // Silence/unvoiced breaks period continuity — drop the in-progress
      // block and history so an estimate never bridges two unrelated
      // voiced segments (e.g. across a pause between words).
      this.block = [];
      this.recentPeriods = [];
      this.recentAmps = [];
      this.lastSample = EMPTY_SAMPLE;
      return this.lastSample;
    }

    for (let i = 0; i < frame.length; i++) this.block.push(frame[i]);
    if (this.block.length < BLOCK_SAMPLES) {
      return this.lastSample; // block still filling — report the last completed estimate
    }

    const samples = Float32Array.from(this.block.slice(0, BLOCK_SAMPLES));
    this.block = this.block.slice(BLOCK_SAMPLES); // carry over any excess past the block boundary

    const lag = estimatePeriod(samples);
    if (lag == null) {
      this.recentPeriods = [];
      this.recentAmps = [];
      this.lastSample = EMPTY_SAMPLE;
      return this.lastSample;
    }

    // Pitch marking: locate the actual glottal-cycle boundaries within this
    // block using `lag` as the expected period, rather than treating the
    // whole 40ms block as one jitter/shimmer sample. A block-average period
    // (one number per 40ms) is far too coarse to show real cycle-to-cycle
    // perturbation — a synthetic-signal test during development confirmed
    // it washes genuine jitter out to ~0. Individual periods within a
    // 150Hz voice's 40ms block run ~6 cycles, giving several real
    // consecutive-period samples per block instead of one smoothed average.
    const { periods, amps } = findPitchMarks(samples, lag);
    for (let i = 0; i < periods.length; i++) {
      this.recentPeriods.push(periods[i]);
      this.recentAmps.push(amps[i]);
    }
    const pitchHz = periods.length > 0
      ? SAMPLE_RATE / (periods.reduce((a, b) => a + b, 0) / periods.length)
      : SAMPLE_RATE / lag;
    while (this.recentPeriods.length > JITTER_SHIMMER_WINDOW) this.recentPeriods.shift();
    while (this.recentAmps.length > JITTER_SHIMMER_WINDOW) this.recentAmps.shift();

    let jitterPct: number | null = null;
    let shimmerPct: number | null = null;
    let tensionIndex: number | null = null;

    if (this.recentPeriods.length >= 4) {
      jitterPct  = relativeMeanAbsDiffPct(this.recentPeriods);
      shimmerPct = relativeMeanAbsDiffPct(this.recentAmps);
      tensionIndex = Math.max(0, Math.min(100,
        50 * (jitterPct / JITTER_REFERENCE_PCT) + 50 * (shimmerPct / SHIMMER_REFERENCE_PCT),
      ));
    }

    this.lastSample = { pitchHz, jitterPct, shimmerPct, tensionIndex };
    return this.lastSample;
  }

  reset(): void {
    this.block = [];
    this.recentPeriods = [];
    this.recentAmps = [];
    this.lastSample = EMPTY_SAMPLE;
  }
}

/**
 * Normalized-autocorrelation pitch-period search over one analysis block.
 *
 * Deliberately does NOT just take the global argmax over the lag range: for
 * any periodic signal, every integer multiple of the true period also
 * scores near-maximal (a pure tone's autocorrelation at 2x/3x its real
 * period is ~as high as at the true period), so a naive global-max search
 * locks onto a subharmonic just as often as the real F0 — an "octave
 * error", the textbook failure mode of simple autocorrelation trackers
 * (caught during development: a clean 220Hz test tone was coming back as
 * ~73Hz, exactly 1/3). Instead this returns the SMALLEST lag that both
 * clears the voicing threshold and is a local peak — the true fundamental
 * is always the shortest such period; any subharmonic peak sits at a
 * longer lag.
 */
function estimatePeriod(buf: Float32Array): number | null {
  const N = buf.length;
  const scores = new Float32Array(MAX_LAG - MIN_LAG + 1);

  for (let lag = MIN_LAG; lag <= MAX_LAG; lag++) {
    let cross = 0, energyA = 0, energyB = 0;
    const len = N - lag;
    for (let i = 0; i < len; i++) {
      const a = buf[i];
      const b = buf[i + lag];
      cross   += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    const denom = Math.sqrt(energyA * energyB);
    scores[lag - MIN_LAG] = denom > 0 ? cross / denom : 0;
  }

  let bestLag = -1;
  let bestScore = 0;
  for (let lag = MIN_LAG; lag <= MAX_LAG; lag++) {
    const s = scores[lag - MIN_LAG];
    if (s < VOICING_THRESHOLD) continue;
    const prev = lag > MIN_LAG ? scores[lag - MIN_LAG - 1] : -Infinity;
    const next = lag < MAX_LAG ? scores[lag - MIN_LAG + 1] : -Infinity;
    if (s >= prev && s >= next) { bestLag = lag; bestScore = s; break; } // first local peak
  }

  // Fallback: no clean local peak found (e.g. flat/noisy scores) — use the
  // global max only if it clears the threshold, better than nothing.
  if (bestLag < 0) {
    for (let lag = MIN_LAG; lag <= MAX_LAG; lag++) {
      const s = scores[lag - MIN_LAG];
      if (s > bestScore) { bestScore = s; bestLag = lag; }
    }
    if (bestScore < VOICING_THRESHOLD) return null;
  }

  return bestLag;
}

/**
 * Locate individual pitch periods (glottal-cycle boundaries) within one
 * analysis block, given a coarse F0-derived period estimate (in samples),
 * by peak-picking within a tolerance window around each expected next
 * boundary — a standard simplified pitch-marking approach once a period
 * estimate is available. Returns period lengths (samples) and peak
 * amplitudes (signal magnitude) for each detected cycle: the basis for
 * genuine cycle-to-cycle jitter/shimmer, rather than one block-average
 * value per 40ms.
 */
function findPitchMarks(buf: Float32Array, periodGuess: number): { periods: number[]; amps: number[] } {
  const periods: number[] = [];
  const amps: number[] = [];
  const tolerance = Math.max(2, Math.round(periodGuess * 0.25));

  let prevMark = argmaxAbs(buf, 0, Math.min(periodGuess, buf.length));
  if (prevMark < 0) return { periods, amps };

  for (;;) {
    const searchStart = prevMark + periodGuess - tolerance;
    const searchEnd   = prevMark + periodGuess + tolerance;
    if (searchEnd >= buf.length) break;
    const mark = argmaxAbs(buf, Math.max(0, searchStart), Math.min(buf.length, searchEnd + 1));
    if (mark < 0) break;
    periods.push(mark - prevMark);
    amps.push(Math.abs(buf[mark]));
    prevMark = mark;
  }

  return { periods, amps };
}

function argmaxAbs(buf: Float32Array, start: number, end: number): number {
  let bestIdx = -1, bestVal = -Infinity;
  for (let i = start; i < end; i++) {
    const v = Math.abs(buf[i]);
    if (v > bestVal) { bestVal = v; bestIdx = i; }
  }
  return bestIdx;
}

/**
 * Mean absolute difference between consecutive values, relative to the mean
 * value, expressed as a percentage — the standard "jitter (local)" /
 * "shimmer (local)" formula shape used in voice-quality analysis.
 */
function relativeMeanAbsDiffPct(values: number[]): number {
  let sumAbsDiff = 0;
  for (let i = 1; i < values.length; i++) sumAbsDiff += Math.abs(values[i] - values[i - 1]);
  const meanAbsDiff = sumAbsDiff / (values.length - 1);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;
  return (meanAbsDiff / mean) * 100;
}
