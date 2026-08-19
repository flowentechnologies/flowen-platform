/**
 * RuleEngine — acoustic rule-based disfluency detector.
 *
 * Processes 10ms PCM frames (160 samples @ 16kHz) delivered by the
 * FlowenPCMProcessor AudioWorklet via useAudioPipeline.
 *
 * Detected events
 * ─────────────────────────────────────────────────────────────────────────────
 * BLOCK       Pre-vocalic silence ≥ 200 ms followed by voiced onset.
 *             Confidence scales with silence duration (0.70 → 0.95).
 *
 * PROLONG     Voiced segment whose duration exceeds the speaker's rolling
 *             baseline by ≥ 2.1 standard deviations. Requires ≥ 8 complete
 *             voiced segments before the baseline is considered calibrated.
 *
 * REP_START   First segment of an acoustically similar pair within a 2-second
 * REP_END     window. Similarity is assessed via duration ratio only (no
 *             transcription). Confidence range 0.65 – 0.80. False-positive
 *             rate is higher than BLOCK/PROLONG — ML model will replace this.
 *
 * State machine (with hysteresis to absorb micro-silences)
 * ─────────────────────────────────────────────────────────────────────────────
 *   SILENCE ──voiced──► VOICED
 *   VOICED  ──silent──► SILENCE_PENDING
 *   SILENCE_PENDING ──voiced──► VOICED        (hysteresis absorbs micro-gap)
 *   SILENCE_PENDING ──5 silent frames──► SILENCE
 */
import { WelfordStats }                   from './WelfordStats';
import type { DisfluencyEvent, VoicedSegment, SpeakerBaseline } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Frames are 10ms each (160 samples @ 16kHz). */
const FRAME_MS                 = 10;
/** RMS below this → silence (matches PCM worklet VAD_THRESHOLD + 20% margin). */
const SILENCE_RMS              = 0.006;
/** Silence frames before transitioning from SILENCE_PENDING → SILENCE. */
const HYSTERESIS_FRAMES        = 5;   // 50 ms
/** Minimum pre-vocalic silence to declare a hard block. */
const BLOCK_MIN_SILENCE_MS     = 200;
/** Voiced segments shorter than this are excluded from baseline. */
const MIN_VOICED_FOR_BASELINE  = 60;  // ms — filters out consonant bursts
/** Minimum voiced segments before prolongation detection activates. */
const MIN_BASELINE_SEGMENTS    = 8;
/** Prolongation z-score threshold (speaker-adaptive). */
const PROLONG_Z_THRESHOLD      = 2.1;
/** Repetition: max gap between similar segment pair. */
const REP_MAX_GAP_MS           = 2000;
/** Repetition: only compare segments shorter than this (long segments rarely repeat). */
const REP_MAX_SEGMENT_MS       = 1600;
/** Repetition: max duration ratio difference for similarity. */
const REP_MAX_DURATION_RATIO   = 0.4;
/** Keep at most this many past segments for repetition comparison. */
const MAX_RECENT_SEGMENTS      = 8;

type EngineState = 'silence' | 'voiced' | 'silence_pending';

export class RuleEngine {
  private state: EngineState = 'silence';
  private frame              = 0;    // total frames processed
  private silenceStart       = 0;    // frame when current silence started
  private voicedStart        = 0;    // frame when current voiced stretch started
  private silencePendingCount = 0;   // consecutive silent frames while SILENCE_PENDING
  private rmsAccum: number[] = [];   // per-frame RMS for current voiced segment

  private readonly baseline  = new WelfordStats(60);
  private recentSegs: VoicedSegment[] = [];
  private eventIdCounter     = 0;

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Feed one 10ms frame. Returns any events detected on this frame boundary.
   * @param rms  Linear RMS amplitude in [0, 1] (as emitted by the PCM worklet).
   */
  processFrame(rms: number): DisfluencyEvent[] {
    const events: DisfluencyEvent[] = [];
    const isVoiced = rms > SILENCE_RMS;

    switch (this.state) {
      case 'silence':
        if (isVoiced) {
          this.onEnterVoiced(events);
        }
        break;

      case 'voiced':
        if (!isVoiced) {
          // Enter hysteresis — don't end the segment yet
          this.state = 'silence_pending';
          this.silencePendingCount = 1;
        } else {
          this.rmsAccum.push(rms);
        }
        break;

      case 'silence_pending':
        if (isVoiced) {
          // Micro-gap — treat as continued voiced, absorb it
          this.state = 'voiced';
          this.rmsAccum.push(rms);
          this.silencePendingCount = 0;
        } else {
          this.silencePendingCount++;
          if (this.silencePendingCount >= HYSTERESIS_FRAMES) {
            // True silence transition — close the voiced segment
            this.onEnterSilence(events);
          }
        }
        break;
    }

    this.frame++;
    return events;
  }

  /** Speaker baseline at the current point in the session. */
  get speakerBaseline(): SpeakerBaseline {
    return {
      segmentCount: this.baseline.count,
      mean:         this.baseline.mean,
      stddev:       this.baseline.stddev,
      isCalibrated: this.baseline.count >= MIN_BASELINE_SEGMENTS,
    };
  }

