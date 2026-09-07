import { describe, it, expect } from 'vitest';
import { RuleEngine } from './RuleEngine';
import type { DisfluencyEvent } from './types';

// RMS levels: RuleEngine's SILENCE_RMS is 0.006. These are comfortably on
// either side of that boundary.
const SILENT_RMS = 0.001;
const VOICED_RMS = 0.5;

// Must match RuleEngine's internal (unexported) HYSTERESIS_FRAMES — the
// engine's own header comment documents this as 5 (50ms).
const HYSTERESIS_FRAMES = 5;

function feedSilence(engine: RuleEngine, ms: number): DisfluencyEvent[] {
  const events: DisfluencyEvent[] = [];
  for (let i = 0; i < ms / 10; i++) events.push(...engine.processFrame(SILENT_RMS));
  return events;
}

function feedVoiced(engine: RuleEngine, ms: number): DisfluencyEvent[] {
  const events: DisfluencyEvent[] = [];
  for (let i = 0; i < ms / 10; i++) events.push(...engine.processFrame(VOICED_RMS));
  return events;
}

/** Ends a voiced segment cleanly (past the hysteresis window) without
 * accumulating enough silence to also trigger a BLOCK on the next onset. */
function closeSegment(engine: RuleEngine): DisfluencyEvent[] {
  return feedSilence(engine, HYSTERESIS_FRAMES * 10);
}

/** One full onset→voiced→close cycle, with a short gap after. Returns every
 * event produced across the whole segment (onset BLOCK check + closing
 * PROLONG/REP checks). */
function speakSegment(engine: RuleEngine, durationMs: number, gapAfterMs = 50): DisfluencyEvent[] {
  const events: DisfluencyEvent[] = [];
  events.push(...feedVoiced(engine, durationMs));
  events.push(...closeSegment(engine));
  events.push(...feedSilence(engine, gapAfterMs));
  return events;
}

describe('RuleEngine — BLOCK detection', () => {
  it('flags a hard block after >=200ms of pre-vocalic silence', () => {
    const engine = new RuleEngine();
    feedSilence(engine, 250);
    const events = feedVoiced(engine, 10);
    const blocks = events.filter(e => e.type === 'BLOCK');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].duration_ms).toBe(250);
    expect(blocks[0].confidence).toBeGreaterThanOrEqual(0.70);
    expect(blocks[0].confidence).toBeLessThanOrEqual(0.95);
    expect(blocks[0].source).toBe('rule-based');
  });

  it('does not flag a block for silence under the 200ms threshold', () => {
    const engine = new RuleEngine();
    feedSilence(engine, 150);
    const events = feedVoiced(engine, 10);
    expect(events.filter(e => e.type === 'BLOCK')).toHaveLength(0);
  });

  it('scales confidence up with longer silence, capped at 0.95', () => {
    const short = new RuleEngine();
    feedSilence(short, 210);
    const shortBlock = feedVoiced(short, 10).find(e => e.type === 'BLOCK')!;

    const long = new RuleEngine();
    feedSilence(long, 900);
    const longBlock = feedVoiced(long, 10).find(e => e.type === 'BLOCK')!;

    expect(longBlock.confidence).toBeGreaterThan(shortBlock.confidence);
    expect(longBlock.confidence).toBeLessThanOrEqual(0.95);
  });

  it('does not flag a block at the very start of a session', () => {
    // frame=0, silenceStart=0 — silenceDuration is 0 regardless of state.
    const engine = new RuleEngine();
    const events = feedVoiced(engine, 10);
    expect(events.filter(e => e.type === 'BLOCK')).toHaveLength(0);
  });
});

describe('RuleEngine — hysteresis (micro-gap absorption)', () => {
  it('does not close a segment for a silent gap shorter than the hysteresis window', () => {
    const engine = new RuleEngine();
    feedVoiced(engine, 100);
    feedSilence(engine, (HYSTERESIS_FRAMES - 2) * 10); // shorter than the window
    feedVoiced(engine, 100); // resumes — should be treated as continued speech

    expect(engine.speakerBaseline.segmentCount).toBe(0); // segment never actually closed yet

    closeSegment(engine);
    expect(engine.speakerBaseline.segmentCount).toBe(1); // now closes as ONE segment
  });

  it('closes the segment once silence reaches the hysteresis window', () => {
    const engine = new RuleEngine();
    feedVoiced(engine, 100);
    closeSegment(engine);
    expect(engine.speakerBaseline.segmentCount).toBe(1);
  });
});

