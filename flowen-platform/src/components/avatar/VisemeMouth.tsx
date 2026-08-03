'use client';

import { type VisemeBlends } from '@/lib/viseme';

interface Props {
  blends: VisemeBlends;
  size?: number;
  className?: string;
}

export default function VisemeMouth({ blends, size = 120, className }: Props) {
  const CX = 60, CY = 50;

  const jawOpen  = blends.jawOpen;
  const stretch  = (blends.mouthStretchLeft + blends.mouthStretchRight) / 2;
  const pucker   = (blends.mouthFunnel + blends.mouthPucker) / 2;
  const smile    = (blends.mouthSmileLeft + blends.mouthSmileRight) / 2;
  const frown    = (blends.mouthFrownLeft + blends.mouthFrownRight) / 2;
  const press    = (blends.mouthPressLeft + blends.mouthPressRight) / 2;
  const cheek    = blends.cheekPuff;
  const tongue   = blends.tongueOut;
  const tongueUp = blends.tongueUp;

  const halfW     = Math.max(6, 16 + stretch * 10 - pucker * 8);
  const gap       = jawOpen * 18;
  const cornerLift = smile * 5 - frown * 3;

  const lx = CX - halfW, rx = CX + halfW;
  const upperCtrlY = CY - gap / 2 - cornerLift - 4 - pucker * 3;
  const lowerCtrlY = CY + gap / 2 + 3;

  const cornerY = CY - cornerLift;
  const upperPath = `M ${lx} ${cornerY} Q ${CX} ${upperCtrlY} ${rx} ${cornerY}`;
  const lowerPath = `M ${lx} ${cornerY} Q ${CX} ${lowerCtrlY} ${rx} ${cornerY}`;
  const mouthOpen = gap > 2;

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
          d={`M ${lx} ${cornerY} Q ${CX} ${upperCtrlY} ${rx} ${cornerY} Q ${CX} ${lowerCtrlY} Z`}
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
      <path d={lowerPath} fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      {/* Upper lip */}
      <path d={upperPath} fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />

      {/* Bilabial press */}
      {press > 0.35 && gap < 2 && (
        <line x1={lx + 3} y1={cornerY} x2={rx - 3} y2={cornerY} stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}
