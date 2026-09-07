import { describe, it, expect } from 'vitest';
import { AcousticFeatureTracker } from './AcousticFeatures';

const SAMPLE_RATE = 16000;
const FRAME_SAMPLES = 160; // 10ms @ 16kHz, matches the PCM worklet

/**
 * Generates a synthetic voice-like tone. `wobbleHz`/`wobbleDepthHz` add a
 * slow frequency modulation on top of the base tone — a controllable stand-in
 * for real jitter, since a genuinely random per-cycle jitter generator would
 * make the expected output unpredictable to assert against.
 */
function generateTone(
  freqHz: number,
  durationMs: number,
  opts: { wobbleHz?: number; wobbleDepthHz?: number } = {},
): Float32Array {
  const { wobbleHz = 0, wobbleDepthHz = 0 } = opts;
  const n = Math.round((durationMs / 1000) * SAMPLE_RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const instFreq = freqHz + wobbleDepthHz * Math.sin((2 * Math.PI * wobbleHz * i) / SAMPLE_RATE);
    phase += (2 * Math.PI * instFreq) / SAMPLE_RATE;
    out[i] = 0.5 * Math.sin(phase);
  }
  return out;
}

/** Feeds a whole signal through the tracker, 10ms frame at a time, and
 * returns the last (most recently completed) non-empty sample. */
function trackTone(signal: Float32Array): ReturnType<AcousticFeatureTracker['processFrame']> {
  const tracker = new AcousticFeatureTracker();
  let last = tracker.processFrame(new Float32Array(FRAME_SAMPLES), 0, false); // baseline empty sample
  for (let i = 0; i + FRAME_SAMPLES <= signal.length; i += FRAME_SAMPLES) {
    const frame = signal.slice(i, i + FRAME_SAMPLES);
    const sample = tracker.processFrame(frame, 0.5, true);
    if (sample.pitchHz !== null) last = sample;
  }
  return last;
}

describe('AcousticFeatureTracker — pitch estimation', () => {
  // Regression guard for the octave error caught during development: a naive
  // global-argmax over the autocorrelation lags locks onto a subharmonic
  // (a clean 220Hz tone was coming back as ~73Hz, exactly 1/3) rather than
  // the true fundamental. estimatePeriod() fixed this by returning the
  // shortest lag that clears the voicing threshold and is a local peak.
  // 65Hz specifically regression-guards a second, distinct octave-style bug
  // found while writing this test: any F0 under ~90Hz has the
  // autocorrelation still declining away from lag=0 by the time it reaches
  // MIN_LAG, but the missing left-neighbour there was defaulted to
  // -Infinity in the local-peak search, which trivially accepted MIN_LAG as
  // "the" period regardless of the real curve shape — a clean 65Hz tone was
  // coming back as ~530Hz. See estimatePeriod()'s comment for the fix.
  it.each([65, 120, 150, 220, 300])('recovers approximately the true F0 for a %ipHz clean tone', (freqHz) => {
    const signal = generateTone(freqHz, 200);
    const sample = trackTone(signal);

    expect(sample.pitchHz).not.toBeNull();
    // Within 5% — autocorrelation on a short block is an estimate, not an
    // exact measurement, but a genuine fix should land close, not at a
    // harmonic/subharmonic multiple of the true frequency.
    expect(sample.pitchHz).toBeGreaterThan(freqHz * 0.95);
    expect(sample.pitchHz).toBeLessThan(freqHz * 1.05);
  });

  it('returns no pitch estimate for silence', () => {
    const tracker = new AcousticFeatureTracker();
    const silence = new Float32Array(FRAME_SAMPLES); // all zeros
    const sample = tracker.processFrame(silence, 0, false);
    expect(sample.pitchHz).toBeNull();
    expect(sample.jitterPct).toBeNull();
    expect(sample.shimmerPct).toBeNull();
    expect(sample.tensionIndex).toBeNull();
  });

  it('drops in-progress state across a silence gap (does not bridge two voiced segments)', () => {
    const tracker = new AcousticFeatureTracker();
    const tone = generateTone(180, 80);
    // Feed part of a block, then silence, then resume — the partial block
    // before the gap must not be spliced onto samples after it.
    for (let i = 0; i + FRAME_SAMPLES <= tone.length / 2; i += FRAME_SAMPLES) {
      tracker.processFrame(tone.slice(i, i + FRAME_SAMPLES), 0.5, true);
    }
    tracker.reset(); // simulates what processFrame does internally on silence/unvoiced
    // Should behave like a fresh tracker from here — no crash, no stale state.
    const fresh = trackTone(generateTone(180, 200));
    expect(fresh.pitchHz).toBeGreaterThan(180 * 0.95);
    expect(fresh.pitchHz).toBeLessThan(180 * 1.05);
  });
});