describe('RuleEngine — PROLONG detection', () => {
  it('flags a segment that is far longer than the calibrated speaker baseline', () => {
    const engine = new RuleEngine();
    // Build a calibrated baseline (needs >= 8 segments >= 60ms) with some
    // natural spread, not identical durations — identical durations give a
    // stddev of 0 and make the z-score check nearly meaningless.
    const baselineDurations = [190, 205, 195, 210, 200, 195, 205, 200];
    for (const d of baselineDurations) speakSegment(engine, d);

    expect(engine.speakerBaseline.isCalibrated).toBe(true);

    const events = speakSegment(engine, 500); // far beyond baseline mean (~200ms)
    const prolongs = events.filter(e => e.type === 'PROLONG');
    expect(prolongs).toHaveLength(1);
    // 490, not 500: the engine measures duration as (endFrame - startFrame),
    // a frame-index delta rather than a frame count, so it's consistently
    // one 10ms frame short of the nominal fed duration — a fencepost
    // characteristic of the engine, not a rounding bug in this test.
    expect(prolongs[0].duration_ms).toBe(490);
    expect(prolongs[0].confidence).toBeGreaterThanOrEqual(0.70);
    expect(prolongs[0].confidence).toBeLessThanOrEqual(0.95);
  });

  it('does not flag PROLONG before the baseline is calibrated', () => {
    const engine = new RuleEngine();
    // Only 3 segments — below MIN_BASELINE_SEGMENTS (8).
    for (const d of [200, 200, 200]) speakSegment(engine, d);

    expect(engine.speakerBaseline.isCalibrated).toBe(false);

    const events = speakSegment(engine, 900); // would clearly be an outlier once calibrated
    expect(events.filter(e => e.type === 'PROLONG')).toHaveLength(0);
  });

  it('does not flag a segment within normal range of the baseline', () => {
    const engine = new RuleEngine();
    const baselineDurations = [190, 205, 195, 210, 200, 195, 205, 200];
    for (const d of baselineDurations) speakSegment(engine, d);

    const events = speakSegment(engine, 202); // essentially at the mean
    expect(events.filter(e => e.type === 'PROLONG')).toHaveLength(0);
  });
});

describe('RuleEngine — repetition (REP_START / REP_END) detection', () => {
  it('flags two acoustically similar segments within the time window as a repetition', () => {
    const engine = new RuleEngine();
    speakSegment(engine, 150, 100); // first "word"
    const events = speakSegment(engine, 160, 100); // near-identical duration, soon after

    const repStarts = events.filter(e => e.type === 'REP_START');
    const repEnds   = events.filter(e => e.type === 'REP_END');
    expect(repStarts).toHaveLength(1);
    expect(repEnds).toHaveLength(1);
    // -10ms vs. the fed duration for the same fencepost reason as the
    // PROLONG test above (duration is a frame-index delta).
    expect(repStarts[0].duration_ms).toBe(140);
    expect(repEnds[0].duration_ms).toBe(150);
  });

  it('does not flag two segments with very different durations', () => {
    const engine = new RuleEngine();
    speakSegment(engine, 100, 100);
    const events = speakSegment(engine, 1500, 100); // far outside the similarity ratio

    expect(events.filter(e => e.type === 'REP_START')).toHaveLength(0);
    expect(events.filter(e => e.type === 'REP_END')).toHaveLength(0);
  });

  it('does not flag segments separated by more than the repetition gap window', () => {
    const engine = new RuleEngine();
    speakSegment(engine, 150, 2200); // gap alone exceeds REP_MAX_GAP_MS (2000ms)
    const events = speakSegment(engine, 155, 100);

    expect(events.filter(e => e.type === 'REP_START')).toHaveLength(0);
    expect(events.filter(e => e.type === 'REP_END')).toHaveLength(0);
  });
});

describe('RuleEngine — reset', () => {
  it('clears the speaker baseline and internal state', () => {
    const engine = new RuleEngine();
    for (const d of [190, 205, 195, 210, 200, 195, 205, 200]) speakSegment(engine, d);
    expect(engine.speakerBaseline.isCalibrated).toBe(true);

    engine.reset();

    expect(engine.speakerBaseline.segmentCount).toBe(0);
    expect(engine.speakerBaseline.isCalibrated).toBe(false);

    // A fresh block should behave exactly as it would for a brand-new engine.
    feedSilence(engine, 250);
    const events = feedVoiced(engine, 10);
    expect(events.filter(e => e.type === 'BLOCK')).toHaveLength(1);
  });
});
