'use client';

// =============================================================================
// useFaceTracker — MediaPipe FaceLandmarker camera-based face driver
//
// Outputs per-frame:
//   • 52 ARKit speech blend shapes → VisemeBlends (calibrated)
//   • 17 appearance blend shapes   → ExtraBlends  (eye/brow, calibrated)
//   • Head pose                    → FaceHeadPose (yaw/pitch/roll in radians)
//   • 478 face landmarks           → FaceLandmark[] (normalised [0,1])
//
// Calibration
// ───────────
// 3-second neutral-face window averages blend shapes + landmark positions into
// per-user baselines.  Live values are then normalised:
//   calibrated[k] = clamp((raw[k] − baseline[k]) / (1 − baseline[k]), 0, 1)
// Landmarks are baseline-shifted by subtracting the rest-pose position, giving
// movement relative to the user's own neutral face.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { ZERO_BLENDS } from '@/lib/viseme';
import type { VisemeBlends } from '@/lib/viseme';

// ── Public types ──────────────────────────────────────────────────────────────

export type FaceTrackerStatus =
  | 'idle'
  | 'loading'
  | 'requesting'
  | 'calibrating'
  | 'active'
  | 'denied'
  | 'error';

/** Facial appearance blend shapes that lie outside VisemeBlends (eye / brow). */
export interface ExtraBlends {
  eyeBlinkLeft:      number;
  eyeBlinkRight:     number;
  eyeLookDownLeft:   number; eyeLookDownRight:  number;
  eyeLookInLeft:     number; eyeLookInRight:    number;
  eyeLookOutLeft:    number; eyeLookOutRight:   number;
  eyeLookUpLeft:     number; eyeLookUpRight:    number;
  eyeSquintLeft:     number; eyeSquintRight:    number;
  eyeWideLeft:       number; eyeWideRight:      number;
  browDownLeft:      number; browDownRight:     number;
  browInnerUp:       number;
  browOuterUpLeft:   number; browOuterUpRight:  number;
}

export const ZERO_EXTRA: ExtraBlends = {
  eyeBlinkLeft: 0, eyeBlinkRight: 0,
  eyeLookDownLeft: 0, eyeLookDownRight: 0,
  eyeLookInLeft: 0, eyeLookInRight: 0,
  eyeLookOutLeft: 0, eyeLookOutRight: 0,
  eyeLookUpLeft: 0, eyeLookUpRight: 0,
  eyeSquintLeft: 0, eyeSquintRight: 0,
  eyeWideLeft: 0, eyeWideRight: 0,
  browDownLeft: 0, browDownRight: 0,
  browInnerUp: 0,
  browOuterUpLeft: 0, browOuterUpRight: 0,
};

/** Head orientation angles in radians. */
export interface FaceHeadPose {
  pitch: number;  // positive = looking down
  yaw:   number;  // positive = turning right
  roll:  number;  // positive = tilting right
}

export const ZERO_HEAD_POSE: FaceHeadPose = { pitch: 0, yaw: 0, roll: 0 };

/** A single normalised face landmark [0,1] in image space. */
export interface FaceLandmark {
  x: number;
  y: number;
  z: number; // relative depth (more negative = closer to camera)
}

/** Full per-frame face data delivered to FaceAvatar at ~60 fps. */
export interface FaceFrame {
  blends:      VisemeBlends;
  extraBlends: ExtraBlends;
  speaking:    boolean;
  headPose:    FaceHeadPose;
  /** 478 normalised landmarks, or null when camera not active. */
  landmarks:   FaceLandmark[] | null;
  /** True while the calibration window is open. */
  calibrating: boolean;
}

