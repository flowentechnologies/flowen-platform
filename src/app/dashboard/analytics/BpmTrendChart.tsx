'use client';

import { useState } from 'react';

export interface TrendPoint {
  sessionNum: number;
  bpm: number;
  date: string;
}

const W = 800;
const H = 220;
const PAD = { top: 24, right: 24, bottom: 36, left: 44 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

function dotColor(bpm: number) {
  if (bpm < 2) return '#10b981';
  if (bpm <= 5) return '#f59e0b';
  return '#ef4444';
}

export function BpmTrendChart({ points }: { points: TrendPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (points.length === 0) return null;

  const maxBpm = Math.max(10, ...points.map(p => p.bpm));
  const yMax = Math.ceil((maxBpm + 1) / 5) * 5;

  const px = (i: number) =>
    PAD.left + (points.length <= 1 ? IW / 2 : (i / (points.length - 1)) * IW);
  const py = (bpm: number) => PAD.top + IH - (bpm / yMax) * IH;

  const rollingAvg = points.map((_, i) => {
    const slice = points.slice(Math.max(0, i - 6), i + 1);
    return slice.reduce((s, p) => s + p.bpm, 0) / slice.length;
  });

  const rawPts = points.map((p, i) => `${px(i)},${py(p.bpm)}`).join(' ');
  const avgPts = rollingAvg.map((avg, i) => `${px(i)},${py(avg)}`).join(' ');

  const labelEvery =
    points.length <= 10 ? 1 : points.length <= 25 ? 5 : points.length <= 60 ? 10 : 20;

  const yTicks = [0, 2, 5, ...(yMax > 10 ? [10] : []), ...(yMax > 15 ? [15] : [])].filter(
    t => t <= yMax,
  );

  const hpt = hovered !== null ? points[hovered] : null;
  const htx = hovered !== null ? px(hovered) : 0;
  const hty = hovered !== null ? py(points[hovered].bpm) : 0;
  const tipLeft = htx > W * 0.72;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ overflow: 'visible' }}
      aria-label="Blocks per minute over time"
    >
      {/* Zone fills */}
      <rect x={PAD.left} y={py(yMax)} width={IW} height={py(5) - py(yMax)} fill="rgba(239,68,68,0.05)" />
      <rect x={PAD.left} y={py(5)} width={IW} height={py(2) - py(5)} fill="rgba(245,158,11,0.05)" />
      <rect x={PAD.left} y={py(2)} width={IW} height={py(0) - py(2)} fill="rgba(16,185,129,0.05)" />

      {/* Grid lines */}
      {yTicks.map(t => (
        <line key={t}
          x1={PAD.left} x2={W - PAD.right} y1={py(t)} y2={py(t)}
          stroke="#1e293b" strokeWidth="1"
          strokeDasharray={t === 0 ? '0' : '4 4'}
        />
      ))}

      {/* Raw line */}
      {points.length > 1 && (
        <polyline points={rawPts} fill="none" stroke="#10b981" strokeWidth="1" strokeOpacity="0.2" />
      )}

      {/* Rolling average line */}
      {points.length > 1 && (
        <polyline
          points={avgPts} fill="none" stroke="#10b981"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
      )}

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={px(i)} cy={py(p.bpm)}
          r={hovered === i ? 5 : 3}
          fill={dotColor(p.bpm)}
          stroke={hovered === i ? '#f8fafc' : 'transparent'}
          strokeWidth="1.5"
          onPointerEnter={() => setHovered(i)}
          onPointerLeave={() => setHovered(null)}
          style={{ cursor: 'crosshair' }}
        />
      ))}

      {/* Hover tooltip */}
      {hpt && (
        <g>
          <line x1={htx} x2={htx} y1={PAD.top} y2={PAD.top + IH}
            stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
          <rect
            x={tipLeft ? htx - 102 : htx + 8}
            y={hty - 30}
            width={94} height={40} rx={6}
            fill="#1e293b" stroke="#334155" strokeWidth="1"
          />
          <text
            x={tipLeft ? htx - 55 : htx + 55}
            y={hty - 14}
            textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace"
          >
            {hpt.date.slice(5).replace('-', '/')}
          </text>
          <text
            x={tipLeft ? htx - 55 : htx + 55}
            y={hty + 2}
            textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="monospace"
          >
            {hpt.bpm.toFixed(1)} bpm
          </text>
        </g>
      )}

      {/* Y-axis labels */}
      {yTicks.map(t => (
        <text key={t} x={PAD.left - 6} y={py(t) + 4}
          textAnchor="end" fill="#475569" fontSize="9" fontFamily="monospace"
        >
          {t}
        </text>
      ))}

      {/* X-axis date labels */}
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        if (i % labelEvery !== 0 && !isLast) return null;
        return (
          <text key={i} x={px(i)} y={H - 4}
            textAnchor="middle" fill="#475569" fontSize="9" fontFamily="monospace"
          >
            {p.date.slice(5).replace('-', '/')}
          </text>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${PAD.left + 4}, ${PAD.top - 14})`}>
        <line x1="0" x2="14" y1="4" y2="4" stroke="#10b981" strokeWidth="1" strokeOpacity="0.3" />
        <text x="18" y="8" fill="#475569" fontSize="9" fontFamily="monospace">raw</text>
        <line x1="42" x2="56" y1="4" y2="4" stroke="#10b981" strokeWidth="2" />
        <text x="60" y="8" fill="#475569" fontSize="9" fontFamily="monospace">7-session avg</text>
      </g>

      {/* Y-axis unit */}
      <text
        x={10} y={PAD.top + IH / 2} textAnchor="middle" fill="#475569"
        fontSize="9" fontFamily="monospace"
        transform={`rotate(-90,10,${PAD.top + IH / 2})`}
      >
        bpm
      </text>
    </svg>
  );
}