  /** Reset all state — call at session start or when the user takes a break. */
  reset(): void {
    this.state = 'silence';
    this.frame = 0;
    this.silenceStart = 0;
    this.voicedStart  = 0;
    this.silencePendingCount = 0;
    this.rmsAccum = [];
    this.baseline.reset();
    this.recentSegs = [];
  }

  // ── Private transitions ────────────────────────────────────────────────────

  private onEnterVoiced(events: DisfluencyEvent[]): void {
    const silenceDuration = (this.frame - this.silenceStart) * FRAME_MS;

    // BLOCK: silence burst before this voiced onset
    if (silenceDuration >= BLOCK_MIN_SILENCE_MS && this.frame > 0) {
      // Confidence scales up with silence duration (0.70 at 200ms → 0.95 at 700ms+)
      const confidence = Math.min(0.95, 0.70 + (silenceDuration - BLOCK_MIN_SILENCE_MS) / 1000);
      events.push(this.mkEvent('BLOCK', this.silenceStart * FRAME_MS, silenceDuration, confidence));
    }

    this.state       = 'voiced';
    this.voicedStart = this.frame;
    this.rmsAccum    = [];
  }

  private onEnterSilence(events: DisfluencyEvent[]): void {
    // The voiced segment ended HYSTERESIS_FRAMES ago; subtract to get true boundary
    const trueVoicedEndFrame = this.frame - this.silencePendingCount;
    const voicedDuration     = (trueVoicedEndFrame - this.voicedStart) * FRAME_MS;

    const seg: VoicedSegment = {
      onset_ms:    this.voicedStart * FRAME_MS,
      duration_ms: voicedDuration,
      rmsValues:   this.rmsAccum.slice(),
      peakRms:     this.rmsAccum.length > 0 ? Math.max(...this.rmsAccum) : 0,
    };

    // Update baseline (skip very short bursts — likely consonant pops)
    if (voicedDuration >= MIN_VOICED_FOR_BASELINE) {
      this.baseline.update(voicedDuration);
    }

    // PROLONG: z-score against speaker-adaptive baseline
    if (this.baseline.count >= MIN_BASELINE_SEGMENTS && voicedDuration >= MIN_VOICED_FOR_BASELINE) {
      const z = (voicedDuration - this.baseline.mean) / (this.baseline.stddev || 1);
      if (z >= PROLONG_Z_THRESHOLD) {
        // Confidence: 0.70 at threshold, approaches 0.95 at z = 4+
        const confidence = Math.min(0.95, 0.70 + (z - PROLONG_Z_THRESHOLD) / 4.0 * 0.25);
        events.push(this.mkEvent('PROLONG', seg.onset_ms, voicedDuration, confidence));
      }
    }

    // REP: compare against recent segments within the time window
    const repEvents = this.checkRepetition(seg);
    events.push(...repEvents);

    // Store segment for future repetition comparison
    this.recentSegs.push(seg);
    if (this.recentSegs.length > MAX_RECENT_SEGMENTS) this.recentSegs.shift();

    // Transition to silence; silence timer starts from true end of voiced
    this.state        = 'silence';
    this.silenceStart = trueVoicedEndFrame;
    this.rmsAccum     = [];
    this.silencePendingCount = 0;
  }

  private checkRepetition(newSeg: VoicedSegment): DisfluencyEvent[] {
    // Only compare short segments — long segments rarely repeat exactly
    if (newSeg.duration_ms > REP_MAX_SEGMENT_MS) return [];

    for (let i = this.recentSegs.length - 1; i >= 0; i--) {
      const prev = this.recentSegs[i];
      if (prev.duration_ms > REP_MAX_SEGMENT_MS) continue;

      // Time gap between previous segment end and new segment start
      const gap = newSeg.onset_ms - (prev.onset_ms + prev.duration_ms);
      if (gap > REP_MAX_GAP_MS) break; // segments are stored in order, so can break
      if (gap < 0) continue;

      // Duration ratio similarity
      const maxDur  = Math.max(prev.duration_ms, newSeg.duration_ms);
      const durDiff = Math.abs(prev.duration_ms - newSeg.duration_ms) / maxDur;

      if (durDiff <= REP_MAX_DURATION_RATIO) {
        const confidence = Math.min(0.80, 0.65 + (1 - durDiff) * 0.15);
        return [
          this.mkEvent('REP_START', prev.onset_ms,   prev.duration_ms,   confidence),
          this.mkEvent('REP_END',   newSeg.onset_ms, newSeg.duration_ms, confidence),
        ];
      }
    }
    return [];
  }

  private mkEvent(
    type: DisfluencyEvent['type'],
    onset_ms: number,
    duration_ms: number,
    confidence: number,
  ): DisfluencyEvent {
    return {
      id: ++this.eventIdCounter,
      type,
      onset_ms,
      duration_ms,
      confidence,
      source: 'rule-based',
    };
  }
}