export interface UseFaceTrackerResult {
  status:       FaceTrackerStatus;
  errorMsg:     string | null;
  isCalibrated: boolean;
  videoRef:     RefObject<HTMLVideoElement | null>;
  start():      Promise<void>;
  stop():       void;
  calibrate():  void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/' +
  'face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

const CAL_DURATION_MS      = 3_000;
const SPEAKING_JAW_THRESHOLD = 0.08;

const VISEME_KEYS = new Set<string>(Object.keys(ZERO_BLENDS));
const VISEME_KEY_ARRAY = Object.keys(ZERO_BLENDS) as (keyof VisemeBlends)[];

const EXTRA_KEYS = new Set<string>(Object.keys(ZERO_EXTRA));
const EXTRA_KEY_ARRAY = Object.keys(ZERO_EXTRA) as (keyof ExtraBlends)[];

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Camera face tracker with per-user neutral-face calibration.
 *
 * @param onFrame  Called every animation frame (~60 fps) with a full FaceFrame.
 *                 Keep stable (wrap in useCallback with empty deps).
 */
export function useFaceTracker(
  onFrame: (frame: FaceFrame) => void,
): UseFaceTrackerResult {
  const [status,       setStatus]       = useState<FaceTrackerStatus>('idle');
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);

  const isCalibratedRef = useRef(false);
  const statusRef       = useRef<FaceTrackerStatus>('idle');

  const videoRef      = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const rafRef        = useRef<number | null>(null);
  const calTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calibration buffers
  const calBlendsRef    = useRef<VisemeBlends[]>([]);
  const calExtraRef     = useRef<ExtraBlends[]>([]);
  const calLandmarkRef  = useRef<FaceLandmark[][]>([]);

  // Baselines (neutral-face average)
  const baselineBlendsRef   = useRef<VisemeBlends>({ ...ZERO_BLENDS });
  const baselineExtraRef    = useRef<ExtraBlends>({ ...ZERO_EXTRA });
  const baselineLandmarkRef = useRef<FaceLandmark[] | null>(null);

  const onFrameRef = useRef(onFrame);
  useEffect(() => { onFrameRef.current = onFrame; });

  const updateStatus = useCallback((s: FaceTrackerStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  // ── calibrate ──────────────────────────────────────────────────────────────

  const calibrate = useCallback(() => {
    if (statusRef.current !== 'active' && statusRef.current !== 'calibrating') return;
    if (calTimerRef.current !== null) { clearTimeout(calTimerRef.current); calTimerRef.current = null; }

    calBlendsRef.current   = [];
    calExtraRef.current    = [];
    calLandmarkRef.current = [];
    statusRef.current = 'calibrating';
    setStatus('calibrating');

    calTimerRef.current = setTimeout(() => {
      calTimerRef.current = null;
      const n = calBlendsRef.current.length;
      if (n >= 10) {
        baselineBlendsRef.current   = averageBlends(calBlendsRef.current);
        baselineExtraRef.current    = averageExtra(calExtraRef.current);
        baselineLandmarkRef.current = averageLandmarks(calLandmarkRef.current);
        isCalibratedRef.current = true;
        setIsCalibrated(true);
      }
      statusRef.current = 'active';
      setStatus('active');
    }, CAL_DURATION_MS);
  }, []);

  // ── stop ───────────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    if (calTimerRef.current !== null) { clearTimeout(calTimerRef.current); calTimerRef.current = null; }
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    const vid = videoRef.current;
    if (vid) { vid.pause(); vid.srcObject = null; }
    updateStatus('idle');
  }, [updateStatus]);

