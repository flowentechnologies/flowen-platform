'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { VisemeBlends } from '@/lib/viseme';
import { ZERO_BLENDS } from '@/lib/viseme';

// ============================================================================
// FaceAvatar — Canvas 2D procedural face driven by 42 ARKit-style blend shapes
//
// No file fetch, no WebGL, no external dependencies beyond React.
// Renders at 60 fps via requestAnimationFrame with smoothed lerp on all values.
// ============================================================================

export interface FaceAvatarHandle {
  /** Live blend shape update — called at ~60 fps, zero re-renders. */
  updateBlends(blends: VisemeBlends, speaking: boolean): void;
}

interface Props {
  blends: VisemeBlends;
  speaking: boolean;
}

const W = 400;
const H = 480;
const LERP = 0.22;

interface FaceState {
  jawOpen: number;
  smileL: number; smileR: number;
  frownL: number; frownR: number;
  /** 0 = open, 1 = fully closed */
  blinkL: number; blinkR: number;
  breathT: number;
  /** Autonomous blink cycle phase (seconds) */
  blinkT: number;
}

export const FaceAvatar = forwardRef<FaceAvatarHandle, Props>(
  function FaceAvatar({ blends, speaking }, ref) {
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const blendsRef   = useRef<VisemeBlends>(ZERO_BLENDS);
    const speakingRef = useRef(false);
    const rafRef      = useRef<number>(0);
    const stateRef    = useRef<FaceState>({
      jawOpen: 0, smileL: 0, smileR: 0,
      frownL: 0, frownR: 0,
      blinkL: 0, blinkR: 0,
      breathT: 0, blinkT: 0,
    });

    // Expose live update handle
    useImperativeHandle(ref, () => ({
      updateBlends(b: VisemeBlends, sp: boolean) {
        blendsRef.current  = b;
        speakingRef.current = sp;
      },
    }), []);

    // Sync props → refs (for non-imperative callers)
    useEffect(() => {
      blendsRef.current  = blends;
      speakingRef.current = speaking;
    }, [blends, speaking]);

    // Animation loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let lastT = performance.now();
      const lp = (a: number, b: number) => a + (b - a) * LERP;
      const cl = (v: number) => Math.max(0, Math.min(1, v));

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const now = performance.now();
        const dt  = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;

        const b   = blendsRef.current;
        const isSpeaking = speakingRef.current;
        const s   = stateRef.current;

        // Idle breath on jaw when silent
        s.breathT += dt * 0.85;
        const breath = isSpeaking ? 0 : 0.038 * (0.5 + 0.5 * Math.sin(s.breathT));

        s.jawOpen = lp(s.jawOpen, cl(Math.max(b.jawOpen        ?? 0, breath)));
        s.smileL  = lp(s.smileL,  cl(b.mouthSmileLeft          ?? 0));
        s.smileR  = lp(s.smileR,  cl(b.mouthSmileRight         ?? 0));
        s.frownL  = lp(s.frownL,  cl(b.mouthFrownLeft          ?? 0));
        s.frownR  = lp(s.frownR,  cl(b.mouthFrownRight         ?? 0));

        // Autonomous blink every ~4 s (quick 120 ms close+open)
        s.blinkT += dt;
        const blinkPeriod = 4.2;
        const blinkDur    = 0.12; // seconds to fully close
        const phase = s.blinkT % blinkPeriod;
        const blinkVal = phase < blinkDur
          ? Math.sin((phase / blinkDur) * Math.PI)   // 0 → 1 → 0 in blinkDur s
          : 0;
        s.blinkL = blinkVal;
        s.blinkR = blinkVal;

        drawFace(ctx, s);
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(rafRef.current); };
    }, []);

    return (
      <div
        role="figure"
        aria-label="Speech therapy biofeedback avatar — animated lip and facial movements mirror your phoneme articulation"
        style={{
          position:    'relative',
          width:       '100%',
          maxWidth:    W,
          aspectRatio: `${W} / ${H}`,
          background:  '#0d1117',
          display:     'block',
          borderRadius: '1rem',
          overflow:    'hidden',
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

// ── Drawing ──────────────────────────────────────────────────────────────────

function drawFace(ctx: CanvasRenderingContext2D, s: FaceState) {
  // Background
  ctx.clearRect(0, 0, W, H);
  const bgGrad = ctx.createRadialGradient(200, 260, 20, 200, 240, 290);
  bgGrad.addColorStop(0, '#131c2b');
  bgGrad.addColorStop(1, '#0d1117');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── Neck ───────────────────────────────────────────────────────────────────
  // Trapezoid + rounded bottom
  ctx.beginPath();
  ctx.moveTo(168, 352);
  ctx.lineTo(232, 352);
  ctx.lineTo(245, 480);
  ctx.lineTo(155, 480);
  ctx.closePath();
  ctx.fillStyle = '#C49060';
  ctx.fill();

  // ── Face ellipse ───────────────────────────────────────────────────────────
  const faceGrad = ctx.createRadialGradient(185, 195, 22, 200, 230, 162);
  faceGrad.addColorStop(0,    '#ECC088');
  faceGrad.addColorStop(0.5,  '#D4A06A');
  faceGrad.addColorStop(0.85, '#BB8448');
  faceGrad.addColorStop(1,    '#A07038');
  ctx.beginPath();
  ctx.ellipse(200, 232, 114, 152, 0, 0, Math.PI * 2);
  ctx.fillStyle = faceGrad;
  ctx.fill();

  // ── Hair ───────────────────────────────────────────────────────────────────
  ctx.save();
  // Clip to face ellipse so hair doesn't bleed out of head shape at sides
  ctx.beginPath();
  ctx.ellipse(200, 232, 114, 152, 0, 0, Math.PI * 2);
  ctx.clip();
  // Hair cap — covers top ~40 % of face
  ctx.beginPath();
  ctx.ellipse(200, 108, 120, 82, 0, Math.PI, 2 * Math.PI); // semicircle on top
  ctx.fillStyle = '#231108';
  ctx.fill();
  ctx.restore();

  // Side hair bumps (outside face clip, natural-looking)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(88, 195, 16, 62, Math.PI * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#231108';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(312, 195, 16, 62, -Math.PI * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#231108';
  ctx.fill();
  ctx.restore();

  // ── Subtle cheek blush ─────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.ellipse(144, 278, 24, 13, -0.1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(218, 100, 80, 0.13)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(256, 278, 24, 13, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(218, 100, 80, 0.13)';
  ctx.fill();

  // ── Eyebrows (neutral arch — no blend-shape control, speech doesn't drive brows) ──
  const browY = 185;

  // Left brow — natural arch
  ctx.beginPath();
  ctx.moveTo(142, browY);
  ctx.quadraticCurveTo(166, browY - 10, 194, browY);
  ctx.strokeStyle = '#2A1006';
  ctx.lineWidth   = 5.5;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Right brow
  ctx.beginPath();
  ctx.moveTo(206, browY);
  ctx.quadraticCurveTo(234, browY - 10, 258, browY);
  ctx.strokeStyle = '#2A1006';
  ctx.lineWidth   = 5.5;
  ctx.stroke();

  // ── Eyes ───────────────────────────────────────────────────────────────────
  drawEye(ctx, 162, 214, false, s.blinkL);
  drawEye(ctx, 238, 214, true,  s.blinkR);

  // ── Nose ───────────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(200, 237);
  ctx.quadraticCurveTo(196, 256, 184, 265);
  ctx.quadraticCurveTo(200, 271, 216, 265);
  ctx.quadraticCurveTo(204, 256, 200, 237);
  ctx.fillStyle = '#C49060';
  ctx.fill();

  // Nostrils
  ctx.beginPath();
  ctx.ellipse(187, 266, 6.5, 4, -0.18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(100, 55, 20, 0.55)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(213, 266, 6.5, 4, 0.18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(100, 55, 20, 0.55)';
  ctx.fill();

  // ── Mouth ─────────────────────────────────────────────────────────────────
  drawMouth(ctx, s);
}

// ── Eye ──────────────────────────────────────────────────────────────────────

function drawEye(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  _isRight: boolean,
  blink: number,
) {
  const ew = 30;  // half-width
  const eh = 17;  // half-height (open)

  // Sclera
  ctx.beginPath();
  ctx.ellipse(cx, cy, ew, eh, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#F3EDE5';
  ctx.fill();

  // Iris
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#4A2E14';
  ctx.fill();

  // Pupil
  ctx.beginPath();
  ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = '#0e0908';
  ctx.fill();

  // Specular
  ctx.beginPath();
  ctx.arc(cx + 4, cy - 3.5, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fill();

  // Eyelid close (skin covers eye from top)
  if (blink > 0.01) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, ew + 1, eh + 1, 0, 0, Math.PI * 2);
    ctx.clip();
    const lidH = (eh * 2 + 2) * blink;
    ctx.fillStyle = '#D4A06A';
    ctx.fillRect(cx - ew - 1, cy - eh - 1, (ew + 1) * 2, lidH);
    ctx.restore();
  }

  // Top eyelash / lid edge
  ctx.beginPath();
  ctx.moveTo(cx - ew, cy - 3);
  ctx.quadraticCurveTo(cx, cy - eh - 4, cx + ew, cy - 3);
  ctx.strokeStyle = '#180A04';
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Bottom lash line (subtle)
  ctx.beginPath();
  ctx.moveTo(cx - ew + 4, cy + 4);
  ctx.quadraticCurveTo(cx, cy + eh + 2, cx + ew - 4, cy + 4);
  ctx.strokeStyle = 'rgba(30,12,4,0.5)';
  ctx.lineWidth   = 1.8;
  ctx.stroke();
}

// ── Mouth ─────────────────────────────────────────────────────────────────────

function drawMouth(ctx: CanvasRenderingContext2D, s: FaceState) {
  const baseY   = 308;
  const halfW   = 46;
  const smile   = (s.smileL + s.smileR) / 2;
  const frown   = (s.frownL + s.frownR) / 2;
  const jaw     = s.jawOpen;

  // Corner Y: smile lifts corners, frown drops them
  const cornerDy = smile * 14 - frown * 9;
  // Corner X spread when smiling
  const cornerDx = smile * 5;

  const leftX  = 200 - halfW - cornerDx;
  const rightX = 200 + halfW + cornerDx;
  const midY   = baseY;

  // Upper lip arc rises with jaw, corners follow smile
  const ulY    = baseY - 4 - jaw * 10;
  // Lower lip drops with jaw
  const llY    = baseY + 8 + jaw * 32;

  // ── Interior (dark) when jaw opens ────────────────────────────────────────
  if (jaw > 0.02) {
    ctx.beginPath();
    // Top arc of opening
    ctx.moveTo(leftX,  midY + cornerDy);
    ctx.bezierCurveTo(
      200 - halfW * 0.5, ulY + jaw * 6,
      200 + halfW * 0.5, ulY + jaw * 6,
      rightX, midY + cornerDy,
    );
    // Bottom arc
    ctx.bezierCurveTo(
      200 + halfW * 0.5, llY - jaw * 8,
      200 - halfW * 0.5, llY - jaw * 8,
      leftX, midY + cornerDy,
    );
    ctx.closePath();
    ctx.fillStyle = '#4A1212';
    ctx.fill();

    // Upper teeth row
    const teethH = Math.max(0, jaw * 20 - 5);
    if (teethH > 1) {
      ctx.save();
      // Clip to opening so teeth stay inside
      ctx.beginPath();
      ctx.moveTo(leftX,  midY + cornerDy);
      ctx.bezierCurveTo(
        200 - halfW * 0.5, ulY + jaw * 6,
        200 + halfW * 0.5, ulY + jaw * 6,
        rightX, midY + cornerDy,
      );
      ctx.bezierCurveTo(
        200 + halfW * 0.5, llY - jaw * 8,
        200 - halfW * 0.5, llY - jaw * 8,
        leftX, midY + cornerDy,
      );
      ctx.closePath();
      ctx.clip();

      ctx.fillStyle = '#EDE8DC';
      ctx.beginPath();
      ctx.rect(leftX + 4, midY + cornerDy - 1, (rightX - leftX) - 8, teethH);
      ctx.fill();

      // Tooth divider lines
      ctx.strokeStyle = 'rgba(160,140,120,0.35)';
      ctx.lineWidth = 1;
      ctx.lineCap = 'butt';
      for (const xFrac of [-0.4, 0, 0.4]) {
        const tx = 200 + (rightX - leftX) * xFrac * 0.45;
        ctx.beginPath();
        ctx.moveTo(tx, midY + cornerDy);
        ctx.lineTo(tx, midY + cornerDy + teethH);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ── Lower lip ─────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(leftX,  midY + cornerDy);
  ctx.bezierCurveTo(
    200 - halfW * 0.5, llY - jaw * 4,
    200 + halfW * 0.5, llY - jaw * 4,
    rightX, midY + cornerDy,
  );
  ctx.strokeStyle = '#8A4830';
  ctx.lineWidth   = 4.5;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // ── Upper lip (Cupid's bow) ────────────────────────────────────────────────
  // Left half
  ctx.beginPath();
  ctx.moveTo(leftX, midY + cornerDy);
  ctx.bezierCurveTo(
    200 - halfW * 0.65, ulY,
    200 - halfW * 0.12, ulY - 5,
    200, ulY - 4,
  );
  // Right half
  ctx.bezierCurveTo(
    200 + halfW * 0.12, ulY - 5,
    200 + halfW * 0.65, ulY,
    rightX, midY + cornerDy,
  );
  ctx.strokeStyle = '#803820';
  ctx.lineWidth   = 3.5;
  ctx.stroke();

  // Lip fill (upper) — slightly lighter than stroke
  ctx.beginPath();
  ctx.moveTo(leftX, midY + cornerDy);
  ctx.bezierCurveTo(200 - halfW * 0.65, ulY, 200 - halfW * 0.12, ulY - 5, 200, ulY - 4);
  ctx.bezierCurveTo(200 + halfW * 0.12, ulY - 5, 200 + halfW * 0.65, ulY, rightX, midY + cornerDy);
  ctx.lineTo(200, midY + cornerDy + (smile * 3));  // close roughly
  ctx.lineTo(leftX, midY + cornerDy);
  ctx.fillStyle = 'rgba(176,88,56,0.55)';
  ctx.fill();

  // Mouth line (resting line between lips)
  if (jaw < 0.05) {
    const restAlpha = 1 - jaw * 20;
    ctx.beginPath();
    ctx.moveTo(leftX, midY + cornerDy);
    ctx.bezierCurveTo(
      200 - halfW * 0.3, midY + cornerDy + 2 + smile * 3,
      200 + halfW * 0.3, midY + cornerDy + 2 + smile * 3,
      rightX, midY + cornerDy,
    );
    ctx.strokeStyle = `rgba(120,50,25,${restAlpha * 0.7})`;
    ctx.lineWidth   = 2;
    ctx.stroke();
  }
}
