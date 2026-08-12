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

// Webcam resolution we request — needed to preserve 4:3 aspect ratio when
// projecting normalised [0,1] MediaPipe landmarks onto the canvas.
const CAM_W = 640;
const CAM_H = 480;

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
  // Mouth / speech (from VisemeBlends)
  jawOpen:   number;
  smileL:    number; smileR:  number;
  frownL:    number; frownR:  number;
  puckerFunnel: number;
  mouthRollLower: number; mouthRollUpper: number;
  mouthShrugLower: number; mouthShrugUpper: number;
  mouthUpperUpL: number; mouthUpperUpR: number;
  mouthLowerDownL: number; mouthLowerDownR: number;
  dimpleL: number; dimpleR: number;
  // Tongue (all 10 ARKit shapes)
  tongueOut: number; tongueUp: number; tongueDown: number;
  tongueLeft: number; tongueRight: number; tongueRoll: number;
  tongueCurlUp: number; tongueBendDown: number;
  tongueFlat: number; tongueSquish: number;
  // Facial structure (from VisemeBlends)
  cheekPuff: number;
  noseSneerL: number; noseSneerR: number;
  // Eyes (from ExtraBlends)
  blinkL:    number; blinkR:  number;
  squintL:   number; squintR: number;
  // Brows (from ExtraBlends)
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
      mouthRollLower: 0, mouthRollUpper: 0, mouthShrugLower: 0, mouthShrugUpper: 0,
      mouthUpperUpL: 0, mouthUpperUpR: 0, mouthLowerDownL: 0, mouthLowerDownR: 0,
      dimpleL: 0, dimpleR: 0,
      tongueOut: 0, tongueUp: 0, tongueDown: 0, tongueLeft: 0, tongueRight: 0,
      tongueRoll: 0, tongueCurlUp: 0, tongueBendDown: 0, tongueFlat: 0, tongueSquish: 0,
      cheekPuff: 0, noseSneerL: 0, noseSneerR: 0,
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
        s.jawOpen        = lp(s.jawOpen,        cl(Math.max(b.jawOpen        ?? 0, breath)));
        s.smileL         = lp(s.smileL,         cl(b.mouthSmileLeft          ?? 0));
        s.smileR         = lp(s.smileR,         cl(b.mouthSmileRight         ?? 0));
        s.frownL         = lp(s.frownL,         cl(b.mouthFrownLeft          ?? 0));
        s.frownR         = lp(s.frownR,         cl(b.mouthFrownRight         ?? 0));
        s.puckerFunnel   = lp(s.puckerFunnel,   cl((b.mouthPucker ?? 0) * 0.5 + (b.mouthFunnel ?? 0) * 0.5));
        s.mouthRollLower = lp(s.mouthRollLower, cl(b.mouthRollLower          ?? 0));
        s.mouthRollUpper = lp(s.mouthRollUpper, cl(b.mouthRollUpper          ?? 0));
        s.mouthShrugLower = lp(s.mouthShrugLower, cl(b.mouthShrugLower       ?? 0));
        s.mouthShrugUpper = lp(s.mouthShrugUpper, cl(b.mouthShrugUpper       ?? 0));
        s.mouthUpperUpL  = lp(s.mouthUpperUpL,  cl(b.mouthUpperUpLeft        ?? 0));
        s.mouthUpperUpR  = lp(s.mouthUpperUpR,  cl(b.mouthUpperUpRight       ?? 0));
        s.mouthLowerDownL = lp(s.mouthLowerDownL, cl(b.mouthLowerDownLeft    ?? 0));
        s.mouthLowerDownR = lp(s.mouthLowerDownR, cl(b.mouthLowerDownRight   ?? 0));
        s.dimpleL        = lp(s.dimpleL,        cl(b.mouthDimpleLeft         ?? 0));
        s.dimpleR        = lp(s.dimpleR,        cl(b.mouthDimpleRight        ?? 0));
        // Tongue — fast lerp for snappy response to speech
        const TLP = 0.28;
        const tlp = (a: number, tgt: number) => a + (tgt - a) * TLP;
        s.tongueOut      = tlp(s.tongueOut,      cl(b.tongueOut     ?? 0));
        s.tongueUp       = tlp(s.tongueUp,       cl(b.tongueUp      ?? 0));
        s.tongueDown     = tlp(s.tongueDown,      cl(b.tongueDown    ?? 0));
        s.tongueLeft     = tlp(s.tongueLeft,     cl(b.tongueLeft    ?? 0));
        s.tongueRight    = tlp(s.tongueRight,    cl(b.tongueRight   ?? 0));
        s.tongueRoll     = tlp(s.tongueRoll,     cl(b.tongueRoll    ?? 0));
        s.tongueCurlUp   = tlp(s.tongueCurlUp,  cl(b.tongueCurlUp  ?? 0));
        s.tongueBendDown = tlp(s.tongueBendDown, cl(b.tongueBendDown ?? 0));
        s.tongueFlat     = tlp(s.tongueFlat,     cl(b.tongueFlat    ?? 0));
        s.tongueSquish   = tlp(s.tongueSquish,   cl(b.tongueSquish  ?? 0));
        // Facial structure
        s.cheekPuff  = lp(s.cheekPuff,  cl(b.cheekPuff       ?? 0));
        s.noseSneerL = lp(s.noseSneerL, cl(b.noseSneerLeft   ?? 0));
        s.noseSneerR = lp(s.noseSneerR, cl(b.noseSneerRight  ?? 0));
        // Eyes
        s.blinkL  = lp(s.blinkL,  cl(ex.eyeBlinkLeft    || autoBlink));
        s.blinkR  = lp(s.blinkR,  cl(ex.eyeBlinkRight   || autoBlink));
        s.squintL = lp(s.squintL, cl(ex.eyeSquintLeft   ?? 0));
        s.squintR = lp(s.squintR, cl(ex.eyeSquintRight  ?? 0));
        // Brows
        s.browDownL  = lp(s.browDownL,  cl(ex.browDownLeft    ?? 0));
        s.browDownR  = lp(s.browDownR,  cl(ex.browDownRight   ?? 0));
        s.browInner  = lp(s.browInner,  cl(ex.browInnerUp     ?? 0));
        s.browOuterL = lp(s.browOuterL, cl(ex.browOuterUpLeft ?? 0));
        s.browOuterR = lp(s.browOuterR, cl(ex.browOuterUpRight ?? 0));
        // Iris look direction from eye look blends (average L+R)
        s.lookX = lp(s.lookX, cl(0.5 + (ex.eyeLookOutLeft  - ex.eyeLookInLeft)  * 0.5));
        s.lookY = lp(s.lookY, cl(0.5 + (ex.eyeLookDownLeft - ex.eyeLookUpLeft)  * 0.5));
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

  const px = (i: number) => ox + (landmarks[i]?.x ?? 0.5) * CAM_W * scale;
  const py = (i: number) => oy + (landmarks[i]?.y ?? 0.5) * CAM_H * scale;

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

  // Head yaw / pitch / roll are already encoded in the raw landmark positions —
  // MediaPipe moves every point as the user moves their head. Applying a separate
  // canvas transform on top would double the effect. We project landmarks directly.
  const px = (lm: FaceLandmark) => ox + lm.x * CAM_W * scale;
  const py = (lm: FaceLandmark) => oy + lm.y * CAM_H * scale;
  const lm  = (i: number) => landmarks[i] ?? { x: 0.5, y: 0.5, z: 0 };

  // ── Face oval fill ───────────────────────────────────────────────────────
  // Face oval fill — gradient from key-light at nose bridge outward.
  // Use face-oval x-span in canvas pixels for gradient radius so it always covers the face.
  const faceSpanPx = (Math.max(...FACE_OVAL.map(i => landmarks[i]?.x ?? 0.5)) -
                      Math.min(...FACE_OVAL.map(i => landmarks[i]?.x ?? 0.5))) * CAM_W * scale;
  const faceGrad = ctx.createRadialGradient(
    px(lm(168)) - 12, py(lm(168)) - 18, 8,
    px(lm(168)),      py(lm(168)),       faceSpanPx * 0.75,
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

  // ── Structural depth overlays (on top of face fill, before features) ────────

  // Jawline drop shadow under chin
  const chin = lm(152);
  const chinG = ctx.createRadialGradient(px(chin), py(chin) + scale * 2, 0, px(chin), py(chin) + scale * 4, scale * 45);
  chinG.addColorStop(0, 'rgba(40,18,6,0.42)');
  chinG.addColorStop(1, 'rgba(40,18,6,0)');
  ctx.beginPath();
  ctx.ellipse(px(chin), py(chin) + scale * 3, scale * 44, scale * 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = chinG;
  ctx.fill();

  // Temple hollows (sides of forehead)
  for (const [ti, sign] of [[234, -1], [454, 1]] as [number, number][]) {
    const t = lm(ti);
    const tg = ctx.createRadialGradient(px(t) + sign * scale * 4, py(t) - scale * 8, 0, px(t), py(t) - scale * 6, scale * 26);
    tg.addColorStop(0, 'rgba(50,24,8,0.28)');
    tg.addColorStop(1, 'rgba(50,24,8,0)');
    ctx.beginPath();
    ctx.ellipse(px(t) + sign * scale * 3, py(t) - scale * 8, scale * 20, scale * 32, 0, 0, Math.PI * 2);
    ctx.fillStyle = tg;
    ctx.fill();
  }

  // Under-eye shadows (subtle orbital depth)
  for (const [outerIdx, innerIdx] of [[33, 133], [263, 362]] as [number, number][]) {
    const eo = lm(outerIdx), ei = lm(innerIdx);
    const emx = (px(eo) + px(ei)) / 2, emy = (py(eo) + py(ei)) / 2 + scale * 5;
    ctx.beginPath();
    ctx.ellipse(emx, emy, scale * 20, scale * 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(70,35,12,0.22)';
    ctx.fill();
  }

  // Cheek puff: inflate cheek areas when blowing air (b-p-m sounds)
  if (s.cheekPuff > 0.04) {
    for (const [ci, angle] of [[50, -0.15], [280, 0.15]] as [number, number][]) {
      const c = lm(ci);
      const puffR = scale * 22 * (1 + s.cheekPuff * 0.55);
      const puffG = ctx.createRadialGradient(px(c), py(c), 0, px(c), py(c), puffR);
      puffG.addColorStop(0, `rgba(220,140,90,${s.cheekPuff * 0.25})`);
      puffG.addColorStop(1, 'rgba(220,140,90,0)');
      ctx.beginPath();
      ctx.ellipse(px(c), py(c), puffR, puffR * 0.7, angle, 0, Math.PI * 2);
      ctx.fillStyle = puffG;
      ctx.fill();
    }
  }

  // Nasolabial fold shadows (nose-to-mouth crease; deepens with smiling)
  const smile = (s.smileL + s.smileR) / 2;
  const foldAlpha = 0.12 + smile * 0.35;
  for (const [nlBase, corner, sign] of [[129, 61, -1], [358, 291, 1]] as [number, number, number][]) {
    const base = lm(nlBase), mc = lm(corner);
    ctx.beginPath();
    ctx.moveTo(px(base) + sign * scale * 2, py(base) + scale * 2);
    ctx.bezierCurveTo(
      px(base) + sign * scale * 5, py(base) + scale * 10,
      px(mc)   + sign * scale * 4, py(mc)   - scale * 5,
      px(mc),                       py(mc),
    );
    ctx.strokeStyle = `rgba(120,55,20,${foldAlpha})`;
    ctx.lineWidth = scale * 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Philtrum (vertical groove above upper lip)
  const ph = lm(164);  // philtrum base point between nose and lip
  const phG = ctx.createLinearGradient(px(ph) - scale * 6, 0, px(ph) + scale * 6, 0);
  phG.addColorStop(0, 'rgba(90,40,12,0)');
  phG.addColorStop(0.5, 'rgba(90,40,12,0.20)');
  phG.addColorStop(1, 'rgba(90,40,12,0)');
  ctx.beginPath();
  ctx.ellipse(px(ph), py(ph), scale * 5.5, scale * 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = phG;
  ctx.fill();

  // Cheek blush (warmer when cheek squint / cheekPuff active)
  const blushAlpha = 0.09 + (s.cheekPuff + s.squintL + s.squintR) * 0.05;
  ctx.beginPath();
  ctx.ellipse(px(lm(50)), py(lm(50)), scale * 24, scale * 14, -0.15, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(210,90,70,${blushAlpha})`;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(px(lm(280)), py(lm(280)), scale * 24, scale * 14, 0.15, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(210,90,70,${blushAlpha})`;
  ctx.fill();

  // ── Eyebrows ─────────────────────────────────────────────────────────────
  drawBrow(ctx, L_BROW, landmarks, px, py, scale, s.browDownL, s.browInner, s.browOuterL, false);
  drawBrow(ctx, R_BROW, landmarks, px, py, scale, s.browDownR, s.browInner, s.browOuterR, true);

  // ── Eyes ─────────────────────────────────────────────────────────────────
  drawLandmarkEye(ctx, L_EYE_UPPER, L_EYE_LOWER, L_IRIS, landmarks, px, py, scale, s.blinkL, s.squintL, s.lookX, s.lookY, false);
  drawLandmarkEye(ctx, R_EYE_UPPER, R_EYE_LOWER, R_IRIS, landmarks, px, py, scale, s.blinkR, s.squintR, s.lookX, s.lookY, true);

  // ── Nose ─────────────────────────────────────────────────────────────────
  drawLandmarkNose(ctx, landmarks, px, py, scale, s);

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
  // Convert normalised coords to camera pixels then scale to canvas,
  // using the smaller axis scale so the face fits without cropping.
  // This preserves the actual 4:3 camera aspect ratio instead of distorting.
  const scale = Math.min(
    (0.80 * W) / (faceW * CAM_W),
    (0.86 * H) / (faceH * CAM_H),
  );
  // Centre the face oval at 44% down the canvas (gives chin room below).
  const ox = W / 2 - faceCx * CAM_W * scale;
  const oy = H * 0.44 - faceCy * CAM_H * scale;
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
  ctx:       CanvasRenderingContext2D,
  landmarks: FaceLandmark[],
  px: (lm: FaceLandmark) => number,
  py: (lm: FaceLandmark) => number,
  scale:  number,
  s:      AvatarState,
) {
  const lm = (i: number) => landmarks[i] ?? { x: 0.5, y: 0.5, z: 0 };

  // ── Bridge highlight ────────────────────────────────────────────────────
  // Nose bridge: landmarks 168 → 6 → 197 → 195 → 5 → 4 (top→tip)
  const bridgePts = [168, 6, 197, 195, 5].map(i => lm(i));
  ctx.beginPath();
  ctx.moveTo(px(bridgePts[0]) - scale * 1.5, py(bridgePts[0]));
  bridgePts.slice(1).forEach(l => ctx.lineTo(px(l) - scale * 1.5, py(l)));
  ctx.strokeStyle = 'rgba(240,190,130,0.32)';
  ctx.lineWidth = scale * 4.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Bridge shadow (opposite side)
  ctx.beginPath();
  ctx.moveTo(px(bridgePts[0]) + scale * 3.5, py(bridgePts[0]));
  bridgePts.slice(1).forEach(l => ctx.lineTo(px(l) + scale * 3.5, py(l)));
  ctx.strokeStyle = 'rgba(80,35,10,0.22)';
  ctx.lineWidth = scale * 3;
  ctx.stroke();

  // ── Nose tip shadow ─────────────────────────────────────────────────────
  const tip = lm(4);
  ctx.beginPath();
  ctx.ellipse(px(tip), py(tip) + scale * 4, scale * 10, scale * 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(120,55,20,0.32)';
  ctx.fill();

  // Tip highlight dot
  ctx.beginPath();
  ctx.arc(px(tip) - scale * 2.5, py(tip) - scale * 1, scale * 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(240,185,120,0.30)';
  ctx.fill();

  // ── Ala (nostril wing) shadows — widen with noseSneer ────────────────────
  const alaData: [number, number, number][] = [
    [102, -0.28, s.noseSneerL],
    [331,  0.28, s.noseSneerR],
  ];
  for (const [i, angle, sneer] of alaData) {
    const nl = lm(i);
    const sw = 1 + sneer * 0.4;
    ctx.beginPath();
    ctx.ellipse(px(nl), py(nl), scale * 6 * sw, scale * 4.5, angle, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,35,12,${0.48 + sneer * 0.22})`;
    ctx.fill();

    // Ala surface highlight
    ctx.beginPath();
    ctx.ellipse(px(nl) - scale * 1.5, py(nl) - scale * 1.5, scale * 3.5 * sw, scale * 2.5, angle, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,150,80,0.18)';
    ctx.fill();
  }

  // ── Philtrum ridge highlights (columns running nose-to-lip) ─────────────
  // Landmarks 2 (subnasale) to 164 (between columns)
  const sub = lm(2), phl = lm(164);
  for (const offX of [-scale * 3.5, scale * 3.5]) {
    const grad = ctx.createLinearGradient(0, py(sub), 0, py(phl));
    grad.addColorStop(0, 'rgba(220,150,80,0.22)');
    grad.addColorStop(1, 'rgba(220,150,80,0)');
    ctx.beginPath();
    ctx.moveTo(px(sub) + offX * 0.6, py(sub));
    ctx.lineTo(px(phl) + offX, py(phl));
    ctx.strokeStyle = grad;
    ctx.lineWidth = scale * 1.8;
    ctx.stroke();
  }
}

function drawLandmarkMouth(
  ctx:       CanvasRenderingContext2D,
  landmarks: FaceLandmark[],
  px: (lm: FaceLandmark) => number,
  py: (lm: FaceLandmark) => number,
  scale:  number,
  s:      AvatarState,
) {
  const lm = (i: number) => landmarks[i] ?? { x: 0.5, y: 0.5, z: 0 };

  // ── Key landmarks ──────────────────────────────────────────────────────────
  const cornerL  = lm(61),   cornerR  = lm(291);  // mouth corners
  const ui13     = lm(13),   li14     = lm(14);   // upper/lower inner centre
  const ui78     = lm(78),   ui308    = lm(308);  // upper inner L/R
  const li95     = lm(95),   li324    = lm(324);  // lower inner L/R
  const topLip   = lm(0);                          // Cupid's bow top
  const botLip   = lm(17);                         // lower lip bottom

  const clX = px(cornerL), clY = py(cornerL);
  const crX = px(cornerR), crY = py(cornerR);

  // Opening in canvas pixels (landmark-based; fall back to jawOpen blend)
  const upperInnerY = (py(ui13) + py(ui78) + py(ui308)) / 3;
  const lowerInnerY = (py(li14) + py(li95) + py(li324)) / 3;
  const openingY    = Math.max(0, lowerInnerY - upperInnerY);
  const isOpen      = openingY > scale * 2;

  // ── Mouth cavity ───────────────────────────────────────────────────────────
  if (isOpen) {
    drawContour(ctx, LIPS_INNER, landmarks, px, py, true);
    const mCx = (clX + crX) / 2;
    const mCy = (upperInnerY + lowerInnerY) / 2;
    const mR  = Math.max(crX - clX, openingY) * 0.65;
    const cavG = ctx.createRadialGradient(mCx, mCy - openingY * 0.1, 0, mCx, mCy, mR);
    cavG.addColorStop(0,   '#280606');
    cavG.addColorStop(0.45, '#3A0C0C');
    cavG.addColorStop(1,   '#4A1616');
    ctx.fillStyle = cavG;
    ctx.fill();

    // ── Tongue ──────────────────────────────────────────────────────────────
    const showTongue = s.tongueOut > 0.04 || s.tongueUp > 0.22 || s.tongueFlat > 0.2;
    if (showTongue) {
      drawTongue(ctx, scale, s, openingY, mCx, upperInnerY, lowerInnerY);
    }

    // ── Upper teeth ──────────────────────────────────────────────────────────
    const upperTeethW = Math.abs(px(ui308) - px(ui78)) * 0.94;
    const upperTeethH = Math.max(0, openingY * 0.38 - scale * 1.5);
    if (upperTeethH > 0.5 && upperTeethW > 4) {
      const uLeft = Math.min(px(ui78), px(ui308));
      const uTop  = upperInnerY - scale * 0.5;
      // Clip to inner contour so teeth don't bleed outside lips
      ctx.save();
      drawContour(ctx, LIPS_INNER, landmarks, px, py, true);
      ctx.clip();
      drawTeeth(ctx, uLeft, uTop, upperTeethW, upperTeethH, scale, true, mCx);
      ctx.restore();
    }

    // ── Lower teeth (visible when mouth very open) ───────────────────────────
    if (openingY > scale * 14) {
      const lTeethW = Math.abs(px(li324) - px(li95)) * 0.82;
      const lTeethH = Math.max(0, openingY * 0.26 - scale * 2);
      if (lTeethH > 0.5 && lTeethW > 4) {
        const lLeft = Math.min(px(li95), px(li324));
        const lBot  = lowerInnerY + scale * 0.5;
        ctx.save();
        drawContour(ctx, LIPS_INNER, landmarks, px, py, true);
        ctx.clip();
        drawTeeth(ctx, lLeft, lBot - lTeethH, lTeethW, lTeethH, scale, false, mCx);
        ctx.restore();
      }
    }
  }

  // ── Lower lip fill ─────────────────────────────────────────────────────────
  const lowerOuter = LIPS_OUTER.slice(LIPS_OUTER.indexOf(291));
  drawContour(ctx, lowerOuter, landmarks, px, py, false);
  ctx.lineTo(crX, crY);
  ctx.lineTo(clX, clY);
  ctx.closePath();
  const llG = ctx.createLinearGradient(0, crY, 0, py(botLip));
  llG.addColorStop(0,   '#7A3420');
  llG.addColorStop(0.4, '#B05538');
  llG.addColorStop(1,   '#903828');
  ctx.fillStyle = llG;
  ctx.fill();

  // ── Upper lip fill ─────────────────────────────────────────────────────────
  const upperOuter = LIPS_OUTER.slice(0, LIPS_OUTER.indexOf(291) + 1);
  drawContour(ctx, upperOuter, landmarks, px, py, false);
  ctx.lineTo(crX, crY);
  ctx.lineTo(clX, clY);
  ctx.closePath();
  const ulG = ctx.createLinearGradient(0, py(topLip), 0, clY);
  ulG.addColorStop(0,   '#8A3018');
  ulG.addColorStop(0.5, '#A84028');
  ulG.addColorStop(1,   '#7A3020');
  ctx.fillStyle = ulG;
  ctx.fill();

  // ── Lip edge strokes ───────────────────────────────────────────────────────
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // Upper lip edge
  drawContour(ctx, upperOuter, landmarks, px, py, false);
  ctx.strokeStyle = '#5A1E0E';
  ctx.lineWidth   = scale * 1.8;
  ctx.stroke();

  // Lower lip edge
  drawContour(ctx, lowerOuter, landmarks, px, py, false);
  ctx.strokeStyle = '#6A2818';
  ctx.lineWidth   = scale * 1.8;
  ctx.stroke();

  // ── Cupid's bow highlight ──────────────────────────────────────────────────
  const bowX = px(topLip), bowY = py(topLip);
  const bowG = ctx.createRadialGradient(bowX, bowY, 0, bowX, bowY, scale * 10);
  bowG.addColorStop(0, 'rgba(220,135,95,0.55)');
  bowG.addColorStop(1, 'rgba(220,135,95,0)');
  ctx.beginPath();
  ctx.arc(bowX, bowY, scale * 10, 0, Math.PI * 2);
  ctx.fillStyle = bowG;
  ctx.fill();

  // ── Lower lip centre sheen ─────────────────────────────────────────────────
  const llCenter = lm(17);
  const sheenG = ctx.createRadialGradient(px(llCenter) - scale, py(llCenter) - scale, 0, px(llCenter), py(llCenter), scale * 16);
  sheenG.addColorStop(0, 'rgba(200,110,70,0.40)');
  sheenG.addColorStop(1, 'rgba(200,110,70,0)');
  ctx.beginPath();
  ctx.ellipse(px(llCenter), py(llCenter) - scale, scale * 18, scale * 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = sheenG;
  ctx.fill();

  // ── Mouth corners + dimples ────────────────────────────────────────────────
  for (const ci of [61, 291]) {
    const c = landmarks[ci];
    if (!c) continue;
    ctx.beginPath();
    ctx.arc(px(c), py(c), scale * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(90,35,16,0.75)';
    ctx.fill();
  }

  const smile = (s.smileL + s.smileR) / 2;
  const dimple = (s.dimpleL + s.dimpleR) / 2;
  if (smile > 0.12 || dimple > 0.05) {
    for (const di of [207, 427]) {
      const d = landmarks[di];
      if (!d) continue;
      ctx.beginPath();
      ctx.arc(px(d), py(d), scale * 2.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(110,48,20,${Math.min(0.5, (smile + dimple) * 0.35)})`;
      ctx.fill();
    }
  }

  // ── Upper lip roll shadow (mouthRollUpper — lips fold inward) ─────────────
  if (s.mouthRollUpper > 0.1) {
    drawContour(ctx, upperOuter, landmarks, px, py, false);
    ctx.strokeStyle = `rgba(60,20,8,${s.mouthRollUpper * 0.45})`;
    ctx.lineWidth   = scale * 3.5;
    ctx.stroke();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tongue — shape driven by all 10 ARKit tongue blend shapes
// ─────────────────────────────────────────────────────────────────────────────

function drawTongue(
  ctx: CanvasRenderingContext2D,
  scale: number,
  s:     AvatarState,
  openingY: number, midX: number,
  upperInnerY: number, lowerInnerY: number,
) {
  // Direction offsets
  const offX = (s.tongueLeft - s.tongueRight) * scale * 14;

  // Y position: neutral = lower half of opening; tongueUp = near upper gum
  const neutralY  = upperInnerY + openingY * 0.62;
  const uppedY    = upperInnerY + scale * 2.5;
  const tCy = neutralY + (uppedY - neutralY) * s.tongueUp
             + (lowerInnerY - neutralY) * s.tongueDown * 0.4
             - s.tongueOut * openingY * 0.28;
  const tCx = midX + offX;

  // Size
  const rawW = Math.min(openingY * 0.68, scale * 32);
  const tipW = rawW * (
    s.tongueFlat > 0.4 ? 1.15 :
    s.tongueRoll > 0.35 ? 0.38 :
    s.tongueSquish > 0.3 ? 1.05 :
    0.75
  );
  const tipH = Math.min(openingY * 0.52, scale * 26) * (
    s.tongueFlat > 0.4 ? 0.42 :
    s.tongueCurlUp > 0.4 ? 0.75 :
    s.tongueBendDown > 0.4 ? 1.2 :
    0.85
  );

  // Clip tongue to mouth inner contour (don't draw outside lips)
  ctx.save();

  // Gradient: moist pink-red, bright highlight at tip
  const tg = ctx.createRadialGradient(
    tCx - tipW * 0.22, tCy - tipH * 0.35, 0,
    tCx, tCy, Math.max(tipW, tipH),
  );
  tg.addColorStop(0,    '#F47882');
  tg.addColorStop(0.3,  '#E05568');
  tg.addColorStop(0.65, '#C03855');
  tg.addColorStop(1,    '#9C2840');

  ctx.beginPath();
  ctx.ellipse(tCx, tCy, tipW, tipH, 0, 0, Math.PI * 2);
  ctx.fillStyle = tg;
  ctx.fill();

  // Median raphe (central groove running front-to-back)
  ctx.beginPath();
  ctx.moveTo(tCx, tCy - tipH * 0.95);
  ctx.bezierCurveTo(
    tCx, tCy - tipH * 0.4,
    tCx, tCy + tipH * 0.2,
    tCx, tCy + tipH * 0.7,
  );
  ctx.strokeStyle = 'rgba(130,25,38,0.50)';
  ctx.lineWidth = scale * 1.4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Rolled tongue: lateral fold shadows (RR, ER)
  if (s.tongueRoll > 0.12) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(tCx + side * tipW * 0.52, tCy, tipW * 0.24, tipH * 0.55, side * -0.38, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(130,25,38,${s.tongueRoll * 0.55})`;
      ctx.fill();
    }
  }

  // Tip highlight
  const hlG = ctx.createRadialGradient(tCx - tipW * 0.18, tCy - tipH * 0.52, 0, tCx - tipW * 0.18, tCy - tipH * 0.52, tipW * 0.5);
  hlG.addColorStop(0, 'rgba(255,170,175,0.50)');
  hlG.addColorStop(1, 'rgba(255,170,175,0)');
  ctx.beginPath();
  ctx.ellipse(tCx - tipW * 0.15, tCy - tipH * 0.48, tipW * 0.46, tipH * 0.34, 0, 0, Math.PI * 2);
  ctx.fillStyle = hlG;
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Teeth — upper or lower row with gum line, individual tooth detail
// ─────────────────────────────────────────────────────────────────────────────

function drawTeeth(
  ctx:    CanvasRenderingContext2D,
  left:   number, top: number,
  width:  number, height: number,
  scale:  number, upper: boolean, midX: number,
) {
  if (width < 2 || height < 0.5) return;

  const numTeeth = Math.max(4, Math.min(8, Math.round(width / (scale * 5.5))));
  const toothW   = width / numTeeth;

  // Gum (visible above upper teeth / below lower teeth)
  ctx.beginPath();
  if (upper) {
    ctx.roundRect(left - scale * 0.5, top - scale * 3, width + scale, scale * 3.5, scale * 0.5);
    ctx.fillStyle = '#C0505E';
  } else {
    ctx.roundRect(left - scale * 0.5, top + height - scale * 0.5, width + scale, scale * 3.5, scale * 0.5);
    ctx.fillStyle = '#B04858';
  }
  ctx.fill();

  // Tooth row background (ivory)
  ctx.beginPath();
  const radii: [number, number, number, number] = upper
    ? [scale * 1.5, scale * 1.5, 0, 0]
    : [0, 0, scale * 1.5, scale * 1.5];
  ctx.roundRect(left, top, width, height, radii);
  ctx.fillStyle = '#E6E2D6';
  ctx.fill();

  // Individual tooth shading + gaps
  for (let i = 0; i < numTeeth; i++) {
    const tx = left + i * toothW;
    const centerDist = Math.abs((tx + toothW * 0.5) - midX) / (width * 0.5);
    const bevelAlpha = 0.04 + centerDist * 0.07;

    // Left-edge bevel dark
    const bevelG = ctx.createLinearGradient(tx, 0, tx + toothW, 0);
    bevelG.addColorStop(0,   `rgba(0,0,0,${bevelAlpha + 0.03})`);
    bevelG.addColorStop(0.2, 'rgba(0,0,0,0)');
    bevelG.addColorStop(0.8, 'rgba(0,0,0,0)');
    bevelG.addColorStop(1,   `rgba(0,0,0,${bevelAlpha})`);
    ctx.beginPath();
    ctx.roundRect(tx + scale * 0.3, top, toothW - scale * 0.6, height, 1);
    ctx.fillStyle = bevelG;
    ctx.fill();

    // Tooth gap line
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(tx, upper ? top + scale * 1.5 : top);
      ctx.lineTo(tx, upper ? top + height : top + height - scale * 1.5);
      ctx.strokeStyle = 'rgba(140,120,100,0.30)';
      ctx.lineWidth = scale * 0.65;
      ctx.stroke();
    }

    // Mamelons (tiny ridges on incisor edges — upper teeth front row)
    if (upper && i >= 1 && i <= numTeeth - 2 && height > scale * 5) {
      const edgeY = top;
      for (const rx of [tx + toothW * 0.3, tx + toothW * 0.7]) {
        ctx.beginPath();
        ctx.moveTo(rx, edgeY);
        ctx.lineTo(rx, edgeY + scale * 2.5);
        ctx.strokeStyle = 'rgba(170,155,135,0.28)';
        ctx.lineWidth = scale * 0.9;
        ctx.stroke();
      }
    }
  }

  // Root shadow gradient (teeth recede into gum)
  const shadowG = ctx.createLinearGradient(0, upper ? top : top + height,
                                            0, upper ? top + height * 0.55 : top + height * 0.45);
  if (upper) {
    shadowG.addColorStop(0, 'rgba(70,35,18,0.32)');
    shadowG.addColorStop(1, 'rgba(70,35,18,0)');
  } else {
    shadowG.addColorStop(0, 'rgba(70,35,18,0)');
    shadowG.addColorStop(1, 'rgba(70,35,18,0.28)');
  }
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, radii);
  ctx.fillStyle = shadowG;
  ctx.fill();
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