  // ── start ──────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    setErrorMsg(null);
    try {
      // 1. Load MediaPipe
      updateStatus('loading');
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions:    { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          outputFaceBlendshapes:                true,
          outputFacialTransformationMatrixes:   true,
          runningMode: 'VIDEO',
          numFaces:    1,
        }) as unknown as FaceLandmarkerInstance;
      }

      // 2. Camera permission
      updateStatus('requesting');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 30, max: 60 } },
        audio: false,
      });
      streamRef.current = stream;

      // 3. Attach to video element
      const video = videoRef.current;
      if (!video) throw new Error('Video element not mounted');
      video.srcObject = stream;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror      = () => reject(new Error('Video element failed to load stream'));
        video.play().catch(reject);
      });

      // 4. Calibrate on first activation
      if (!isCalibratedRef.current) {
        calBlendsRef.current   = [];
        calExtraRef.current    = [];
        calLandmarkRef.current = [];
        statusRef.current = 'calibrating';
        setStatus('calibrating');
        calTimerRef.current = setTimeout(() => {
          calTimerRef.current = null;
          const n = calBlendsRef.current.length;
          if (n >= 10) {
            baselineBlendsRef.current   = averageBlends(calBlendsRef.current);
            baselineExtraRef.current    = averageExtra(calExtraRef.current);
            baselineLandmarkRef.current = averageLandmarks(calLandmarkRef.current);
            isCalibratedRef.current = true;
            setIsCalibrated(true);
          }
          statusRef.current = 'active';
          setStatus('active');
        }, CAL_DURATION_MS);
      } else {
        updateStatus('active');
      }

      // 5. Detection loop
      const landmarker = landmarkerRef.current;

      function detect(): void {
        const vid = videoRef.current;
        if (!vid || !streamRef.current || vid.readyState < 2) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        try {
          const result = landmarker.detectForVideo(vid, performance.now());

          if (result.faceBlendshapes?.length && result.faceLandmarks?.length) {
            const categories  = result.faceBlendshapes[0].categories;
            const rawBlends   = mapBlendCategories(categories);
            const rawExtra    = mapExtraCategories(categories);
            const rawLandmarks: FaceLandmark[] = result.faceLandmarks[0].map(
              (lm: { x: number; y: number; z: number }) => ({ x: lm.x, y: lm.y, z: lm.z }),
            );

            // Head pose from transformation matrix
            const headPose = result.facialTransformationMatrixes?.length
              ? extractHeadPose(result.facialTransformationMatrixes[0].data)
              : ZERO_HEAD_POSE;

            if (statusRef.current === 'calibrating') {
              calBlendsRef.current.push(rawBlends);
              calExtraRef.current.push(rawExtra);
              calLandmarkRef.current.push(rawLandmarks);
              // Show raw values during calibration so the user sees live feedback
              onFrameRef.current({
                blends:      rawBlends,
                extraBlends: rawExtra,
                speaking:    rawBlends.jawOpen > SPEAKING_JAW_THRESHOLD,
                headPose,
                landmarks:   rawLandmarks,
                calibrating: true,
              });
            } else {
              const blends = applyBlendsCalibration(rawBlends, baselineBlendsRef.current);
              const extra  = applyExtraCalibration(rawExtra,  baselineExtraRef.current);
              const lms    = baselineLandmarkRef.current
                ? shiftLandmarks(rawLandmarks, baselineLandmarkRef.current)
                : rawLandmarks;
              onFrameRef.current({
                blends, extraBlends: extra,
                speaking:    blends.jawOpen > SPEAKING_JAW_THRESHOLD,
                headPose, landmarks: lms, calibrating: false,
              });
            }
          }
        } catch { /* per-frame failures are non-fatal */ }

        rafRef.current = requestAnimationFrame(detect);
      }

      rafRef.current = requestAnimationFrame(detect);

    } catch (err) {
      const msg    = err instanceof Error ? err.message : String(err);
      const denied = /NotAllowed|Permission|denied/i.test(msg);
      updateStatus(denied ? 'denied' : 'error');
      setErrorMsg(denied
        ? 'Camera access denied. Enable it in browser settings to use face tracking.'
        : `Face tracking unavailable: ${msg}`,
      );
    }
  }, [updateStatus]);

  useEffect(() => () => { stop(); }, [stop]);

  return { status, errorMsg, isCalibrated, videoRef, start, stop, calibrate };
}

// ── Math helpers ─────────────────────────────────────────────────────────────

