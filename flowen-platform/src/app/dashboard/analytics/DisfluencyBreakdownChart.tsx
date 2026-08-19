'use client';

import { useState } from 'react';

export interface BreakdownPoint {
  sessionNum: number;
  date: string;
  blocks: number;
  prolongations: number;
  repetitions: number;
}

const W = 800;
const H = 200;
const PAD = { top: 28, right: 24, bottom: 40, left: 44 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

// Colours match the DisfluencyHUD badge palette
const C = {
  blocks:        '#f43f5e',   // rose-500
  prolongations: '#8b5cf6',   // violet-500
  repetitions:   '#f59e0b',   // amber-500
};

export function DisfluencyBreakdownChart({ points }: { points: BreakdownPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (points.length === 0) return null;

  // Show at most the most-recent 40 sessions to keep bars readable
  const pts = points.slice(-40);
  const n = pts.length;

  const maxTotal = Math.max(
    1,
    ...pts.map(p => p.blocks + p.prolongations + p.repetitions),
  );
  // Round up to the nearest 5 so the axis looks clean
  const yMax = Math.max(5, Math.ceil(maxTotal / 5) * 5);

  const colW = IW / n;
  const barW = Math.min(18, colW * 0.6);

  const bx = (i: number) => PAD.left + i * colW + colW / 2 - barW / 2;
  const scaleH = (v: number) => (v / yMax) * IH;
  const baseY = PAD.top + IH;

  const labelEvery = n <= 10 ? 1 : n <= 20 ? 2 : n <= 30 ? 5 : 10;

  const yTicks = (() => {
    const step = yMax <= 10 ? 2 : yMax <= 20 ? 5 : 10;
    const ticks: number[] = [];
    for (let v = 0; v <= yMax; v += step) ticks.push(v);
    return ticks;
  })();

  const hovered_pt = hovered !== null ? pts[hovered] : null;
  const hovered_x  = hovered !== null ? bx(hovered) + barW / 2 : 0;
  const tipLeft    = hovered !== null && hovered_x > W * 0.65;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ overflow: 'visible' }}
      aria-label="Disfluency event counts per session"
    >
      {/* Grid lines */}
      {yTicks.map(t => (
        <line key={t}
          x1={PAD.left} x2={W - PAD.right}
          y1={baseY - scaleH(t)} y2={baseY - scaleH(t)}
          stroke="#1e293b" strokeWidth="1"
          strokeDasharray={t === 0 ? '0' : '4 4'}
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.map(t => (
        <text key={t}
          x={PAD.left - 6} y={baseY - scaleH(t) + 4}
          textAnchor="end" fill="#475569" fontSize="9" fontFamily="monospace"
        >
          {t}
        </text>
      ))}

      {/* Stacked bars — blocks (bottom), prolongations (middle), repetitions (top) */}
      {pts.map((p, i) => {
        const bH  = scaleH(p.blocks);
        const plH = scaleH(p.prolongations);
        const rH  = scaleH(p.repetitions);
        const isHov = hovered === i;
        const opacity = isHov ? 1 : 0.75;

        // Draw segments from bottom up
        const segments: { height: number; fill: string; label: string }[] = [
          { height: bH,  fill: C.blocks,        label: 'blocks' },
          { height: plH, fill: C.prolongations,  label: 'prolongations' },
          { height: rH,  fill: C.repetitions,    label: 'repetitions' },
        ];

        let stackY = baseY;
        return (
          <g key={i}
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered(null)}
            style={{ cursor: 'default' }}
          >
            {segments.map(seg => {
              if (seg.height <= 0) return null;
              stackY -= seg.height;
              const y = stackY;
              stackY = y; // consumed
              return (
                <rect
                  key={seg.label}
                  x={bx(i)} y={y}
                  width={barW} height={Math.max(1, seg.height)}
                  fill={seg.fill} opacity={opacity} rx={i === 0 ? 1 : 0}
                />
              );
            })}

            {/* X-axis label */}
            {(i % labelEvery === 0 || i === n - 1) && (
              <text
                x={bx(i) + barW / 2} y={H - 2}
                textAnchor="middle"
                fill={isHov ? '#94a3b8' : '#475569'}
                fontSize="8" fontFamily="monospace"
              >
                {pts[i].date.slice(5).replace('-', '/')}
              </text>
            )}
          </g>
        );
      })}

      {/* Hover tooltip */}
      {hovered_pt && (
        <g style={{ pointerEvents: 'none' }}>
          <line
            x1={hovered_x} x2={hovered_x}
            y1={PAD.top} y2={baseY}
            stroke="#334155" strokeWidth="1" strokeDasharray="3 3"
          />
          <rect
            x={tipLeft ? hovered_x - 116 : hovered_x + 8}
            y={PAD.top}
            width={108} height={64} rx={6}
            fill="#1e293b" stroke="#334155" strokeWidth="1"
          />
          <text
            x={tipLeft ? hovered_x - 116 + 54 : hovered_x + 8 + 54}
            y={PAD.top + 13}
            textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace"
          >
            {hovered_pt.date.slice(5).replace('-', '/')} · #{hovered_pt.sessionNum}
          </text>
          {([
            { label: 'Blocks',   value: hovered_pt.blocks,        color: C.blocks },
            { label: 'Prolong',  value: hovered_pt.prolongations, color: C.prolongations },
            { label: 'Reps',     value: hovered_pt.repetitions,   color: C.repetitions },
          ] as const).map((row, ri) => (
            <g key={row.label}>
              <rect
                x={tipLeft ? hovered_x - 116 + 8 : hovered_x + 16}
                y={PAD.top + 20 + ri * 14}
                width={6} height={6} rx={1} fill={row.color}
              />
              <text
                x={tipLeft ? hovered_x - 116 + 18 : hovered_x + 26}
                y={PAD.top + 27 + ri * 14}
                fill="#cbd5e1" fontSize="9" fontFamily="monospace"
              >
                {row.label}
              </text>
              <text
                x={tipLeft ? hovered_x - 12 : hovered_x + 110}
                y={PAD.top + 27 + ri * 14}
                textAnchor="end" fill="white" fontSize="9" fontWeight="700" fontFamily="monospace"
              >
                {row.value}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* Legend */}
      <g transform={`translate(${PAD.left}, ${PAD.top - 18})`}>
        {([
          { label: 'Blocks',        color: C.blocks },
          { label: 'Prolongations', color: C.prolongations },
          { label: 'Repetitions',   color: C.repetitions },
        ] as const).map((item, i) => (
          <g key={item.label} transform={`translate(${i * 110}, 0)`}>
            <rect x={0} y={0} width={8} height={8} rx={1} fill={item.color} />
            <text x={12} y={8} fill="#475569" fontSize="9" fontFamily="monospace">
              {item.label}
            </text>
          </g>
        ))}
      </g>

      {/* Y-axis unit */}
      <text
        x={10} y={PAD.top + IH / 2}
        textAnchor="middle" fill="#475569"
        fontSize="9" fontFamily="monospace"
        transform={`rotate(-90,10,${PAD.top + IH / 2})`}
      >
        count
      </text>
    </svg>
  );
}
