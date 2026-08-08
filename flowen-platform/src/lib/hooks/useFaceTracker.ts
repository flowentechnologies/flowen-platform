'use client';

// =============================================================================
// useFaceTracker — MediaPipe FaceLandmarker camera-based blend shape driver
//                  with per-user neutral-face calibration
//
// Calibration flow
// ────────────────
// 1. Camera goes active → `calibrate()` is called automatically (or manually).
// 2. Status changes to 'calibrating' for CAL_DURATION_MS (3 s).
// 3. Every detect frame during that window is collected into calibrateFramesRef.
// 4. On completion, each blend shape key gets a personal baseline (the average
//    value seen on a relaxed neutral face).
// 5. Live frames are then normalised:
//      calibrated[key] = clamp((raw[key] − baseline[key]) / (1 − baseline[key]), 0, 1)
//    This ensures the avatar rests at zero for this specific user's neutral face
//    and expands the dynamic range to 1 for their maximum expression.
//
// The calibration baseline persists across stop/start cycles so re-enabling
// the camera in the same session skips recalibration unless the user asks.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { ZERO_BLENDS } from '@/lib/viseme';
import type { VisemeBlends } from '@/lib/viseme';

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type FaceTrackerStatus =
  | 'idle'         // hook created, camera not yet started
  | 'loading'      // downloading MediaPipe WASM + model (~6 MB, first use only)
  | 'requesting'   // waiting for camera permission grant
  | 'calibrating'  // capturing neutral-face baseline (CAL_DURATION_MS)
  | 'active'       // calibrated, blend shapes firing each frame
  | 'denied'       // user denied camera permission
  | 'error';       // any other failure (no camera, WebGL unavailable, etc.)

export interface UseFaceTrackerResult {
  status:       FaceTrackerStatus;
  errorMsg:     string | null;
  isCalibrated: boolean;
  videoRef:     RefObject<HTMLVideoElement | null>;
  start():      Promise<void>;
  stop():       void;
  calibrate():  void; // trigger a fresh 3-second baseline capture
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// Pinned CDN path so the WASM sibling files resolve correctly.
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

// Standard float16 face landmarker model with ARKit blend shape output (~6 MB).
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/' +
  'face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

// Duration of the neutral-face capture window in milliseconds.
const CAL_DURATION_MS = 3_000;

// jawOpen threshold (post-calibration) above which we consider the user speaking.
const SPEAKING_JAW_THRESHOLD = 0.08;

// All keys in VisemeBlends — used for O(1) membership checks and iteration.
const VISEME_KEYS = new Set<string>(Object.keys(ZERO_BLENDS));
const VISEME_KEY_ARRAY = Object.keys(ZERO_BLENDS) as (keyof VisemeBlends)[];

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Camera-based face tracking hook with neutral-face calibration.
 *
 * @param onBlends  Called each animation frame (~60 fps) with calibrated ARKit
 *                  blend shapes and a `speaking` flag.  Keep this stable (wrap
 *                  in useCallback with empty deps) — it's stored in a ref.
 */
export function useFaceTracker(
  onBlends: (blends: VisemeBlends, speaking: boolean) => void,
): UseFaceTrackerResult {
  const [status,       setStatus]       = useState<FaceTrackerStatus>('idle');
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  // Ref mirror so start()'s useCallback doesn't need isCalibrated as a dep
  // (would rebuild the closure + restart camera unnecessarily on every calibration).
  const isCalibratedRef = useRef(false);

  // statusRef mirrors the React state so the RAF detect loop (a closure) can
  // read the current phase without stale state from the capture time.
  const statusRef = useRef<FaceTrackerStatus>('idle');

  const videoRef      = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const rafRef        = useRef<number | null>(null);
  const calTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calibration storage
  const calibrateFramesRef = useRef<VisemeBlends[]>([]);
  // Neutral-face baseline per blend key — starts at ZERO so uncalibrated sessions
  // pass raw values through unchanged (subtract 0, divide by 1).
  const baselineRef = useRef<VisemeBlends>({ ...ZERO_BLENDS });

  // Callback ref: keeps the latest onBlends without re-running effects.
  const onBlendsRef = useRef(onBlends);
  useEffect(() => { onBlendsRef.current = onBlends; });

  // Helper that keeps statusRef and React state atomically in sync.
  const updateStatus = useCallback((s: FaceTrackerStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  // ---------------------------------------------------------------------------
  // calibrate — start a fresh baseline capture
  // ---------------------------------------------------------------------------
  const calibrate = useCallback(() => {
    if (statusRef.current !== 'active' && statusRef.current !== 'calibrating') return;

    // Cancel any in-progress calibration first
    if (calTimerRef.current !== null) {
      clearTimeout(calTimerRef.current);
      calTimerRef.current = null;
    }

    calibrateFramesRef.current = [];
    statusRef.current = 'calibrating';
    setStatus('calibrating');

    calTimerRef.current = setTimeout(() => {
      calTimerRef.current = null;
      const frames = calibrateFramesRef.current;

      if (frames.length >= 10) {
        baselineRef.current = averageBlends(frames);
        isCalibratedRef.current = true;
        setIsCalibrated(true);
      }

      // Remain in active regardless of whether we got enough frames
      statusRef.current = 'active';
      setStatus('active');
    }, CAL_DURATION_MS);
  }, []);

  // ---------------------------------------------------------------------------
  // stop — tears down camera + RAF loop; preserves compiled landmarker +
  //        calibration baseline so re-enabling is instant and re-uses baseline
  // ---------------------------------------------------------------------------
  const stop = useCallback(() => {
    if (calTimerRef.current !== null) {
      clearTimeout(calTimerRef.current);
      calTimerRef.current = null;
    }
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

    updateStatus('idle');
  }, [updateStatus]);

  // ---------------------------------------------------------------------------
  // start — loads model (first time), requests camera, auto-calibrates, begins
  //         detect loop
  // ---------------------------------------------------------------------------
  const start = useCallback(async () => {
    setErrorMsg(null);

    try {
      // ── 1. Load MediaPipe (dynamic import — browser only) ──────────────────
      updateStatus('loading');

      const { FaceLandmarker, FilesetResolver } =
        await import('@mediapipe/tasks-vision');

      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          runningMode:           'VIDEO',
          numFaces:              1,
        }) as FaceLandmarkerInstance;
      }

      // ── 2. Request camera ─────────────────────────────────────────────────
      updateStatus('requesting');

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

      // ── 3. Attach stream to video element ─────────────────────────────────
      const video = videoRef.current;
      if (!video) throw new Error('Video element not mounted');

      video.srcObject = stream;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror      = () => reject(new Error('Video element failed to load stream'));
        video.play().catch(reject);
      });

      // ── 4. Auto-calibrate on first activation; skip if already calibrated ─
      if (!isCalibratedRef.current) {
        calibrateFramesRef.current = [];
        statusRef.current = 'calibrating';
        setStatus('calibrating');

        calTimerRef.current = setTimeout(() => {
          calTimerRef.current = null;
          const frames = calibrateFramesRef.current;
          if (frames.length >= 10) {
            baselineRef.current = averageBlends(frames);
            isCalibratedRef.current = true;
            setIsCalibrated(true);
          }
          statusRef.current = 'active';
          setStatus('active');
        }, CAL_DURATION_MS);
      } else {
        updateStatus('active');
      }

      // ── 5. Detection loop ─────────────────────────────────────────────────
      const landmarker = landmarkerRef.current;

      function detect(): void {
        const vid = videoRef.current;

        if (!vid || !streamRef.current || vid.readyState < 2) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        try {
          const result = landmarker.detectForVideo(vid, performance.now());

          if (result.faceBlendshapes?.length) {
            const raw = mapCategories(result.faceBlendshapes[0].categories);

            if (statusRef.current === 'calibrating') {
              // Collect raw frames for baseline averaging
              calibrateFramesRef.current.push(raw);
              // Drive avatar with raw values during calibration so the user can
              // see it's working and position themselves correctly
              onBlendsRef.current(raw, raw.jawOpen > SPEAKING_JAW_THRESHOLD);
            } else {
              // Apply per-user normalisation
              const blends  = applyCalibration(raw, baselineRef.current);
              const speaking = blends.jawOpen > SPEAKING_JAW_THRESHOLD;
              onBlendsRef.current(blends, speaking);
            }
          }
        } catch {
          // Individual frame failures are non-fatal; continue.
        }

        rafRef.current = requestAnimationFrame(detect);
      }

      rafRef.current = requestAnimationFrame(detect);

    } catch (err) {
      const msg    = err instanceof Error ? err.message : String(err);
      const denied = /NotAllowed|Permission|denied/i.test(msg);

      updateStatus(denied ? 'denied' : 'error');
      setErrorMsg(
        denied
          ? 'Camera access denied. Allow camera access in your browser settings to enable face tracking.'
          : `Face tracking unavailable: ${msg}`,
      );
    }
  }, [updateStatus]);

  // Cleanup on unmount
  useEffect(() => () => { stop(); }, [stop]);

  return { status, errorMsg, isCalibrated, videoRef, start, stop, calibrate };
}

