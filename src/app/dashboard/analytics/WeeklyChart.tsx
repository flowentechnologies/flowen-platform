'use client';

import { useState } from 'react';

export interface WeekBar {
  label: string;
  sessions: number;
  avgBpm: number | null;
  isCurrentWeek: boolean;
}

const W = 400;
const H = 160;
const PAD = { top: 28, right: 8, bottom: 32, left: 24 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

function barColor(bpm: number | null, empty: boolean) {
  if (empty) return '#1e293b';
  if (bpm === null) return '#334155';
  if (bpm < 2) return '#10b981';
  if (bpm <= 5) return '#f59e0b';
  return '#ef4444';
}

export function WeeklyChart({ weeks, targetSessions }: { weeks: WeekBar[]; targetSessions?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const maxSessions = Math.max(targetSessions ?? 0, ...weeks.map(w => w.sessions), 1);
  const colW = IW / weeks.length;
  const barW = Math.min(24, colW * 0.65);

  const bx = (i: number) => PAD.left + i * colW + colW / 2 - barW / 2;
  const bh = (n: number) => Math.max(n === 0 ? 0 : 2, (n / maxSessions) * IH);
  const by = (n: number) => PAD.top + IH - bh(n);

  const targetY = targetSessions != null
    ? PAD.top + IH - (targetSessions / maxSessions) * IH
    : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-label="Weekly session counts">
      {/* Baseline */}
      <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + IH} y2={PAD.top + IH}
        stroke="#1e293b" strokeWidth="1" />

      {/* Target sessions line */}
      {targetY !== null && (
        <>
          <line x1={PAD.left} x2={W - PAD.right} y1={targetY} y2={targetY}
            stroke="#6366f1" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
          <text x={PAD.left + 2} y={targetY - 3} fill="#6366f1" fontSize="8" fontFamily="monospace" opacity="0.8">
            target
          </text>
        </>
      )}

      {/* Bars */}
      {weeks.map((w, i) => {
        const isHov = hovered === i;
        const color = barColor(w.avgBpm, w.sessions === 0);
        const height = bh(w.sessions);
        const y = by(w.sessions);

        return (
          <g key={i}
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered(null)}
            style={{ cursor: 'default' }}
          >
            {/* Bar */}
            <rect
              x={bx(i)} y={y} width={barW} height={Math.max(height, w.sessions > 0 ? 2 : 0)}
              fill={color}
              opacity={w.isCurrentWeek ? 0.6 : isHov ? 1 : 0.75}
              rx={2}
            />
            {/* Current week indicator */}
            {w.isCurrentWeek && (
              <rect x={bx(i)} y={PAD.top + IH + 2} width={barW} height={2} fill="#6366f1" rx={1} />
            )}
            {/* Hover count label */}
            {isHov && w.sessions > 0 && (
              <text x={bx(i) + barW / 2} y={y - 4} textAnchor="middle"
                fill="white" fontSize="10" fontWeight="700" fontFamily="monospace"
              >
                {w.sessions}
              </text>
            )}
            {/* X label */}
            <text
              x={bx(i) + barW / 2} y={H - 4}
              textAnchor="middle"
              fill={isHov ? '#94a3b8' : w.isCurrentWeek ? '#6366f1' : '#475569'}
              fontSize="8" fontFamily="monospace"
            >
              {w.label}
            </text>
          </g>
        );
      })}

      {/* Y axis: 0 and max */}
      <text x={PAD.left - 4} y={PAD.top + IH + 4} textAnchor="end"
        fill="#475569" fontSize="9" fontFamily="monospace">0</text>
      <text x={PAD.left - 4} y={PAD.top + 8} textAnchor="end"
        fill="#475569" fontSize="9" fontFamily="monospace">{maxSessions}</text>

      {/* Title */}
      <text x={W / 2} y={14} textAnchor="middle"
        fill="#475569" fontSize="9" fontFamily="monospace" letterSpacing="2">
        SESSIONS / WEEK
      </text>
    </svg>
  );
}