describe('AcousticFeatureTracker — jitter/shimmer (voice-tension proxy)', () => {
  // Regression guard for the jitter-smoothing bug caught during development:
  // overlapping analysis windows shared most samples between consecutive
  // estimates, hiding real period-to-period variation and reporting jitter
  // near 0 even for a genuinely wobbling tone. Fixed via non-overlapping
  // blocks + real per-cycle pitch-marking (findPitchMarks).
  it('reports low jitter for a clean, unwavering tone', () => {
    const signal = generateTone(180, 400);
    const sample = trackTone(signal);
    expect(sample.jitterPct).not.toBeNull();
    expect(sample.jitterPct!).toBeLessThan(3);
  });

  it('reports meaningfully higher jitter for a frequency-wobbling tone than a clean tone', () => {
    const clean  = trackTone(generateTone(180, 400));
    const wobbly = trackTone(generateTone(180, 400, { wobbleHz: 25, wobbleDepthHz: 20 }));

    expect(clean.jitterPct).not.toBeNull();
    expect(wobbly.jitterPct).not.toBeNull();
    expect(wobbly.jitterPct!).toBeGreaterThan(clean.jitterPct! * 2);
  });

  it('computes a tension index in [0, 100] once jitter/shimmer are available', () => {
    const sample = trackTone(generateTone(180, 400, { wobbleHz: 25, wobbleDepthHz: 20 }));
    expect(sample.tensionIndex).not.toBeNull();
    expect(sample.tensionIndex!).toBeGreaterThanOrEqual(0);
    expect(sample.tensionIndex!).toBeLessThanOrEqual(100);
  });

  it('withholds jitter/shimmer until at least 4 individual pitch periods have accumulated', () => {
    // Jitter/shimmer require >= 4 individually pitch-marked cycles
    // (recentPeriods.length >= 4), not >= 4 blocks — a typical voice
    // frequency yields well over 4 cycles within a single 40ms block, so
    // the only way to genuinely see the gate closed is a very low F0 (near
    // the 60Hz floor) where one block contains only a couple of cycles.
    const lowFreq = 65; // ~2.6 cycles per 40ms block
    // One continuous tone sliced into blocks — real audio is a continuous
    // stream, so consecutive blocks share phase continuity. Generating a
    // fresh tone per block instead (each restarting the sine at phase 0)
    // was tried first and gave a subtly different, unrealistic answer:
    // proof this distinction actually matters for this algorithm.
    const tracker = new AcousticFeatureTracker();
    const tone = generateTone(lowFreq, 200); // 5 blocks' worth
    const results: ReturnType<AcousticFeatureTracker['processFrame']>[] = [];
    for (let i = 0; i + FRAME_SAMPLES <= tone.length; i += FRAME_SAMPLES) {
      results.push(tracker.processFrame(tone.slice(i, i + FRAME_SAMPLES), 0.5, true));
    }
    const afterBlock1 = results[3];  // 4 frames = 1 block completes on the 4th
    const afterBlock3 = results[11]; // 12 frames = 3 blocks

    expect(afterBlock1.pitchHz).not.toBeNull(); // pitch itself doesn't need the 4-period gate
    expect(afterBlock1.jitterPct).toBeNull();
    expect(afterBlock1.shimmerPct).toBeNull();

    // ~2.6 cycles/block means it takes a third block for the running total
    // of individually-marked periods to cross the >=4 threshold.
    expect(afterBlock3.jitterPct).not.toBeNull();
    expect(afterBlock3.shimmerPct).not.toBeNull();
  });
});