// -----------------------------------------------------------------------------
// averageBlends — mean of a frame buffer
// -----------------------------------------------------------------------------

function averageBlends(frames: VisemeBlends[]): VisemeBlends {
  const n   = frames.length;
  const out = { ...ZERO_BLENDS };
  for (const key of VISEME_KEY_ARRAY) {
    out[key] = frames.reduce((s, f) => s + f[key], 0) / n;
  }
  return out;
}

// -----------------------------------------------------------------------------
// applyCalibration — shift + scale raw values by neutral-face baseline
//
// For each blend shape key k:
//   range      = 1 − baseline[k]          (how far from baseline to maximum)
//   calibrated = clamp((raw[k] − baseline[k]) / range, 0, 1)
//
// If range < 0.05 (the baseline is already near 1.0 and movement headroom is
// tiny), we zero that key to avoid divide-by-near-zero amplification.
// -----------------------------------------------------------------------------

function applyCalibration(raw: VisemeBlends, baseline: VisemeBlends): VisemeBlends {
  const out = { ...ZERO_BLENDS };
  for (const key of VISEME_KEY_ARRAY) {
    const b     = baseline[key];
    const range = 1 - b;
    if (range < 0.05) {
      out[key] = 0;
    } else {
      out[key] = Math.max(0, Math.min(1, (raw[key] - b) / range));
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// mapCategories — MediaPipe category array → VisemeBlends (raw, pre-calibration)
// -----------------------------------------------------------------------------

function mapCategories(
  categories: Array<{ categoryName: string; score: number }>,
): VisemeBlends {
  const out = { ...ZERO_BLENDS };
  for (const { categoryName, score } of categories) {
    if (VISEME_KEYS.has(categoryName)) {
      (out as Record<string, number>)[categoryName] = Math.max(0, Math.min(1, score));
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Private type shim — avoids SSR import of the full MediaPipe library
// -----------------------------------------------------------------------------

interface FaceLandmarkerInstance {
  detectForVideo(
    video:     HTMLVideoElement,
    timestamp: number,
  ): {
    faceBlendshapes?: Array<{
      categories: Array<{ categoryName: string; score: number }>;
    }>;
  };
}
