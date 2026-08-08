'use client';

// =============================================================================
// useFaceTracker — MediaPipe FaceLandmarker camera-based blend shape driver
//
// Loads @mediapipe/tasks-vision lazily (browser-only, dynamic import) and runs
// GPU-accelerated face landmark detection at 60 fps.  Blend shapes are passed
// directly to the caller via `onBlends` — no React state, no re-renders.
//
// The 52 MediaPipe ARKit blend shape names (jaw*, mouth*, cheek*, nose*,
// tongueOut) are a strict superset of our VisemeBlends keys.  The mapping is a
// direct key lookup; unrecognised categories are silently ignored.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { ZERO_BLENDS } from '@/lib/viseme';
import type { VisemeBlends } from '@/lib/viseme';

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type FaceTrackerStatus =
  | 'idle'       // hook created, camera not yet started
  | 'loading'    // downloading MediaPipe WASM + model (~6 MB, first use only)
  | 'requesting' // waiting for camera permission grant
  | 'active'     // camera running, blend shapes firing each frame
  | 'denied'     // user denied camera permission
  | 'error';     // any other failure (no camera, WebGL unavailable, etc.)

export interface UseFaceTrackerResult {
  status:   FaceTrackerStatus;
  errorMsg: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  start():  Promise<void>;
  stop():   void;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// Use a pinned CDN path so the WASM sibling files resolve correctly.
// MediaPipe tasks-vision loads vision_wasm_internal.wasm / .js from this base.
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

// Standard float16 face landmarker model with ARKit blend shape output (~6 MB).
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/' +
  'face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

// jawOpen threshold above which we consider the user speaking.
const SPEAKING_JAW_THRESHOLD = 0.08;

// All keys in VisemeBlends — used for O(1) membership checks.
const VISEME_KEYS = new Set<string>(Object.keys(ZERO_BLENDS));

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Camera-based face tracking hook.
 *
 * @param onBlends  Called each animation frame (~60 fps) with the latest
 *                  ARKit blend shapes and a `speaking` flag derived from
 *                  jaw aperture.  Keep this stable (use useCallback or define
 *                  outside the component) — it is stored in a ref and not a
 *                  dependency of any effect, so instability won't re-trigger
 *                  the camera initialisation.
 */
export function useFaceTracker(
  onBlends: (blends: VisemeBlends, speaking: boolean) => void,
): UseFaceTrackerResult {
  const [status,   setStatus]   = useState<FaceTrackerStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stable video element shared between hook logic and JSX.
  const videoRef      = useRef<HTMLVideoElement | null>(null);
  // Cache the FaceLandmarker instance across start/stop cycles in the same
  // session so the model is only downloaded and compiled once per page load.
  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const rafRef        = useRef<number | null>(null);
  // Callback ref: keeps the latest `onBlends` without re-running effects.
  const onBlendsRef   = useRef(onBlends);
  useEffect(() => { onBlendsRef.current = onBlends; });

  // ---------------------------------------------------------------------------
  // stop — tears down camera + RAF loop; preserves compiled landmarker
  // ---------------------------------------------------------------------------
  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    const vid = videoRef.current;
    if (vid) {
      vid.pause();
      vid.srcObject = null;
    }

    setStatus('idle');
  }, []);

  // ---------------------------------------------------------------------------
  // start — loads model (first time), requests camera, begins detect loop
  // ---------------------------------------------------------------------------
  const start = useCallback(async () => {
    setErrorMsg(null);

    try {
      // ── 1. Load MediaPipe (dynamic import — browser only, deferred bundle) ──
      setStatus('loading');

      const { FaceLandmarker, FilesetResolver } =
        await import('@mediapipe/tasks-vision');

      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            // Prefer GPU for 60-fps inference; MediaPipe falls back to CPU
            // automatically on devices without suitable WebGL2 support.
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          runningMode:           'VIDEO',
          numFaces:              1,
        }) as FaceLandmarkerInstance;
      }

      // ── 2. Request camera ─────────────────────────────────────────────────
      setStatus('requesting');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:      { ideal: 640 },
          height:     { ideal: 480 },
          facingMode: 'user',
          frameRate:  { ideal: 30, max: 60 },
        },
        audio: false,
      });
      streamRef.current = stream;

      // ── 3. Attach stream to the video element ─────────────────────────────
      const video = videoRef.current;
      if (!video) throw new Error('Video element not mounted');

      video.srcObject = stream;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror      = () => reject(new Error('Video element failed to load stream'));
        video.play().catch(reject);
      });

      setStatus('active');

      // ── 4. Detection loop (RAF — matches display refresh rate) ────────────
      const landmarker = landmarkerRef.current;

      function detect(): void {
        const vid = videoRef.current;

        // Guard: stop if stream was torn down
        if (!vid || !streamRef.current || vid.readyState < 2) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        try {
          const result = landmarker.detectForVideo(vid, performance.now());

          if (result.faceBlendshapes?.length) {
            const blends   = mapCategories(result.faceBlendshapes[0].categories);
            const speaking = blends.jawOpen > SPEAKING_JAW_THRESHOLD;
            onBlendsRef.current(blends, speaking);
          }
        } catch {
          // Individual frame failures are non-fatal; skip and continue.
        }

        rafRef.current = requestAnimationFrame(detect);
      }

      rafRef.current = requestAnimationFrame(detect);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const denied = /NotAllowed|Permission|denied/i.test(msg);

      setStatus(denied ? 'denied' : 'error');
      setErrorMsg(
        denied
          ? 'Camera access denied. Allow camera access in your browser settings to enable face tracking.'
          : `Face tracking unavailable: ${msg}`,
      );
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stop(); }, [stop]);

  return { status, errorMsg, videoRef, start, stop };
}

// -----------------------------------------------------------------------------
// mapCategories — MediaPipe category array → VisemeBlends
//
// MediaPipe ARKit blend shape names match VisemeBlends keys exactly:
//   jawOpen, jawForward, jawLeft, jawRight,
//   mouthClose, mouthFunnel, mouthPucker, mouthLeft, mouthRight,
//   mouthSmileLeft/Right, mouthFrownLeft/Right, mouthDimpleLeft/Right,
//   mouthStretchLeft/Right, mouthRollLower, mouthRollUpper,
//   mouthShrugLower, mouthShrugUpper, mouthPressLeft/Right,
//   mouthLowerDownLeft/Right, mouthUpperUpLeft/Right,
//   cheekPuff, cheekSquintLeft/Right,
//   noseSneerLeft/Right, tongueOut
//
// Fields not emitted by MediaPipe (tongueUp/Down/Left/Right, tongueRoll,
// tongueBendDown, tongueCurlUp, tongueSquish, tongueFlat) remain at 0.
// -----------------------------------------------------------------------------

function mapCategories(
  categories: Array<{ categoryName: string; score: number }>,
): VisemeBlends {
  const out = { ...ZERO_BLENDS };
  for (const { categoryName, score } of categories) {
    if (VISEME_KEYS.has(categoryName)) {
      // Clamp to [0, 1] — MediaPipe can occasionally emit slightly out-of-range
      // values on edge-case frames.
      (out as Record<string, number>)[categoryName] = Math.max(0, Math.min(1, score));
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Private — minimal type shim for the dynamically-imported FaceLandmarker so
// TypeScript can type-check the hook without importing the full library at the
// module level (which would break SSR).
// -----------------------------------------------------------------------------

interface FaceLandmarkerInstance {
  detectForVideo(
    video: HTMLVideoElement,
    timestamp: number,
  ): {
    faceBlendshapes?: Array<{
      categories: Array<{ categoryName: string; score: number }>;
    }>;
  };
}