function extractHeadPose(matrix: Float32Array): FaceHeadPose {
  // Column-major 4×4 matrix from MediaPipe.
  // Rotation rows extracted for ZYX Euler decomposition:
  const pitch = Math.atan2( matrix[6],  matrix[10]);
  const yaw   = Math.atan2(-matrix[2],  Math.sqrt(matrix[6] * matrix[6] + matrix[10] * matrix[10]));
  const roll  = Math.atan2( matrix[1],  matrix[0]);
  return { pitch, yaw, roll };
}

function applyBlendsCalibration(raw: VisemeBlends, base: VisemeBlends): VisemeBlends {
  const out = { ...ZERO_BLENDS };
  for (const key of VISEME_KEY_ARRAY) {
    const range = 1 - base[key];
    out[key] = range < 0.05 ? 0 : Math.max(0, Math.min(1, (raw[key] - base[key]) / range));
  }
  return out;
}

function applyExtraCalibration(raw: ExtraBlends, base: ExtraBlends): ExtraBlends {
  const out = { ...ZERO_EXTRA };
  for (const key of EXTRA_KEY_ARRAY) {
    const range = 1 - base[key];
    out[key] = range < 0.05 ? 0 : Math.max(0, Math.min(1, (raw[key] - base[key]) / range));
  }
  return out;
}

/** Shift raw landmarks relative to the neutral-face baseline. */
function shiftLandmarks(raw: FaceLandmark[], base: FaceLandmark[]): FaceLandmark[] {
  return raw.map((lm, i) => ({
    x: lm.x - (base[i]?.x ?? 0) + 0.5,
    y: lm.y - (base[i]?.y ?? 0) + 0.5,
    z: lm.z - (base[i]?.z ?? 0),
  }));
}

function averageBlends(frames: VisemeBlends[]): VisemeBlends {
  const n = frames.length, out = { ...ZERO_BLENDS };
  for (const key of VISEME_KEY_ARRAY) out[key] = frames.reduce((s, f) => s + f[key], 0) / n;
  return out;
}

function averageExtra(frames: ExtraBlends[]): ExtraBlends {
  const n = frames.length, out = { ...ZERO_EXTRA };
  for (const key of EXTRA_KEY_ARRAY) out[key] = frames.reduce((s, f) => s + f[key], 0) / n;
  return out;
}

function averageLandmarks(frames: FaceLandmark[][]): FaceLandmark[] {
  if (!frames.length) return [];
  const n = frames.length;
  return frames[0].map((_, i) => ({
    x: frames.reduce((s, f) => s + (f[i]?.x ?? 0), 0) / n,
    y: frames.reduce((s, f) => s + (f[i]?.y ?? 0), 0) / n,
    z: frames.reduce((s, f) => s + (f[i]?.z ?? 0), 0) / n,
  }));
}

function mapBlendCategories(
  cats: Array<{ categoryName: string; score: number }>,
): VisemeBlends {
  const out = { ...ZERO_BLENDS };
  for (const { categoryName, score } of cats) {
    if (VISEME_KEYS.has(categoryName))
      (out as Record<string, number>)[categoryName] = Math.max(0, Math.min(1, score));
  }
  return out;
}

function mapExtraCategories(
  cats: Array<{ categoryName: string; score: number }>,
): ExtraBlends {
  const out = { ...ZERO_EXTRA };
  for (const { categoryName, score } of cats) {
    if (EXTRA_KEYS.has(categoryName))
      (out as Record<string, number>)[categoryName] = Math.max(0, Math.min(1, score));
  }
  return out;
}

// ── Private type shim ─────────────────────────────────────────────────────────

interface FaceLandmarkerInstance {
  detectForVideo(
    video: HTMLVideoElement,
    timestamp: number,
  ): {
    faceBlendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }>;
    faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
    facialTransformationMatrixes?: Array<{ data: Float32Array; rows: number; cols: number }>;
  };
}
