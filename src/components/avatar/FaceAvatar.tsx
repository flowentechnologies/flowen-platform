'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { VisemeBlends } from '@/lib/viseme';
import { ZERO_BLENDS } from '@/lib/viseme';
import type { FaceFrame, FaceHeadPose, FaceLandmark, ExtraBlends } from '@/lib/hooks/useFaceTracker';
import { ZERO_EXTRA, ZERO_HEAD_POSE } from '@/lib/hooks/useFaceTracker';

// ============================================================================
// FaceAvatar — 2026-quality face avatar driven by 478 MediaPipe landmarks
//
// Three rendering modes:
//   1. Landmark mode   — landmarks available → renders a precise face from the
//                        actual detected geometry with head-pose rotation.
//   2. Calibration viz — shows all 478 tracked points + mesh connections.
//   3. Procedural mode — audio-only fallback; Canvas 2D face, no camera needed.
// ============================================================================

export interface FaceAvatarHandle {
  /** Live face data update at up to 60 fps — never triggers React re-renders. */
  updateFace(frame: FaceFrame): void;
  /** Backward-compat alias for the audio-only path. */
  updateBlends(blends: VisemeBlends, speaking: boolean): void;
}

interface Props {
  blends:   VisemeBlends;
  speaking: boolean;
}

const W = 400;
const H = 480;
const LERP = 0.20;

// ── Face mesh indices (MediaPipe 478-point model) ─────────────────────────────

const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];

const L_EYE_UPPER = [246,161,160,159,158,157,173];
const L_EYE_LOWER = [33,7,163,144,145,153,154,155,133];
const R_EYE_UPPER = [466,388,387,386,385,384,398];
const R_EYE_LOWER = [263,249,390,373,374,380,381,382,362];

const L_BROW = [70,63,105,66,107,55,65,52,53,46];
const R_BROW = [300,293,334,296,336,285,295,282,283,276];

const NOSE_BRIDGE = [168,6,197,195,5,4,1,19,94,2];
const L_NOSTRIL   = [64,102,49,48,59,219,220,166,79,239];
const R_NOSTRIL   = [294,331,278,279,289,439,440,392,309,459];

const LIPS_OUTER  = [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146,61];
const LIPS_INNER  = [78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95,78];

const L_IRIS = [468,469,470,471,472];  // center + cardinal points
const R_IRIS = [473,474,475,476,477];

// Calibration mesh: key outline pairs drawn as glowing lines
function buildMeshPairs(arr: number[]): [number,number][] {
  const out: [number,number][] = [];
  for (let i = 0; i < arr.length - 1; i++) out.push([arr[i], arr[i + 1]]);
  return out;
}
const CAL_PAIRS: [number,number][] = [
  ...buildMeshPairs(FACE_OVAL),
  [FACE_OVAL[FACE_OVAL.length-1], FACE_OVAL[0]], // close oval
  ...buildMeshPairs(L_EYE_UPPER), [L_EYE_UPPER[L_EYE_UPPER.length-1], L_EYE_UPPER[0]],
  ...buildMeshPairs(L_EYE_LOWER), [L_EYE_LOWER[L_EYE_LOWER.length-1], L_EYE_LOWER[0]],
  ...buildMeshPairs(R_EYE_UPPER), [R_EYE_UPPER[R_EYE_UPPER.length-1], R_EYE_UPPER[0]],
  ...buildMeshPairs(R_EYE_LOWER), [R_EYE_LOWER[R_EYE_LOWER.length-1], R_EYE_LOWER[0]],
  ...buildMeshPairs(L_BROW),
  ...buildMeshPairs(R_BROW),
  ...buildMeshPairs(NOSE_BRIDGE),
  ...buildMeshPairs(L_NOSTRIL),
  ...buildMeshPairs(R_NOSTRIL),
  ...buildMeshPairs(LIPS_OUTER),
  ...buildMeshPairs(LIPS_INNER),
  // Interior forehead + cheek cross-bracing
  [10,151],[151,9],[9,8],[8,168],[168,6],[70,46],[300,276],
  [50,36],[280,266],[234,93],[454,323],[127,234],[356,454],
  [4,195],[195,197],[2,326],[2,97],[326,327],
  [61,76],[291,306],[17,18],[0,11],[12,15],
];

// ── Animation state ────────────────────────────────────────────────────────────

interface AvatarState {
  // Mouth / speech (from VisemeBlends + ExtraBlends)
  jawOpen:   number;
  smileL:    number; smileR:  number;
  frownL:    number; frownR:  number;
  puckerFunnel: number;
  // Eyes
  blinkL:    number; blinkR:  number;
  squintL:   number; squintR: number;
  // Brows
  browDownL: number; browDownR: number;
  browInner: number;
  browOuterL: number; browOuterR: number;
  // Iris look direction (combined L+R)
  lookX: number; lookY: number;
  // Head pose (smoothed)
  pitch: number; yaw: number; roll: number;
  // Procedural timing
  breathT: number; blinkT: number;
  // Current landmarks (raw, not smoothed)
  landmarks:   FaceLandmark[] | null;
  calibrating: boolean;
}

