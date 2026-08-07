'use client';

import { type VisemeBlends } from '@/lib/viseme';

interface Props {
  blends: VisemeBlends;
  size?: number;
  className?: string;
}

export default function VisemeMouth({ blends, size = 120, className }: Props) {
  const CX = 60, CY = 50;

  // ── Parameter extraction ───────────────────────────────────────────────────
  const jawOpen    = blends.jawOpen;
  const stretch    = (blends.mouthStretchLeft + blends.mouthStretchRight) / 2;
  const pucker     = (blends.mouthFunnel + blends.mouthPucker) / 2;
  const smile      = (blends.mouthSmileLeft + blends.mouthSmileRight) / 2;
  const frown      = (blends.mouthFrownLeft + blends.mouthFrownRight) / 2;
  const press      = (blends.mouthPressLeft + blends.mouthPressRight) / 2;
  const cheek      = blends.cheekPuff;
  const tongue     = blends.tongueOut;
  const tongueUp   = blends.tongueUp;

  // Newly covered parameters
  const rollLower  = blends.mouthRollLower;   // lower lip rolls inward
  const rollUpper  = blends.mouthRollUpper;   // upper lip rolls inward
  const shrugLower = blends.mouthShrugLower;  // lower lip pushes up
  const shrugUpper = blends.mouthShrugUpper;  // upper lip rises
  const dimpleL    = blends.mouthDimpleLeft;
  const dimpleR    = blends.mouthDimpleRight;
  const upL        = blends.mouthUpperUpLeft;
  const upR        = blends.mouthUpperUpRight;
  const downL      = blends.mouthLowerDownLeft;
  const downR      = blends.mouthLowerDownRight;
  const sneerL     = blends.noseSneerLeft;
  const sneerR     = blends.noseSneerRight;

  // ── Geometry ───────────────────────────────────────────────────────────────
  const halfW      = Math.max(6, 16 + stretch * 10 - pucker * 8);
  const gap        = jawOpen * 18;
  const cornerLift = smile * 5 - frown * 3;

  const lx = CX - halfW;
  const rx = CX + halfW;

  // Upper lip Y — shrugUpper pulls it up, rollUpper tucks it in (reduces visual height)
  const upperCtrlY = CY - gap / 2 - cornerLift - 4 - pucker * 3
    - (upL + upR) / 2 * 2    // asymmetric upper lift averages to a centre pull
    - shrugUpper * 2;

  // Lower lip Y — shrugLower pushes it up, rollLower tucks it in
  const lowerCtrlY = CY + gap / 2 + 3
    + (downL + downR) / 2 * 2
    + shrugLower * 1.5;

  const cornerY    = CY - cornerLift;
  const mouthOpen  = gap > 2;

  // Lip stroke widths widen on roll (lip volume visual)
  const upperStroke = 3 + rollUpper * 1.5;
  const lowerStroke = 3 + rollLower * 1.5;

  // Lip colours darken when pressed, lighten when rolled
  const upperLipHue = rollUpper > 0.25 ? '#e2c0b8' : '#cbd5e1';
  const lowerLipHue = rollLower > 0.25 ? '#e2c0b8' : '#94a3b8';

  // Corner Y asymmetry for upL/upR and downL/downR
  const cornerYL = cornerY - upL * 2 - downL * 1.5;
  const cornerYR = cornerY - upR * 2 - downR * 1.5;

  const upperPath = `M ${lx} ${cornerYL} Q ${CX} ${upperCtrlY} ${rx} ${cornerYR}`;
  const lowerPath = `M ${lx} ${cornerYL} Q ${CX} ${lowerCtrlY} ${rx} ${cornerYR}`;

  // Tongue position
  const tongueCX = CX + (blends.tongueLeft - blends.tongueRight) * 3;
  const tongueCY = CY + gap / 2 - 1 - tongueUp * 5;

  return (
    <svg
      viewBox="0 0 120 90"
      width={size}
      height={size * 0.75}
      className={className}
      aria-hidden="true"
    >
      {/* Face */}
      <ellipse cx="60" cy="45" rx="54" ry="39" fill="#0f172a" stroke="#1e293b" strokeWidth="1.5" />

      {/* Nose sneer — nostril widening */}
      {(sneerL > 0.2 || sneerR > 0.2) && (
        <>
          {sneerL > 0.2 && (
            <ellipse
              cx="46" cy="32"
              rx={2 + sneerL * 3} ry={1.5 + sneerL * 1.5}
              fill="none" stroke="#64748b" strokeWidth="1" opacity={sneerL * 0.7}
            />
          )}
          {sneerR > 0.2 && (
            <ellipse
              cx="74" cy="32"
              rx={2 + sneerR * 3} ry={1.5 + sneerR * 1.5}
              fill="none" stroke="#64748b" strokeWidth="1" opacity={sneerR * 0.7}
            />
          )}
        </>
      )}

      {/* Cheek puff */}
      {cheek > 0.15 && (
        <>
          <ellipse cx="18" cy="50" rx={5 + cheek * 7} ry={3 + cheek * 4} fill="#1e293b" opacity={cheek * 0.7} />
          <ellipse cx="102" cy="50" rx={5 + cheek * 7} ry={3 + cheek * 4} fill="#1e293b" opacity={cheek * 0.7} />
        </>
      )}

      {/* Mouth cavity */}
      {mouthOpen && (
        <path
          d={`M ${lx} ${cornerYL} Q ${CX} ${upperCtrlY} ${rx} ${cornerYR} Q ${CX} ${lowerCtrlY} Z`}
          fill="#030712"
        />
      )}

      {/* Tongue */}
      {mouthOpen && (tongue > 0.2 || tongueUp > 0.4) && (
        <ellipse
          cx={tongueCX}
          cy={tongueCY}
          rx={Math.max(2, 5 - blends.tongueSquish * 2)}
          ry={3 + tongue * 4}
          fill="#be185d"
          opacity={0.9}
        />
      )}

      {/* Lower lip */}
      <path
        d={lowerPath}
        fill="none"
        stroke={lowerLipHue}
        strokeWidth={lowerStroke}
        strokeLinecap="round"
      />
      {/* Upper lip */}
      <path
        d={upperPath}
        fill="none"
        stroke={upperLipHue}
        strokeWidth={upperStroke}
        strokeLinecap="round"
      />

      {/* Dimples — small dots that appear at the corners during wide smiles */}
      {dimpleL > 0.3 && (
        <circle cx={lx - 3} cy={cornerYL} r={1.5 + dimpleL} fill="#334155" opacity={dimpleL * 0.8} />
      )}
      {dimpleR > 0.3 && (
        <circle cx={rx + 3} cy={cornerYR} r={1.5 + dimpleR} fill="#334155" opacity={dimpleR * 0.8} />
      )}

      {/* Bilabial press — solid bar across closed lips */}
      {press > 0.35 && gap < 2 && (
        <line
          x1={lx + 3} y1={cornerY}
          x2={rx - 3} y2={cornerY}
          stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"
        />
      )}

      {/* Lip roll indicators — thin inner edge lines when lips curl inward */}
      {rollLower > 0.3 && (
        <path
          d={`M ${lx + 2} ${cornerYL + 1} Q ${CX} ${lowerCtrlY - 2} ${rx - 2} ${cornerYR + 1}`}
          fill="none" stroke="#1e40af" strokeWidth="1" opacity={rollLower * 0.6} strokeLinecap="round"
        />
      )}
      {rollUpper > 0.3 && (
        <path
          d={`M ${lx + 2} ${cornerYL - 1} Q ${CX} ${upperCtrlY + 2} ${rx - 2} ${cornerYR - 1}`}
          fill="none" stroke="#1e40af" strokeWidth="1" opacity={rollUpper * 0.6} strokeLinecap="round"
        />
      )}
    </svg>
  );
}
