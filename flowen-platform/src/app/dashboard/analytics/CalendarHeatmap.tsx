'use client';

import { useState } from 'react';

export interface CalDay {
  date: string;
  count: number;
}

const CELL = 13;
const GAP = 3;
const STEP = CELL + GAP;
const ROWS = 7; // Mon–Sun
const COLS = 12; // weeks
const PAD_LEFT = 26;
const PAD_TOP = 22;

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

function cellFill(count: number, isToday: boolean) {
  if (isToday && count === 0) return '#1e3a2f';
  if (count === 0) return '#1e293b';
  if (count === 1) return '#065f46';
  if (count === 2) return '#10b981';
  return '#34d399';
}

export function CalendarHeatmap({ days }: { days: CalDay[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (days.length !== COLS * ROWS) return null;

  const today = new Date().toISOString().slice(0, 10);
  const W = PAD_LEFT + COLS * STEP + 4;
  const H = PAD_TOP + ROWS * STEP + 4;

  // Track which months to label (one label per month transition)
  const monthLabels: { col: number; text: string }[] = [];
  let lastMonth = '';
  for (let col = 0; col < COLS; col++) {
    const day = days[col * ROWS]; // first day (Mon) of this week column
    const month = day.date.slice(0, 7);
    if (month !== lastMonth) {
      monthLabels.push({
        col,
        text: new Date(day.date).toLocaleDateString('en-GB', { month: 'short' }),
      });
      lastMonth = month;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ overflow: 'visible' }}
      aria-label="Practice activity calendar"
    >
      {/* Month labels */}
      {monthLabels.map(({ col, text }) => (
        <text key={col}
          x={PAD_LEFT + col * STEP} y={PAD_TOP - 6}
          fill="#475569" fontSize="8" fontFamily="monospace"
        >
          {text}
        </text>
      ))}

      {/* Day-of-week labels */}
      {DAY_LABELS.map((label, row) => (
        <text key={row}
          x={PAD_LEFT - 4} y={PAD_TOP + row * STEP + CELL - 2}
          textAnchor="end" fill="#475569" fontSize="8" fontFamily="monospace"
        >
          {label}
        </text>
      ))}

      {/* Cells — days[col*7 + row] where col=week (0=oldest), row=day-of-week (0=Mon) */}
      {days.map((day, idx) => {
        const col = Math.floor(idx / ROWS);
        const row = idx % ROWS;
        const x = PAD_LEFT + col * STEP;
        const y = PAD_TOP + row * STEP;
        const isToday = day.date === today;
        const isHov = hovered === day.date;

        return (
          <g key={idx}>
            <rect
              x={x} y={y} width={CELL} height={CELL} rx={2}
              fill={cellFill(day.count, isToday)}
              stroke={isToday ? '#10b981' : isHov ? '#94a3b8' : 'transparent'}
              strokeWidth={isToday ? 1.5 : 1}
              onPointerEnter={() => setHovered(day.date)}
              onPointerLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            />
            {/* Tooltip */}
            {isHov && (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={col > COLS - 4 ? x - 78 : x - 4}
                  y={row < 3 ? y + CELL + 4 : y - 26}
                  width={82} height={20} rx={4}
                  fill="#1e293b" stroke="#334155" strokeWidth="1"
                />
                <text
                  x={col > COLS - 4 ? x - 78 + 41 : x - 4 + 41}
                  y={row < 3 ? y + CELL + 15 : y - 11}
                  textAnchor="middle" fill="white" fontSize="9" fontFamily="monospace"
                >
                  {day.date.slice(5).replace('-', '/')} · {day.count === 0 ? 'no session' : `${day.count} session${day.count !== 1 ? 's' : ''}`}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${PAD_LEFT}, ${H - 2})`}>
        <text x="0" y="0" fill="#475569" fontSize="8" fontFamily="monospace">none</text>
        {[0, 1, 2, 3].map(v => (
          <rect key={v} x={26 + v * 16} y={-10} width={12} height={12} rx={2}
            fill={v === 0 ? '#1e293b' : v === 1 ? '#065f46' : v === 2 ? '#10b981' : '#34d399'}
          />
        ))}
        <text x={26 + 4 * 16} y="0" fill="#475569" fontSize="8" fontFamily="monospace">3+</text>
      </g>
    </svg>
  );
}
