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

export class VisemeDriver {
  private current: VisemeBlends = { ...ZERO_BLENDS };
  private target: VisemeBlends = { ...ZERO_BLENDS };
  private phonemeQueue: PhonemeClass[] = [];
  private phonemeTimer = 0;
  private phonemeDuration = 80; // ms per phoneme
  private lastFrameTime = 0;
  private formantBlend = 0.3; // how much formant analysis overrides phoneme prediction

  getBlends(): VisemeBlends {
    return this.current;
  }

  pushWords(words: string): void {
    for (const word of words.trim().split(/\s+/)) {
      if (!word) continue;
      const phonemes = predictPhonemeFromWord(word);
      this.phonemeQueue.push(...phonemes);
    }
  }

  updateFormants(f1: number, f2: number): void {
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
    }

    // Lerp current → target; speed = 0.15 per ms, clamped to [0, 1]
    const speed = 0.15;
    this.current = lerpBlends(this.current, this.target, Math.min(1, speed * dt));
  }

  reset(): void {
    this.current = { ...ZERO_BLENDS };
    this.target = { ...ZERO_BLENDS };
    this.phonemeQueue = [];
    this.phonemeTimer = 0;
    this.lastFrameTime = 0;
  }
}