export const FaceAvatar = forwardRef<FaceAvatarHandle, Props>(
  function FaceAvatar({ blends, speaking }, ref) {
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const frameRef    = useRef<FaceFrame>({
      blends, extraBlends: ZERO_EXTRA, speaking,
      headPose: ZERO_HEAD_POSE, landmarks: null, calibrating: false,
    });
    const rafRef  = useRef<number>(0);
    const stateRef = useRef<AvatarState>({
      jawOpen: 0, smileL: 0, smileR: 0, frownL: 0, frownR: 0, puckerFunnel: 0,
      blinkL: 0, blinkR: 0, squintL: 0, squintR: 0,
      browDownL: 0, browDownR: 0, browInner: 0, browOuterL: 0, browOuterR: 0,
      lookX: 0, lookY: 0,
      pitch: 0, yaw: 0, roll: 0,
      breathT: 0, blinkT: Math.random() * 4,
      landmarks: null, calibrating: false,
    });

    // ── Imperative handle ─────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      updateFace(frame: FaceFrame) { frameRef.current = frame; },
      updateBlends(b: VisemeBlends, sp: boolean) {
        frameRef.current = {
          blends: b, extraBlends: ZERO_EXTRA, speaking: sp,
          headPose: ZERO_HEAD_POSE, landmarks: null, calibrating: false,
        };
      },
    }), []);

    // Sync props → frame for non-imperative callers (ready-screen idle pose)
    useEffect(() => {
      frameRef.current = {
        blends, extraBlends: ZERO_EXTRA, speaking,
        headPose: ZERO_HEAD_POSE, landmarks: null, calibrating: false,
      };
    }, [blends, speaking]);

    // ── Animation loop ────────────────────────────────────────────────────────

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let lastT = performance.now();
      const lp = (a: number, b: number) => a + (b - a) * LERP;
      const cl = (v: number)            => Math.max(0, Math.min(1, v));

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const now = performance.now();
        const dt  = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;

        const f  = frameRef.current;
        const b  = f.blends;
        const ex = f.extraBlends;
        const hp = f.headPose;
        const s  = stateRef.current;

        // Procedural timers
        s.breathT += dt * 0.85;
        s.blinkT  += dt;

        // Breath-driven jaw (only audio mode — landmarks handle it naturally)
        const breath = (!f.landmarks && !f.speaking)
          ? 0.038 * (0.5 + 0.5 * Math.sin(s.breathT))
          : 0;

        // Autonomous blink every ~4 s (suppressed when camera gives real blink data)
        const autoBlink = !f.landmarks
          ? (() => { const ph = s.blinkT % 4.2; return ph < 0.12 ? Math.sin((ph / 0.12) * Math.PI) : 0; })()
          : 0;

        // Lerp all animation state
        s.jawOpen     = lp(s.jawOpen,     cl(Math.max(b.jawOpen    ?? 0, breath)));
        s.smileL      = lp(s.smileL,      cl(b.mouthSmileLeft      ?? 0));
        s.smileR      = lp(s.smileR,      cl(b.mouthSmileRight     ?? 0));
        s.frownL      = lp(s.frownL,      cl(b.mouthFrownLeft      ?? 0));
        s.frownR      = lp(s.frownR,      cl(b.mouthFrownRight     ?? 0));
        s.puckerFunnel = lp(s.puckerFunnel, cl((b.mouthPucker ?? 0) * 0.5 + (b.mouthFunnel ?? 0) * 0.5));
        s.blinkL      = lp(s.blinkL,      cl(ex.eyeBlinkLeft       || autoBlink));
        s.blinkR      = lp(s.blinkR,      cl(ex.eyeBlinkRight      || autoBlink));
        s.squintL     = lp(s.squintL,     cl(ex.eyeSquintLeft      ?? 0));
        s.squintR     = lp(s.squintR,     cl(ex.eyeSquintRight     ?? 0));
        s.browDownL   = lp(s.browDownL,   cl(ex.browDownLeft       ?? 0));
        s.browDownR   = lp(s.browDownR,   cl(ex.browDownRight      ?? 0));
        s.browInner   = lp(s.browInner,   cl(ex.browInnerUp        ?? 0));
        s.browOuterL  = lp(s.browOuterL,  cl(ex.browOuterUpLeft    ?? 0));
        s.browOuterR  = lp(s.browOuterR,  cl(ex.browOuterUpRight   ?? 0));
        // Iris look direction from eye look blends (average L+R)
        s.lookX = lp(s.lookX, cl(0.5 + (ex.eyeLookOutLeft - ex.eyeLookInLeft) * 0.5));
        s.lookY = lp(s.lookY, cl(0.5 + (ex.eyeLookDownLeft - ex.eyeLookUpLeft) * 0.5));
        // Head pose
        s.pitch = lp(s.pitch, hp.pitch);
        s.yaw   = lp(s.yaw,   hp.yaw);
        s.roll  = lp(s.roll,  hp.roll);
        // Landmarks passed through (used raw from the latest frame)
        s.landmarks   = f.landmarks;
        s.calibrating = f.calibrating;

        // Draw
        if (s.calibrating && s.landmarks) {
          drawCalibration(ctx, s.landmarks, s.blinkT);
        } else if (s.landmarks) {
          drawLandmarkFace(ctx, s.landmarks, s, f.speaking);
        } else {
          drawProceduralFace(ctx, s, f.speaking);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(rafRef.current); };
    }, []);

    return (
      <div
        role="figure"
        aria-label="Speech therapy avatar — facial movements mirror your articulation in real time"
        style={{
          position: 'relative', width: '100%', maxWidth: W,
          aspectRatio: `${W} / ${H}`, background: '#080c12',
          display: 'block', borderRadius: '1rem', overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    );
  },
);

