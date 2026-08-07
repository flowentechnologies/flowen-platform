// ============================================================================
// VisemeDriver — manages viseme state outside React
// ============================================================================

import {
  type VisemeBlends,
  type PhonemeClass,
  ZERO_BLENDS,
  buildTargetBlends,
  lerpBlends,
  formantToBlends,
  predictPhonemeFromWord,
} from '@/lib/viseme';

export interface VisemeDriverOptions {
  /**
   * Fraction (0–1) that formant analysis overrides phoneme-prediction targets.
   * Lower values make G2P shapes more prominent; higher values follow the
   * real-time acoustic signal more aggressively.
   * Default: 0.3
   */
  formantBlend?: number;
  /**
   * Milliseconds each phoneme shape is held before advancing the queue.
   * Default: 80
   */
  phonemeDuration?: number;
  /**
   * Called once when the phoneme queue drains to zero.  Fires again only
   * after at least one new phoneme is pushed and the queue empties again.
   */
  onQueueEmpty?: () => void;
}

export class VisemeDriver {
  private current: VisemeBlends = { ...ZERO_BLENDS };
  private target: VisemeBlends  = { ...ZERO_BLENDS };
  private phonemeQueue: PhonemeClass[] = [];
  private phonemeTimer  = 0;
  private phonemeDuration: number;
  private lastFrameTime = 0;
  private formantBlend: number;
  private onQueueEmpty: (() => void) | undefined;
  private queueEmptyFired = true; // start true — don't fire until a word is pushed

  constructor(opts: VisemeDriverOptions = {}) {
    this.formantBlend   = opts.formantBlend   ?? 0.3;
    this.phonemeDuration = opts.phonemeDuration ?? 80;
    this.onQueueEmpty   = opts.onQueueEmpty;
  }

  getBlends(): VisemeBlends {
    return this.current;
  }

  pushWords(words: string): void {
    for (const word of words.trim().split(/\s+/)) {
      if (!word) continue;
      const phonemes = predictPhonemeFromWord(word);
      this.phonemeQueue.push(...phonemes);
    }
    // Allow the onQueueEmpty callback to fire again once the new queue drains
    if (this.phonemeQueue.length > 0) {
      this.queueEmptyFired = false;
    }
  }

  /**
   * Blend in formant-derived adjustments.
   *
   * @param f1        First formant frequency (Hz) from extractFormants()
   * @param f2        Second formant frequency (Hz)
   * @param amplitude RMS amplitude from the analyser (0–255).  Pass 0 to skip
   *                  formant blending (e.g. during silence) so noise doesn't
   *                  corrupt the G2P phoneme target.
   */
  updateFormants(f1: number, f2: number, amplitude = 20): void {
    // Gate: below the speech threshold the mic noise is unreliable — skip so
    // silence doesn't pull the avatar away from its phoneme target shape.
    if (amplitude < 18) return;

    const formantAdj = formantToBlends(f1, f2);
    for (const k of Object.keys(formantAdj) as (keyof VisemeBlends)[]) {
      const fa = (formantAdj as Partial<VisemeBlends>)[k] ?? 0;
      this.target[k] = this.target[k] * (1 - this.formantBlend) + fa * this.formantBlend;
    }
  }

  tick(now: number): void {
    const dt = this.lastFrameTime === 0 ? 16 : now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Advance phoneme queue
    this.phonemeTimer -= dt;
    if (this.phonemeTimer <= 0 && this.phonemeQueue.length > 0) {
      const ph = this.phonemeQueue.shift()!;
      this.target = buildTargetBlends(ph);
      this.phonemeTimer = this.phonemeDuration;
    } else if (this.phonemeQueue.length === 0) {
      // Decay to rest
      this.target = { ...ZERO_BLENDS };
      // Fire onQueueEmpty once per drain cycle
      if (!this.queueEmptyFired && this.onQueueEmpty) {
        this.queueEmptyFired = true;
        this.onQueueEmpty();
      }
    }

    // Lerp current → target; speed = 0.15 per ms, clamped to [0, 1]
    const speed = 0.15;
    this.current = lerpBlends(this.current, this.target, Math.min(1, speed * dt));
  }

  reset(): void {
    this.current       = { ...ZERO_BLENDS };
    this.target        = { ...ZERO_BLENDS };
    this.phonemeQueue  = [];
    this.phonemeTimer  = 0;
    this.lastFrameTime = 0;
    this.queueEmptyFired = true;
  }
}
