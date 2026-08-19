'use client';

/**
 * useLipSync — converts Agora remote audio stream to ARKit viseme blend shapes
 * using browser-native WebAudio FFT analysis (no ML model required).
 *
 * Algorithm (from Agora ConvoAI blog):
 *   1. Tap the remote audio MediaStreamTrack into an AudioContext AnalyserNode
 *   2. Run FFT at 60fps (requestAnimationFrame)
 *   3. Map frequency bands to ARKit mouth blend shapes
 *   4. Exponentially smooth transitions at 12 Hz to avoid jerky movement
 *
 * The output VisemeBlends is compatible with both:
 *   - RPMAvatarScene (Three.js GLB morph targets)
 *   - The existing FaceAvatar (Canvas 2D fallback)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VisemeBlends } from '@/lib/viseme';
import { ZERO_BLENDS } from '@/lib/viseme';

type IRemoteAudioTrack = import('agora-rtc-sdk-ng').IRemoteAudioTrack;

// ── Constants ────────────────────────────────────────────────────────────────

const FFT_SIZE        = 256;  // 128 frequency bins
const SAMPLE_RATE     = 48000; // Agora default
const HZ_PER_BIN      = SAMPLE_RATE / FFT_SIZE; // ~187.5 Hz

// Speech formant bands (bin indices at 48kHz / fftSize 256)
const BIN_LOW_START  = Math.floor(85  / HZ_PER_BIN); // ~0
const BIN_LOW_END    = Math.floor(150 / HZ_PER_BIN); // ~0
const BIN_MID_START  = Math.floor(150 / HZ_PER_BIN); // ~0-1
const BIN_MID_END    = Math.floor(200 / HZ_PER_BIN); // ~1
const BIN_HIGH_START = Math.floor(200 / HZ_PER_BIN); // ~1
const BIN_HIGH_END   = Math.floor(300 / HZ_PER_BIN); // ~1-2

// Smoothing coefficient: higher = more responsive, lower = smoother
const SMOOTH_ALPHA = 0.35;

// Silence threshold (0-255 normalised FFT value)
const SILENCE_THRESHOLD = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(data: Uint8Array, start: number, end: number): number {
  let sum = 0;
  const s = Math.max(0, start);
  const e = Math.min(data.length - 1, end);
  if (s > e) return 0;
  for (let i = s; i <= e; i++) sum += data[i];
  return sum / (e - s + 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothBlends(current: VisemeBlends, target: VisemeBlends): VisemeBlends {
  const out = { ...current };
  for (const key of Object.keys(target) as (keyof VisemeBlends)[]) {
    out[key] = lerp(current[key], target[key], SMOOTH_ALPHA);
  }
  return out;
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export interface UseLipSyncReturn {
  blends:     VisemeBlends;
  isSpeaking: boolean;
  amplitude:  number; // 0-1, useful for waveform visualisation
}

export function useLipSync(
  remoteAudioTrack: IRemoteAudioTrack | null,
): UseLipSyncReturn {
  const [blends, setBlends]         = useState<VisemeBlends>({ ...ZERO_BLENDS });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [amplitude, setAmplitude]   = useState(0);

  const rafRef      = useRef<number>(0);
  const contextRef  = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentRef  = useRef<VisemeBlends>({ ...ZERO_BLENDS });

  const stopAnalysis = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (contextRef.current?.state !== 'closed') {
      void contextRef.current?.close();
    }
    contextRef.current = null;
    analyserRef.current = null;
    currentRef.current = { ...ZERO_BLENDS };
    setBlends({ ...ZERO_BLENDS });
    setIsSpeaking(false);
    setAmplitude(0);
  }, []);

  useEffect(() => {
    if (!remoteAudioTrack) {
      stopAnalysis();
      return;
    }

    // Access the underlying MediaStreamTrack from the Agora track
    const mediaStreamTrack = remoteAudioTrack.getMediaStreamTrack();
    if (!mediaStreamTrack) return;

    // Build AudioContext → AnalyserNode chain
    const ctx      = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize              = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.8;

    const source = ctx.createMediaStreamSource(
      new MediaStream([mediaStreamTrack]),
    );
    source.connect(analyser);
    // Do NOT connect analyser → destination to avoid double-play (Agora handles playback)

    contextRef.current  = ctx;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      rafRef.current = requestAnimationFrame(tick);
      analyser.getByteFrequencyData(dataArray);

      // Overall amplitude (0–255 → 0–1)
      const amp = avg(dataArray, 0, dataArray.length - 1) / 255;
      setAmplitude(amp);

      // Overall RMS for silence detection
      const overall = avg(dataArray, 0, 10);
      const speaking = overall > SILENCE_THRESHOLD;
      setIsSpeaking(speaking);

      if (!speaking) {
        // Decay to rest
        currentRef.current = smoothBlends(currentRef.current, ZERO_BLENDS);
        setBlends({ ...currentRef.current });
        return;
      }

      // ── Frequency band analysis ───────────────────────────────────────────
      const low  = avg(dataArray, BIN_LOW_START,  BIN_LOW_END);   // O, U shapes
      const mid  = avg(dataArray, BIN_MID_START,  BIN_MID_END);   // A shape
      const high = avg(dataArray, BIN_HIGH_START, BIN_HIGH_END);  // E, I shapes

      // Normalise to 0–1 relative to current loudness (prevents silent headroom)
      const maxBand = Math.max(low, mid, high, 1);
      const nLow  = low  / maxBand;
      const nMid  = mid  / maxBand;
      const nHigh = high / maxBand;

      // Jaw openness correlates with overall amplitude
      const jawAmp = Math.min(1, overall / 128);

      // Detect consonant vs vowel from band distribution
      // Consonants: rapid amplitude changes with more high-freq energy
      // Vowels: stable amplitude with low-mid dominance
      const isVowel     = nLow + nMid > nHigh * 1.4;
      const isConsonant = !isVowel;

      // Consonant shape detection
      const isBilabial  = isConsonant && nLow > 0.7;   // PP: lips together
      const isLabiodent = isConsonant && nMid > 0.6 && nLow < 0.5; // FF
      const isDental    = isConsonant && nHigh > 0.6;  // TH

      // Build target blend shapes
      const target: VisemeBlends = {
        ...ZERO_BLENDS,

        // Jaw
        jawOpen: isVowel ? jawAmp * 0.8 : jawAmp * 0.3,

        // O / U vowel — dominant low frequencies
        mouthPucker:      nLow > 0.6 ? nLow * 0.7 : 0,
        mouthFunnel:      nLow > 0.5 ? nLow * 0.5 : 0,

        // A vowel — mid-range dominant
        mouthStretchLeft:  nMid > 0.6 ? nMid * 0.4 : 0,
        mouthStretchRight: nMid > 0.6 ? nMid * 0.4 : 0,
        mouthLowerDownLeft:  nMid > 0.5 ? nMid * 0.5 : 0,
        mouthLowerDownRight: nMid > 0.5 ? nMid * 0.5 : 0,

        // E / I vowel — high frequencies
        mouthSmileLeft:  nHigh > 0.6 ? nHigh * 0.5 : 0,
        mouthSmileRight: nHigh > 0.6 ? nHigh * 0.5 : 0,

        // PP bilabial: close lips
        mouthClose:     isBilabial ? 0.8 : 0,
        mouthPressLeft:  isBilabial ? 0.6 : 0,
        mouthPressRight: isBilabial ? 0.6 : 0,

        // FF labiodental: lower lip up slightly
        mouthShrugLower: isLabiodent ? 0.4 : 0,
        mouthUpperUpLeft:  isLabiodent ? 0.3 : 0,
        mouthUpperUpRight: isLabiodent ? 0.3 : 0,

        // TH dental: tongue forward (approximate via jaw + minor open)
        mouthFrownLeft:  isDental ? 0.2 : 0,
        mouthFrownRight: isDental ? 0.2 : 0,
        tongueOut:       isDental ? 0.3 : 0,
      };

      currentRef.current = smoothBlends(currentRef.current, target);
      setBlends({ ...currentRef.current });
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      stopAnalysis();
    };
  }, [remoteAudioTrack, stopAnalysis]);

  return { blends, isSpeaking, amplitude };
}
