'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const WORKLET_URL = '/audio-worklets/pcm-processor.js';

// No echo cancellation, noise suppression, or AGC — these introduce
// non-linear processing delays that break the sub-60ms latency ceiling.
const MIC_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

export type FrameCallback = (frame: Float32Array, rms: number) => void;

export interface AudioPipelineState {
  isRecording: boolean;
  rms: number;          // linear amplitude [0, 1]
  decibelLevel: number; // dBFS [-60, 0]
  isVoiceActive: boolean;
  error: string | null;
}

export interface AudioPipelineControls {
  start: () => Promise<void>;
  stop: () => void;
  /** Subscribe to raw 16kHz PCM frames (160 samples = 10ms). Returns unsubscribe fn. */
  onFrame: (cb: FrameCallback) => () => void;
}

export type UseAudioPipelineReturn = AudioPipelineState & AudioPipelineControls;

// ── Utility ──────────────────────────────────────────────────────────────────

function rmsToDecibels(rms: number): number {
  if (rms <= 0) return -60;
  return Math.max(-60, Math.min(0, 20 * Math.log10(rms)));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAudioPipeline(): UseAudioPipelineReturn {
  const [state, setState] = useState<AudioPipelineState>({
    isRecording:   false,
    rms:           0,
    decibelLevel:  -60,
    isVoiceActive: false,
    error:         null,
  });

  // Refs hold mutable infrastructure; updates do not trigger re-renders.
  const ctxRef       = useRef<AudioContext | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const workletRef   = useRef<AudioWorkletNode | null>(null);
  const isRunningRef = useRef(false);

  // Frame subscribers are stored in a ref to avoid stale-closure issues
  // across re-renders; the Set is mutated directly, never replaced.
  const frameCallbacksRef = useRef<Set<FrameCallback>>(new Set());

  // ── Teardown ───────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    if (!isRunningRef.current) return;
    isRunningRef.current = false;

    if (workletRef.current) {
      workletRef.current.port.postMessage({ type: 'stop' });
      workletRef.current.disconnect();
      workletRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (ctxRef.current) {
      ctxRef.current.close().catch(() => null);
      ctxRef.current = null;
    }

    setState(s => ({
      ...s,
      isRecording:   false,
      rms:           0,
      decibelLevel:  -60,
      isVoiceActive: false,
    }));
  }, []);

  // ── Boot ───────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (isRunningRef.current) return;
    setState(s => ({ ...s, error: null }));

    try {
      // 1. Acquire microphone — MediaTrackConstraints strip all DSP processing
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: MIC_CONSTRAINTS,
        video: false,
      });
      streamRef.current = stream;

      // 2. AudioContext at 'interactive' latency — lowest achievable buffer size
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      ctxRef.current = ctx;

      // 3. Load worklet onto the audio rendering thread
      await ctx.audioWorklet.addModule(WORKLET_URL);

      // 4. Build the signal chain: mic source → worklet (analysis-only, no output)
      const source = ctx.createMediaStreamSource(stream);

      const worklet = new AudioWorkletNode(ctx, 'flowen-pcm-processor', {
        numberOfInputs:        1,
        numberOfOutputs:       0,    // silent — we only analyse, never play back
        channelCount:          1,
        channelCountMode:      'explicit',
        channelInterpretation: 'discrete',
      });
      workletRef.current = worklet;

      // 5. Handle messages from the audio thread
      worklet.port.onmessage = (ev: MessageEvent) => {
        if (!ev.data) return;

        switch (ev.data.type as string) {
          case 'pcm': {
            const frame = ev.data.frame as Float32Array;
            const rms   = ev.data.rms  as number;
            const db    = rmsToDecibels(rms);

            setState(s => ({ ...s, rms, decibelLevel: db }));

            // Dispatch to all registered frame consumers
            frameCallbacksRef.current.forEach(cb => cb(frame, rms));

            // Return the buffer to the worklet's pool — zero-copy reclaim.
            // After this call, `frame.buffer` is detached on this side.
            worklet.port.postMessage(
              { type: 'return', buffer: frame.buffer },
              [frame.buffer]
            );
            break;
          }
          case 'active': {
            setState(s => ({ ...s, isVoiceActive: ev.data.value as boolean }));
            break;
          }
        }
      };

      source.connect(worklet);
      isRunningRef.current = true;
      setState(s => ({ ...s, isRecording: true }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Audio pipeline failed to start';
      setState(s => ({ ...s, error: msg }));
      stop();
    }
  }, [stop]);

  // ── Frame subscription ─────────────────────────────────────────────────────

  const onFrame = useCallback((cb: FrameCallback): (() => void) => {
    frameCallbacksRef.current.add(cb);
    return () => { frameCallbacksRef.current.delete(cb); };
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => () => stop(), [stop]);

  return { ...state, start, stop, onFrame };
}