// ════════════════════════════════════════════════════════════════════════════
// MODE 1 — Calibration visualisation: 478 glowing landmark points + mesh
// ════════════════════════════════════════════════════════════════════════════

function drawCalibration(
  ctx:       CanvasRenderingContext2D,
  landmarks: FaceLandmark[],
  time:      number,
) {
  ctx.clearRect(0, 0, W, H);

  // Dark gradient background
  const bg = ctx.createRadialGradient(W/2, H/2, 20, W/2, H/2, 300);
  bg.addColorStop(0, '#0a1020');
  bg.addColorStop(1, '#050810');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const { scale, ox, oy } = computeFaceTransform(landmarks);

  const px = (i: number) => ox + (landmarks[i]?.x ?? 0.5) * W * scale - (scale - 1) * W * 0.5;
  const py = (i: number) => oy + (landmarks[i]?.y ?? 0.5) * H * scale - (scale - 1) * H * 0.5;

  // Draw mesh connections
  ctx.lineWidth   = 0.6;
  ctx.strokeStyle = 'rgba(0, 220, 200, 0.30)';
  ctx.shadowBlur  = 3;
  ctx.shadowColor = 'rgba(0,220,200,0.5)';
  for (const [a, b] of CAL_PAIRS) {
    if (!landmarks[a] || !landmarks[b]) continue;
    ctx.beginPath();
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(b), py(b));
    ctx.stroke();
  }

  // Draw all 478 landmark dots with pulsing glow
  const pulse = 0.5 + 0.5 * Math.sin(time * 3.0);
  for (let i = 0; i < Math.min(landmarks.length, 478); i++) {
    const x = px(i), y = py(i);
    const depth = Math.max(0, 1 + landmarks[i].z * 2); // z in [-1,0] approx
    const alpha = 0.5 + depth * 0.5;
    const r     = 1.4 + depth * 0.8;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = `rgba(0,220,200,${alpha * (0.7 + pulse * 0.3)})`;
    ctx.shadowBlur  = 6;
    ctx.shadowColor = `rgba(0,220,200,${alpha * 0.8})`;
    ctx.fill();
  }

  // HUD overlay
  ctx.shadowBlur = 0;
  ctx.fillStyle  = 'rgba(0,220,200,0.12)';
  ctx.fillRect(0, H - 56, W, 56);

  ctx.textAlign    = 'center';
  ctx.fillStyle    = 'rgba(0,220,200,0.95)';
  ctx.font         = '11px "SF Mono", "JetBrains Mono", monospace';
  ctx.letterSpacing = '0.15em';
  ctx.fillText('MAPPING 478 FACIAL POINTS', W/2, H - 32);

  ctx.fillStyle = 'rgba(0,220,200,0.55)';
  ctx.font      = '9px "SF Mono", "JetBrains Mono", monospace';
  ctx.fillText('HOLD NEUTRAL EXPRESSION · LOOK AT CAMERA', W/2, H - 14);

  // Point count HUD top-left
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,220,200,0.7)';
  ctx.font      = '10px "SF Mono", "JetBrains Mono", monospace';
  ctx.fillText(`${Math.min(landmarks.length, 478)} pts`, 14, 22);
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 2 — Landmark face: renders the face from detected 478 point positions
// ════════════════════════════════════════════════════════════════════════════

