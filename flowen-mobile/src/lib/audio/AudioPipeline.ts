/**
 * React Native AudioPipeline hook
 *
 * Mirrors the web useAudioPipeline contract so SessionScreen and any future
 * screens can be written once against the AudioPipelineState interface.
 *
 * Architecture:
 *   NativeModules.FlowenAudio  ──start/stop──►  iOS RemoteIO / Android Oboe
 *   NativeEventEmitter         ◄──onPCMFrame──   native thread (16 kHz, 160-sample frames)
 *                              ◄──onRMSUpdate──  native thread (per-frame RMS)
 *                              ◄──onVADChange──  native thread (boolean)
 *                              ◄──onAudioError── native thread (string)
 *
 * The hook owns all subscription bookkeeping; callers receive a stable
 * AudioPipelineState object whose numeric fields update via ref + re-render
 * throttled to ≤30 Hz so the JS thread is never saturated.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';

// ── Native module contract ────────────────────────────────────────────────────

interface FlowenAudioNative {
  /** Start the hardware audio capture pipeline. Resolves when the stream is open. */
  startCapture(): Promise<void>;
  /** Stop capture and release all hardware resources. */
  stopCapture(): Promise<void>;
  /** Returns the actual hardware sample rate (always 16 000 on supported devices). */
  getSampleRate(): Promise<number>;
}

const { FlowenAudio } = NativeModules as { FlowenAudio: FlowenAudioNative };

if (!FlowenAudio) {
  console.warn(
    '[AudioPipeline] FlowenAudio native module not found. ' +
    'Did you run `npx pod-install` (iOS) or rebuild the Android project?',
  );
}

const emitter = FlowenAudio ? new NativeEventEmitter(NativeModules.FlowenAudio) : null;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AudioPipelineState {
  isRecording:   boolean;
  rms:           number;
  decibelLevel:  number;
  isVoiceActive: boolean;
  error:         string | null;
  start:         () => Promise<void>;
  stop:          () => Promise<void>;
}

/** Called on every PCM frame with the raw base64-encoded Int16 LE payload. */
export type PCMFrameCallback = (base64: string) => void;

interface PCMFrameEvent {
  /** Base64-encoded 16-bit PCM at 16 kHz, 160 samples (320 bytes). */
  data:  string;
  rms:   number;
  ts:    number;
}

interface RMSUpdateEvent {
  rms: number;
}

interface VADChangeEvent {
  active: boolean;
}

interface AudioErrorEvent {
  message: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RMS_TO_DB = (rms: number): number =>
  rms > 0 ? 20 * Math.log10(Math.max(rms, 1e-10)) : -100;

/** Throttle UI re-renders to 30 Hz max. Native frames arrive at 100 Hz. */
const RENDER_INTERVAL_MS = 33;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAudioPipeline(onPCMFrame?: PCMFrameCallback): AudioPipelineState {
  const [state, setState] = useState<Omit<AudioPipelineState, 'start' | 'stop'>>({
    isRecording:   false,
    rms:           0,
    decibelLevel:  -100,
    isVoiceActive: false,
    error:         null,
  });

  // Latest values in refs so event handlers never go stale.
  const rmsRef           = useRef(0);
  const voiceRef         = useRef(false);
  const lastRenderRef    = useRef(0);
  const pendingRenderRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPCMFrameRef    = useRef<PCMFrameCallback | undefined>(onPCMFrame);
  // Keep the callback ref in sync without re-subscribing event listeners
  onPCMFrameRef.current  = onPCMFrame;

  // Flush accumulated ref values into React state at most 30 Hz.
  const scheduleRender = useCallback(() => {
    const now = Date.now();
    if (now - lastRenderRef.current >= RENDER_INTERVAL_MS) {
      lastRenderRef.current = now;
      setState(prev => ({
        ...prev,
        rms:           rmsRef.current,
        decibelLevel:  RMS_TO_DB(rmsRef.current),
        isVoiceActive: voiceRef.current,
      }));
    } else if (!pendingRenderRef.current) {
      const delay = RENDER_INTERVAL_MS - (now - lastRenderRef.current);
      pendingRenderRef.current = setTimeout(() => {
        pendingRenderRef.current = null;
        lastRenderRef.current = Date.now();
        setState(prev => ({
          ...prev,
          rms:           rmsRef.current,
          decibelLevel:  RMS_TO_DB(rmsRef.current),
          isVoiceActive: voiceRef.current,
        }));
      }, delay);
    }
  }, []);

  useEffect(() => {
    if (!emitter) return;

    const subs = [
      emitter.addListener('onRMSUpdate', (ev: RMSUpdateEvent) => {
        rmsRef.current = ev.rms;
        scheduleRender();
      }),

      emitter.addListener('onPCMFrame', (ev: PCMFrameEvent) => {
        // Update RMS from frame event if onRMSUpdate is not fired separately.
        rmsRef.current = ev.rms;
        scheduleRender();
        // Forward raw frame to optional caller callback (e.g. ASR accumulator).
        if (onPCMFrameRef.current && ev.data) {
          onPCMFrameRef.current(ev.data);
        }
      }),

      emitter.addListener('onVADChange', (ev: VADChangeEvent) => {
        voiceRef.current = ev.active;
        scheduleRender();
      }),

      emitter.addListener('onAudioError', (ev: AudioErrorEvent) => {
        setState(prev => ({ ...prev, error: ev.message, isRecording: false }));
      }),
    ];

    return () => {
      subs.forEach(s => s.remove());
      if (pendingRenderRef.current) clearTimeout(pendingRenderRef.current);
    };
  }, [scheduleRender]);

  const start = useCallback(async () => {
    if (!FlowenAudio) {
      setState(prev => ({ ...prev, error: 'Native audio module unavailable' }));
      return;
    }
    try {
      setState(prev => ({ ...prev, error: null }));
      await FlowenAudio.startCapture();
      setState(prev => ({ ...prev, isRecording: true }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(prev => ({ ...prev, error: msg, isRecording: false }));
    }
  }, []);

  const stop = useCallback(async () => {
    if (!FlowenAudio) return;
    try {
      await FlowenAudio.stopCapture();
    } catch { /* ignore stop errors */ }
    rmsRef.current  = 0;
    voiceRef.current = false;
    setState(prev => ({
      ...prev,
      isRecording:   false,
      rms:           0,
      decibelLevel:  -100,
      isVoiceActive: false,
    }));
  }, []);

  return { ...state, start, stop };
}