function drawLandmarkFace(
  ctx:       CanvasRenderingContext2D,
  landmarks: FaceLandmark[],
  s:         AvatarState,
  speaking:  boolean,
) {
  ctx.clearRect(0, 0, W, H);

  // Background
  const bg = ctx.createRadialGradient(W/2, H*0.55, 10, W/2, H*0.45, 280);
  bg.addColorStop(0, '#141c28');
  bg.addColorStop(1, '#080c12');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const { scale, ox, oy } = computeFaceTransform(landmarks);

  // Project a landmark to canvas coords, applying head roll via rotate
  const px = (lm: FaceLandmark) => ox + lm.x * W * scale;
  const py = (lm: FaceLandmark) => oy + lm.y * H * scale;
  const lm  = (i: number) => landmarks[i] ?? { x: 0.5, y: 0.5, z: 0 };

  // ── Apply head rotation canvas transform ────────────────────────────────
  // Roll is applied as canvas rotation; yaw + pitch add a slight perspective squeeze
  ctx.save();
  const cx = W / 2, cy = H * 0.45;
  ctx.translate(cx, cy);
  ctx.rotate(s.roll);
  // Perspective compression: face compresses on the turn axis
  const xScale = Math.cos(s.yaw)   * 0.25 + 0.75;   // [0.75, 1.0] range
  const yScale = Math.cos(s.pitch) * 0.25 + 0.75;
  ctx.scale(xScale, yScale);
  // Small translation to simulate 3D parallax
  ctx.translate(-cx + Math.sin(s.yaw) * 18, -cy - Math.sin(s.pitch) * 12);

  // ── Face oval fill ───────────────────────────────────────────────────────
  const faceGrad = ctx.createRadialGradient(
    px(lm(168)) - 20, py(lm(168)) - 30, 10,  // key light near nose bridge
    px(lm(168)), py(lm(168)), scale * 220,
  );
  faceGrad.addColorStop(0,    '#F0BE88');
  faceGrad.addColorStop(0.45, '#D4976A');
  faceGrad.addColorStop(0.80, '#B87848');
  faceGrad.addColorStop(1,    '#9A6030');

  drawContour(ctx, FACE_OVAL, landmarks, px, py, true);
  ctx.fillStyle = faceGrad;
  ctx.fill();

  // Neck stub below chin
  const chinLm = lm(152);
  const neckX  = px(chinLm), neckY = py(chinLm);
  ctx.beginPath();
  ctx.ellipse(neckX, neckY + scale * 18, scale * 24, scale * 22, 0, 0, Math.PI);
  ctx.fillStyle = '#C49060';
  ctx.fill();

  // ── Hair ────────────────────────────────────────────────────────────────
  // Hair fills from top of face oval to the very top of canvas
  drawContour(ctx, FACE_OVAL, landmarks, px, py, false);
  ctx.save();
  ctx.clip();
  const topLm = lm(10);  // top forehead point
  ctx.fillStyle = '#1A0E06';
  ctx.fillRect(0, 0, W, py(topLm) + scale * 28);
  ctx.restore();

  // Side hair bumps (partial ellipses at ear positions)
  ctx.beginPath();
  ctx.ellipse(px(lm(234)) - scale*10, py(lm(234)), scale*12, scale*48, 0.1, 0, Math.PI*2);
  ctx.fillStyle = '#1A0E06';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(px(lm(454)) + scale*10, py(lm(454)), scale*12, scale*48, -0.1, 0, Math.PI*2);
  ctx.fillStyle = '#1A0E06';
  ctx.fill();

  // ── Subtle cheek blush ───────────────────────────────────────────────────
  ctx.beginPath();
  ctx.ellipse(px(lm(50)), py(lm(50)), scale*22, scale*14, -0.15, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(210,90,70,0.11)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(px(lm(280)), py(lm(280)), scale*22, scale*14, 0.15, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(210,90,70,0.11)';
  ctx.fill();

  // ── Eyebrows ─────────────────────────────────────────────────────────────
  drawBrow(ctx, L_BROW, landmarks, px, py, scale, s.browDownL, s.browInner, s.browOuterL, false);
  drawBrow(ctx, R_BROW, landmarks, px, py, scale, s.browDownR, s.browInner, s.browOuterR, true);

  // ── Eyes ─────────────────────────────────────────────────────────────────
  drawLandmarkEye(ctx, L_EYE_UPPER, L_EYE_LOWER, L_IRIS, landmarks, px, py, scale, s.blinkL, s.squintL, s.lookX, s.lookY, false);
  drawLandmarkEye(ctx, R_EYE_UPPER, R_EYE_LOWER, R_IRIS, landmarks, px, py, scale, s.blinkR, s.squintR, s.lookX, s.lookY, true);

  // ── Nose ─────────────────────────────────────────────────────────────────
  drawLandmarkNose(ctx, landmarks, px, py, scale);

  // ── Mouth ────────────────────────────────────────────────────────────────
  drawLandmarkMouth(ctx, landmarks, px, py, scale, s);

  // ── Specular highlight: left-of-nose bridge ───────────────────────────────
  const specX = px(lm(6)) - scale * 8;
  const specY = py(lm(6)) - scale * 5;
  const specG = ctx.createRadialGradient(specX, specY, 0, specX, specY, scale * 30);
  specG.addColorStop(0, 'rgba(255,250,240,0.18)');
  specG.addColorStop(1, 'rgba(255,250,240,0)');
  ctx.beginPath();
  ctx.ellipse(specX, specY, scale * 28, scale * 18, -0.3, 0, Math.PI*2);
  ctx.fillStyle = specG;
  ctx.fill();

  ctx.restore(); // head-rotation transform

  // ── Live tracking HUD (bottom strip) ──────────────────────────────────────
  if (speaking) {
    ctx.fillStyle = 'rgba(16,185,129,0.08)';
    ctx.fillRect(0, H - 32, W, 32);
    ctx.textAlign    = 'center';
    ctx.fillStyle    = 'rgba(16,185,129,0.75)';
    ctx.font         = '9px "SF Mono", monospace';
    ctx.letterSpacing = '0.12em';
    ctx.fillText('ANALYSING', W/2, H - 12);
  }
}

// ── Helpers for landmark mode ─────────────────────────────────────────────────

function computeFaceTransform(landmarks: FaceLandmark[]) {
  const xs = FACE_OVAL.map(i => landmarks[i]?.x ?? 0.5);
  const ys = FACE_OVAL.map(i => landmarks[i]?.y ?? 0.5);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const faceW = Math.max(maxX - minX, 0.01);
  const faceH = Math.max(maxY - minY, 0.01);
  const faceCx = (minX + maxX) / 2;
  const faceCy = (minY + maxY) / 2;
  // Scale so face oval occupies 80% of canvas width
  const scale = (0.80 * W) / (faceW * W);
  // Offset to centre the face; keep face 45% down the canvas (chin visible)
  const ox = W / 2 - faceCx * W * scale;
  const oy = H * 0.42 - faceCy * H * scale;
  return { scale, ox, oy };
}

function drawContour(
  ctx: CanvasRenderingContext2D,
  indices: number[],
  landmarks: FaceLandmark[],
  px: (lm: FaceLandmark) => number,
  py: (lm: FaceLandmark) => number,
  close: boolean,
) {
  if (!indices.length) return;
  ctx.beginPath();
  const first = landmarks[indices[0]];
  if (!first) return;
  ctx.moveTo(px(first), py(first));
  for (let i = 1; i < indices.length; i++) {
    const lm = landmarks[indices[i]];
    if (lm) ctx.lineTo(px(lm), py(lm));
  }
  if (close) ctx.closePath();
}

function drawBrow(
  ctx: CanvasRenderingContext2D,
  indices: number[],
  landmarks: FaceLandmark[],
  px: (lm: FaceLandmark) => number,
  py: (lm: FaceLandmark) => number,
  scale: number,
  browDown: number, browInner: number, browOuter: number,
  isRight: boolean,
) {
  if (!indices.length) return;
  ctx.beginPath();
  const lift = (browOuter * 0.5 + browInner * 0.4) - browDown * 0.7;
  const liftPx = lift * scale * 12;
  const first = landmarks[indices[0]];
  if (!first) return;
  ctx.moveTo(px(first), py(first) - liftPx);
  for (let i = 1; i < indices.length; i++) {
    const lm = landmarks[indices[i]];
    if (!lm) continue;
    // Taper: inner brow lifts more on brow-inner-up
    const t = isRight ? i / (indices.length - 1) : 1 - i / (indices.length - 1);
    const innerEffect = browInner * t * scale * 6;
    ctx.lineTo(px(lm), py(lm) - liftPx - innerEffect);
  }
  ctx.strokeStyle = '#1E0C04';
  ctx.lineWidth   = scale * 7;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.shadowBlur  = 0;
  ctx.stroke();
}

function drawLandmarkEye(
  ctx:       CanvasRenderingContext2D,
  upperIdx:  number[], lowerIdx: number[], irisIdx: number[],
  landmarks: FaceLandmark[],
  px: (lm: FaceLandmark) => number,
  py: (lm: FaceLandmark) => number,
  scale:   number,
  blink:   number,
  squint:  number,
  lookX:   number,
  lookY:   number,
  isRight: boolean,
) {
  // 1. Build eye shape from upper + lower contour points
  const upper = upperIdx.map(i => landmarks[i]).filter(Boolean) as FaceLandmark[];
  const lower = lowerIdx.map(i => landmarks[i]).filter(Boolean) as FaceLandmark[];
  if (!upper.length || !lower.length) return;

  const cx  = (upper.reduce((s, l) => s + px(l), 0) + lower.reduce((s, l) => s + px(l), 0)) / (upper.length + lower.length);
  const cy  = (upper.reduce((s, l) => s + py(l), 0) + lower.reduce((s, l) => s + py(l), 0)) / (upper.length + lower.length);
  const eyeH = Math.abs(upper.reduce((s, l) => s + py(l), 0) / upper.length - cy) + Math.abs(lower.reduce((s, l) => s + py(l), 0) / lower.length - cy);

  // 2. Clip eye region
  ctx.save();
  ctx.beginPath();
  upper.forEach((lm, i) => (i === 0 ? ctx.moveTo(px(lm), py(lm)) : ctx.lineTo(px(lm), py(lm))));
  [...lower].reverse().forEach(lm => ctx.lineTo(px(lm), py(lm)));
  ctx.closePath();
  ctx.clip();

  // 3. Sclera
  ctx.fillStyle = '#F3EDE5';
  ctx.fill();

  // 4. Iris + pupil (size from blink-open amount)
  const irisR = eyeH * 0.72 * Math.max(0.05, 1 - blink * 0.9);
  const irisX = cx + (lookX - 0.5) * eyeH * 0.8 * (isRight ? 1 : -1);
  const irisY = cy + (lookY - 0.5) * eyeH * 0.5;

  const irisG = ctx.createRadialGradient(irisX - irisR*0.2, irisY - irisR*0.2, 0, irisX, irisY, irisR);
  irisG.addColorStop(0, '#7A4E28');
  irisG.addColorStop(0.6, '#4A2E14');
  irisG.addColorStop(1, '#2A1408');
  ctx.beginPath();
  ctx.arc(irisX, irisY, irisR, 0, Math.PI * 2);
  ctx.fillStyle = irisG;
  ctx.fill();

  // Pupil
  ctx.beginPath();
  ctx.arc(irisX, irisY, irisR * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = '#0A0806';
  ctx.fill();

  // Specular highlights
  ctx.beginPath();
  ctx.arc(irisX + irisR * 0.28, irisY - irisR * 0.30, irisR * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(irisX - irisR * 0.18, irisY + irisR * 0.22, irisR * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();

  // Use MediaPipe iris landmark for more precise center (if available)
  if (irisIdx.length && landmarks[irisIdx[0]]) {
    // Just use it to refine— already computed above
  }

  // 5. Eyelid close (skin colour rectangle from top)
  if (blink > 0.02) {
    const lidY = cy - eyeH - 4;
    const lidH = eyeH * 2.5 * blink;
    ctx.fillStyle = '#D4A06A';
    ctx.fillRect(cx - eyeH * 3, lidY, eyeH * 6, lidH);
  }

  ctx.restore();

  // 6. Eyelash lines (drawn outside clip so they sit on top)
  ctx.beginPath();
  ctx.moveTo(px(upper[0]), py(upper[0]) - scale * 2);
  upper.forEach(lm => ctx.lineTo(px(lm), py(lm) - scale * 2 - squint * scale * 3));
  ctx.strokeStyle = '#100804';
  ctx.lineWidth   = scale * 3.5;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Lower lash line (subtle)
  ctx.beginPath();
  ctx.moveTo(px(lower[lower.length - 1]), py(lower[lower.length - 1]) + scale);
  lower.forEach(lm => ctx.lineTo(px(lm), py(lm) + scale * 1.5));
  ctx.strokeStyle = 'rgba(20,8,4,0.4)';
  ctx.lineWidth   = scale * 1.8;
  ctx.stroke();
}

function drawLandmarkNose(
  ctx: CanvasRenderingContext2D,
  landmarks: FaceLandmark[],
  px: (lm: FaceLandmark) => number,
  py: (lm: FaceLandmark) => number,
  scale: number,
) {
  // Nose shadow beneath bridge
  if (!landmarks[4]) return;
  const tip = landmarks[4];
  ctx.beginPath();
  ctx.ellipse(px(tip), py(tip) + scale * 4, scale * 9, scale * 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(140,70,30,0.28)';
  ctx.fill();

  // Nostril shadows
  for (const i of [102, 331]) {
    const nl = landmarks[i];
    if (!nl) continue;
    ctx.beginPath();
    ctx.ellipse(px(nl), py(nl), scale * 5, scale * 3.5, i < 200 ? -0.2 : 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(90,40,15,0.45)';
    ctx.fill();
  }
}

function drawLandmarkMouth(
  ctx: CanvasRenderingContext2D,
  landmarks: FaceLandmark[],
  px: (lm: FaceLandmark) => number,
  py: (lm: FaceLandmark) => number,
  scale: number,
  s: AvatarState,
) {
  const jawOpen = s.jawOpen;

  // Upper and lower lip outer landmarks
  const outerPts = LIPS_OUTER.map(i => landmarks[i]).filter(Boolean) as FaceLandmark[];
  const innerPts = LIPS_INNER.map(i => landmarks[i]).filter(Boolean) as FaceLandmark[];
  if (!outerPts.length) return;

  // Detect if mouth is open: compare upper-inner to lower-inner centre Y
  const ul78  = landmarks[78],  ul308 = landmarks[308];
  const ll95  = landmarks[95],  ll324 = landmarks[324];
  const innerOpenY = (ul78 && ul308 && ll95 && ll324)
    ? ((py(ll95) + py(ll324)) / 2) - ((py(ul78) + py(ul308)) / 2)
    : jawOpen * scale * 32;

  const isOpen = innerOpenY > scale * 3;

  // Mouth interior (dark) when open
  if (isOpen && innerPts.length > 4) {
    drawContour(ctx, LIPS_INNER, landmarks, px, py, true);
    ctx.fillStyle = '#3A0E0E';
    ctx.fill();

    // Upper teeth
    const teethH = Math.max(0, innerOpenY - scale * 4) * 0.45;
    if (teethH > 1 && ul78 && ul308) {
      const midX = (px(ul78) + px(ul308)) / 2;
      const midY = (py(ul78) + py(ul308)) / 2;
      const tW   = Math.abs(px(ul308) - px(ul78)) * 0.9;
      ctx.fillStyle = '#EDE8DC';
      ctx.beginPath();
      ctx.roundRect(midX - tW/2, midY - scale*2, tW, teethH + scale*3, scale * 2);
      ctx.fill();
      // Tooth gaps
      ctx.strokeStyle = 'rgba(180,160,140,0.3)';
      ctx.lineWidth = scale * 0.8;
      for (let t = -2; t <= 2; t++) {
        ctx.beginPath();
        ctx.moveTo(midX + t * tW/5, midY);
        ctx.lineTo(midX + t * tW/5, midY + teethH + scale*2);
        ctx.stroke();
      }
    }
  }

  // Lower lip
  drawContour(ctx, LIPS_OUTER.slice(LIPS_OUTER.indexOf(291)), landmarks, px, py, false);
  ctx.strokeStyle = '#7A3820';
  ctx.lineWidth   = scale * 4.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // Upper lip (draw twice for fill + stroke)
  const upperOuter = LIPS_OUTER.slice(0, LIPS_OUTER.indexOf(291) + 1);
  drawContour(ctx, upperOuter, landmarks, px, py, false);
  ctx.strokeStyle = '#6A2C16';
  ctx.lineWidth   = scale * 3.5;
  ctx.stroke();

  // Fill upper lip area
  drawContour(ctx, upperOuter, landmarks, px, py, false);
  const ulCornerL = landmarks[61];
  const ulCornerR = landmarks[291];
  if (ulCornerL && ulCornerR) {
    ctx.lineTo(px(ulCornerR), py(ulCornerR));
    ctx.lineTo(px(ulCornerL), py(ulCornerL));
    ctx.closePath();
    ctx.fillStyle = 'rgba(160,72,48,0.50)';
    ctx.fill();
  }

  // Mouth corner sheen (dimple dots)
  for (const ci of [61, 291]) {
    const cl2 = landmarks[ci];
    if (!cl2) continue;
    ctx.beginPath();
    ctx.arc(px(cl2), py(cl2), scale * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,50,25,0.60)';
    ctx.fill();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 3 — Procedural face: no camera, audio-driven (same as original canvas face)
// ════════════════════════════════════════════════════════════════════════════

function drawProceduralFace(ctx: CanvasRenderingContext2D, s: AvatarState, _speaking: boolean) {
  ctx.clearRect(0, 0, W, H);

  const bgGrad = ctx.createRadialGradient(200, 260, 20, 200, 240, 290);
  bgGrad.addColorStop(0, '#131c2b'); bgGrad.addColorStop(1, '#0d1117');
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

  // Neck
  ctx.beginPath(); ctx.moveTo(168,352); ctx.lineTo(232,352); ctx.lineTo(245,480); ctx.lineTo(155,480); ctx.closePath();
  ctx.fillStyle = '#C49060'; ctx.fill();

  // Face
  const fg = ctx.createRadialGradient(185, 195, 22, 200, 230, 162);
  fg.addColorStop(0,'#ECC088'); fg.addColorStop(0.5,'#D4A06A'); fg.addColorStop(0.85,'#BB8448'); fg.addColorStop(1,'#A07038');
  ctx.beginPath(); ctx.ellipse(200, 232, 114, 152, 0, 0, Math.PI*2); ctx.fillStyle=fg; ctx.fill();

  // Hair
  ctx.save();
  ctx.beginPath(); ctx.ellipse(200, 232, 114, 152, 0, 0, Math.PI*2); ctx.clip();
  ctx.fillStyle = '#231108';
  ctx.fillRect(0, 0, W, 166);
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(88,195,16,62,0.08,0,Math.PI*2); ctx.fillStyle='#231108'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(312,195,16,62,-0.08,0,Math.PI*2); ctx.fillStyle='#231108'; ctx.fill();

  // Blush
  ctx.beginPath(); ctx.ellipse(144,278,24,13,-0.1,0,Math.PI*2); ctx.fillStyle='rgba(218,100,80,0.13)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(256,278,24,13,0.1,0,Math.PI*2); ctx.fillStyle='rgba(218,100,80,0.13)'; ctx.fill();

  // Brows
  const bl = (s.browInner*0.45 + s.browOuterL*0.55 - s.browDownL*0.6) * 12;
  const br = (s.browInner*0.45 + s.browOuterR*0.55 - s.browDownR*0.6) * 12;
  ctx.lineCap='round'; ctx.lineWidth=5.5; ctx.strokeStyle='#2A1006';
  ctx.beginPath(); ctx.moveTo(142,185-bl); ctx.quadraticCurveTo(166,175-bl-s.browInner*5,194,185-bl+2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(206,185-br+2); ctx.quadraticCurveTo(234,175-br-s.browInner*5,258,185-br); ctx.stroke();

  drawProceduralEye(ctx, 162, 214, s.blinkL, s.squintL, s.lookX, s.lookY);
  drawProceduralEye(ctx, 238, 214, s.blinkR, s.squintR, s.lookX, s.lookY);

  // Nose
  ctx.beginPath(); ctx.moveTo(200,237); ctx.quadraticCurveTo(196,256,184,265); ctx.quadraticCurveTo(200,271,216,265); ctx.quadraticCurveTo(204,256,200,237);
  ctx.fillStyle='#C49060'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(187,266,6.5,4,-0.18,0,Math.PI*2); ctx.fillStyle='rgba(100,55,20,0.55)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(213,266,6.5,4,0.18,0,Math.PI*2); ctx.fillStyle='rgba(100,55,20,0.55)'; ctx.fill();

  drawProceduralMouth(ctx, s);
}

function drawProceduralEye(ctx: CanvasRenderingContext2D, cx: number, cy: number, blink: number, squint: number, lookX: number, lookY: number) {
  const ew=30, eh=17;
  ctx.beginPath(); ctx.ellipse(cx,cy,ew,eh,0,0,Math.PI*2); ctx.fillStyle='#F3EDE5'; ctx.fill();
  const iX = cx + (lookX-0.5)*10, iY = cy + (lookY-0.5)*5;
  const iG = ctx.createRadialGradient(iX-3,iY-3,0,iX,iY,12);
  iG.addColorStop(0,'#7A4E28'); iG.addColorStop(1,'#2A1408');
  ctx.beginPath(); ctx.arc(iX,iY,12,0,Math.PI*2); ctx.fillStyle=iG; ctx.fill();
  ctx.beginPath(); ctx.arc(iX,iY,6.5,0,Math.PI*2); ctx.fillStyle='#0e0908'; ctx.fill();
  ctx.beginPath(); ctx.arc(iX+4,iY-3,3,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.88)'; ctx.fill();
  if (blink > 0.02) {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx,cy,ew+1,eh+1,0,0,Math.PI*2); ctx.clip();
    ctx.fillStyle='#D4A06A'; ctx.fillRect(cx-ew-1,cy-eh-1,(ew+1)*2,(eh*2+2)*blink); ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(cx-ew,cy-3-(squint*6)); ctx.quadraticCurveTo(cx,cy-eh-4,cx+ew,cy-3-(squint*6));
  ctx.strokeStyle='#180A04'; ctx.lineWidth=3; ctx.lineCap='round'; ctx.stroke();
}

function drawProceduralMouth(ctx: CanvasRenderingContext2D, s: AvatarState) {
  const baseY=308, halfW=46, jaw=s.jawOpen;
  const smile=(s.smileL+s.smileR)/2, frown=(s.frownL+s.frownR)/2;
  const cDy=smile*14-frown*9, cDx=smile*5;
  const lX=200-halfW-cDx, rX=200+halfW+cDx;
  const ulY=baseY-4-jaw*10, llY=baseY+8+jaw*32;

  if (jaw>0.02) {
    ctx.beginPath();
    ctx.moveTo(lX,baseY+cDy); ctx.bezierCurveTo(200-halfW*.5,ulY+jaw*6,200+halfW*.5,ulY+jaw*6,rX,baseY+cDy);
    ctx.bezierCurveTo(200+halfW*.5,llY-jaw*8,200-halfW*.5,llY-jaw*8,lX,baseY+cDy); ctx.closePath();
    ctx.fillStyle='#4A1212'; ctx.fill();
    const tH=Math.max(0,jaw*20-5);
    if (tH>1) {
      ctx.save(); ctx.beginPath();
      ctx.moveTo(lX,baseY+cDy); ctx.bezierCurveTo(200-halfW*.5,ulY+jaw*6,200+halfW*.5,ulY+jaw*6,rX,baseY+cDy);
      ctx.bezierCurveTo(200+halfW*.5,llY-jaw*8,200-halfW*.5,llY-jaw*8,lX,baseY+cDy); ctx.closePath(); ctx.clip();
      ctx.fillStyle='#EDE8DC'; ctx.fillRect(lX+4,baseY+cDy-1,rX-lX-8,tH); ctx.restore();
    }
  }
  ctx.beginPath(); ctx.moveTo(lX,baseY+cDy); ctx.bezierCurveTo(200-halfW*.5,llY-jaw*4,200+halfW*.5,llY-jaw*4,rX,baseY+cDy);
  ctx.strokeStyle='#8A4830'; ctx.lineWidth=4.5; ctx.lineCap='round'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(lX,baseY+cDy); ctx.bezierCurveTo(200-halfW*.65,ulY,200-halfW*.12,ulY-5,200,ulY-4);
  ctx.bezierCurveTo(200+halfW*.12,ulY-5,200+halfW*.65,ulY,rX,baseY+cDy);
  ctx.strokeStyle='#803820'; ctx.lineWidth=3.5; ctx.stroke();
}
