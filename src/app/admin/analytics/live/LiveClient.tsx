'use client';

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import { geoOrthographic, geoPath, geoGraticule } from 'd3-geo';
import { feature as topoFeature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import type { LiveRange, BucketType } from '@/app/api/admin/analytics/live/route';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisitorLocation {
  lat: number; lng: number;
  live: boolean;
  country: string;
  city?: string;
  count: number;
}

interface LiveData {
  live_visitors: number;
  range_visitors: number;
  range_pageviews: number;
  range_conversions: number;
  conversion_rate: number;
  bounce_rate: number;
  avg_duration_seconds: number;
  time_series: { label: string; visitors: number; pageviews: number }[];
  bucket_type: BucketType;
  top_countries: { country: string; count: number; lat: number; lng: number }[];
  top_channels: { channel: string; count: number }[];
  top_pages: { path: string; views: number }[];
  visitor_locations: VisitorLocation[];
  heatmap: number[][];
  recent_events: { path: string; city?: string; country?: string; ts: string }[];
  as_of: string;
  range: LiveRange;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGES: { value: LiveRange; label: string }[] = [
  { value: '1h',  label: '1H'  },
  { value: '6h',  label: '6H'  },
  { value: '24h', label: '24H' },
  { value: '7d',  label: '7D'  },
  { value: '30d', label: '30D' },
  { value: '90d', label: '3M'  },
  { value: '6m',  label: '6M'  },
  { value: '12m', label: '12M' },
];

const FLAGS: Record<string, string> = {
  GB:'🇬🇧', US:'🇺🇸', CA:'🇨🇦', AU:'🇦🇺', IE:'🇮🇪',
  DE:'🇩🇪', FR:'🇫🇷', IN:'🇮🇳', NL:'🇳🇱', SE:'🇸🇪',
  NO:'🇳🇴', DK:'🇩🇰', FI:'🇫🇮', AT:'🇦🇹', CH:'🇨🇭',
  BE:'🇧🇪', ES:'🇪🇸', IT:'🇮🇹', PL:'🇵🇱', CZ:'🇨🇿',
  JP:'🇯🇵', KR:'🇰🇷', CN:'🇨🇳', SG:'🇸🇬', MY:'🇲🇾',
  AE:'🇦🇪', ZA:'🇿🇦', NG:'🇳🇬', BR:'🇧🇷', MX:'🇲🇽',
  NZ:'🇳🇿', PT:'🇵🇹', GR:'🇬🇷', TR:'🇹🇷', IL:'🇮🇱',
  PH:'🇵🇭', TH:'🇹🇭', VN:'🇻🇳', HK:'🇭🇰', TW:'🇹🇼',
  RU:'🇷🇺', UA:'🇺🇦', AR:'🇦🇷', CO:'🇨🇴', PE:'🇵🇪',
  EG:'🇪🇬', SA:'🇸🇦', PK:'🇵🇰', BD:'🇧🇩', KE:'🇰🇪',
  GH:'🇬🇭', ET:'🇪🇹', ZW:'🇿🇼', ID:'🇮🇩',
};

const HEATMAP_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── World atlas (Natural Earth 110m) ─────────────────────────────────────────
// Loaded as a static import — bundled at build time, zero runtime fetch.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _atlas = require('world-atlas/countries-110m.json') as Topology;
const WORLD_COUNTRIES = topoFeature(
  _atlas,
  _atlas.objects.countries as GeometryCollection,
) as FeatureCollection<Geometry>;
const WORLD_LAND = topoFeature(
  _atlas,
  _atlas.objects.land as GeometryCollection,
) as FeatureCollection<Geometry>;


// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDuration(s: number): string {
  if (!s)      return '—';
  if (s < 60)  return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function relTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5)    return 'just now';
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function shortPath(path: string): string {
  if (path === '/') return '/';
  return path.length > 30 ? path.slice(0, 28) + '…' : path;
}

// ── 3D Globe (D3 geo orthographic — proper sphere clipping, world-atlas GeoJSON)
//
// Why D3 instead of hand-rolled math:
//   The old strokePolyline() lifted the pen when z < 0, leaving disconnected
//   segments at the sphere boundary ("jigsaw"). D3's geoOrthographic uses great-
//   circle interpolation to close paths exactly at the limb — no jigsaw, and all
//   177 countries from Natural Earth 110m are rendered filled + bordered.

const GLOBE_SIZE = 360;

// Graticule — built once, reused every frame
const _graticule = geoGraticule().step([30, 30])();

function Globe({ locations }: { locations: VisitorLocation[] }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  // D3 rotation: [lambda, phi] in degrees — lambda = E/W spin, phi = N/S tilt
  const rotLamRef    = useRef(23);    // ~23° → Atlantic at centre on load
  const rotPhiRef    = useRef(-10);   // slight N-tilt to show Europe/USA well
  const zoomRef      = useRef(1.0);
  const draggingRef  = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, lam: 23, phi: -10 });
  const pinchRef     = useRef<number | null>(null);
  const frameRef     = useRef<number>(0);
  const locationsRef = useRef<VisitorLocation[]>(locations);
  const pingRef      = useRef<Map<string, number>>(new Map());

  useEffect(() => { locationsRef.current = locations; }, [locations]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // HiDPI canvas
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S   = GLOBE_SIZE;
    canvas.width        = S * dpr;
    canvas.height       = S * dpr;
    canvas.style.width  = `${S}px`;
    canvas.style.height = `${S}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const cx = S / 2, cy = S / 2;
    const BASE_R = S * 0.42; // base sphere radius

    // ── Draw ───────────────────────────────────────────────────────────────

    function draw() {
      const now = performance.now();
      const R   = BASE_R * zoomRef.current;

      // Rebuild projection every frame (cheap — it's just a closure)
      const projection = geoOrthographic()
        .scale(R)
        .translate([cx, cy])
        .rotate([rotLamRef.current, rotPhiRef.current])
        .clipAngle(90); // proper great-circle clipping at the sphere limb

      const path = geoPath(projection, ctx);

      ctx.clearRect(0, 0, S, S);

      // ── Atmosphere glow ──────────────────────────────────────────────
      const atm = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.18);
      atm.addColorStop(0, 'rgba(16,185,129,0.09)');
      atm.addColorStop(1, 'transparent');
      ctx.fillStyle = atm;
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();

      // ── Ocean sphere ─────────────────────────────────────────────────
      const ocean = ctx.createRadialGradient(
        cx - R * 0.28, cy - R * 0.22, R * 0.02, cx, cy, R,
      );
      ocean.addColorStop(0, '#0d2035');
      ocean.addColorStop(1, '#040c1c');
      ctx.fillStyle = ocean;
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();

      // ── Graticule (grid) ─────────────────────────────────────────────
      ctx.beginPath();
      path(_graticule);
      ctx.strokeStyle = 'rgba(71,85,105,0.18)';
      ctx.lineWidth   = 0.5;
      ctx.stroke();

      // ── Land fill (all countries, one batch fill) ─────────────────────
      ctx.beginPath();
      WORLD_LAND.features.forEach(f => path(f));
      ctx.fillStyle = '#14304d'; // navy land — clearly distinct from ocean
      ctx.fill();

      // ── Country borders ───────────────────────────────────────────────
      ctx.beginPath();
      WORLD_COUNTRIES.features.forEach(f => path(f));
      ctx.strokeStyle = 'rgba(100,160,220,0.35)';
      ctx.lineWidth   = 0.55;
      ctx.stroke();

      // ── Sphere rim + specular ─────────────────────────────────────────
      ctx.beginPath(); path({ type: 'Sphere' });
      ctx.strokeStyle = 'rgba(148,163,184,0.22)';
      ctx.lineWidth   = 1;
      ctx.stroke();

      const hl = ctx.createRadialGradient(
        cx - R * 0.32, cy - R * 0.36, 0,
        cx - R * 0.1,  cy - R * 0.14, R * 0.52,
      );
      hl.addColorStop(0, 'rgba(255,255,255,0.07)');
      hl.addColorStop(1, 'transparent');
      ctx.fillStyle = hl;
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();

      // ── Visitor dots ─────────────────────────────────────────────────
      // D3 returns null for points behind the sphere (clipAngle clipping)
      for (const loc of locationsRef.current) {
        const pt = projection([loc.lng, loc.lat]);
        if (!pt) continue;
        const [sx, sy] = pt;

        // Edge-fade: compute dot product with view direction
        const DEG = Math.PI / 180;
        const cLam = -rotLamRef.current * DEG;
        const cPhi = -rotPhiRef.current * DEG;
        const dot = Math.sin(cPhi) * Math.sin(loc.lat * DEG)
                  + Math.cos(cPhi) * Math.cos(loc.lat * DEG) * Math.cos(loc.lng * DEG - cLam);
        const fade = Math.min(1, Math.max(0, (dot + 0.05) / 0.18));

        if (loc.live) {
          const key = `${Math.round(loc.lat * 2)}:${Math.round(loc.lng * 2)}`;
          if (!pingRef.current.has(key)) pingRef.current.set(key, now);
          const t = ((now - (pingRef.current.get(key) ?? now)) % 2200) / 2200;

          ctx.beginPath(); ctx.arc(sx, sy, 3 + t * 14, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(52,211,153,${(1 - t) * 0.6 * fade})`;
          ctx.lineWidth   = 1.5; ctx.stroke();

          if (t > 0.2) {
            const t2 = (t - 0.2) / 0.8;
            ctx.beginPath(); ctx.arc(sx, sy, 3 + t2 * 14, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(16,185,129,${(1 - t2) * 0.22 * fade})`;
            ctx.lineWidth   = 1; ctx.stroke();
          }

          ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52,211,153,${0.95 * fade})`; ctx.fill();
          ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220,255,240,${0.9 * fade})`; ctx.fill();
        } else {
          const r = Math.min(1.5 + Math.log1p(loc.count) * 0.6, 5.5);
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(96,165,250,${0.55 * fade})`; ctx.fill();
        }
      }
    }

    function frame() {
      // Auto-spin: increment lambda (D3 longitude rotation) when idle
      if (!draggingRef.current && pinchRef.current === null) {
        rotLamRef.current += 0.2; // 0.2 °/frame ≈ 12 °/s at 60 fps
      }
      draw();
      frameRef.current = requestAnimationFrame(frame);
    }

    // Scroll-wheel zoom
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomRef.current = Math.max(0.5, Math.min(6.0, zoomRef.current * factor));
    }
    canvas.addEventListener('wheel', onWheel, { passive: false });

    frame();
    return () => {
      cancelAnimationFrame(frameRef.current);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pointer / touch events ────────────────────────────────────────────────

  function onDown(clientX: number, clientY: number) {
    draggingRef.current = true;
    dragStartRef.current = {
      x: clientX, y: clientY,
      lam: rotLamRef.current, phi: rotPhiRef.current,
    };
  }
  function onMove(clientX: number, clientY: number) {
    if (!draggingRef.current) return;
    // Drag sensitivity: 0.45 °/px — zoom-independent feel
    rotLamRef.current = dragStartRef.current.lam
      + (clientX - dragStartRef.current.x) * 0.45;
    rotPhiRef.current = Math.max(-80, Math.min(80,
      dragStartRef.current.phi
      - (clientY - dragStartRef.current.y) * 0.45,
    ));
  }
  function onUp() { draggingRef.current = false; }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current    = Math.hypot(dx, dy);
      draggingRef.current = false;
    } else {
      pinchRef.current = null;
      onDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 2 && pinchRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d  = Math.hypot(dx, dy);
      zoomRef.current = Math.max(0.5, Math.min(6.0,
        zoomRef.current * d / pinchRef.current,
      ));
      pinchRef.current = d;
    } else if (e.touches.length === 1 && pinchRef.current === null) {
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }
  function onTouchEnd() {
    if (pinchRef.current !== null) pinchRef.current = null;
    else onUp();
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: GLOBE_SIZE, height: GLOBE_SIZE }}
      className="block mx-auto cursor-grab active:cursor-grabbing select-none touch-none"
      onMouseDown={e  => onDown(e.clientX, e.clientY)}
      onMouseMove={e  => onMove(e.clientX, e.clientY)}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    />
  );
}

// ── Area / Line Chart ─────────────────────────────────────────────────────────

function AreaChart({
  series,
  activeMetric,
}: {
  series: { label: string; visitors: number; pageviews: number }[];
  activeMetric: 'visitors' | 'pageviews';
}) {
  if (!series.length) return <div className="h-28 flex items-center justify-center text-slate-600 text-sm">No data</div>;

  const W = 900, H = 120;
  const pad = { l: 6, r: 6, t: 10, b: 26 };
  const cW  = W - pad.l - pad.r;
  const cH  = H - pad.t - pad.b;

  const vals  = series.map(d => activeMetric === 'visitors' ? d.visitors : d.pageviews);
  const maxV  = Math.max(...vals, 1);
  const color = activeMetric === 'visitors' ? '#34d399' : '#60a5fa';

  const n   = series.length;
  const px  = (i: number) => pad.l + (n === 1 ? cW / 2 : (i / (n - 1)) * cW);
  const py  = (v: number) => pad.t + cH - (v / maxV) * cH;

  const line = vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i)},${py(v)}`).join(' ');
  const area = `M ${px(0)},${pad.t + cH} ${line.slice(2)} L ${px(n - 1)},${pad.t + cH} Z`;

  // Label indices — aim for ~6 labels regardless of bucket count
  const step  = Math.max(1, Math.floor(n / 6));
  const idxs  = Array.from({ length: n }, (_, i) => i).filter(i => i % step === 0 || i === n - 1);

  const yLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} aria-label="Trend chart">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="chartClip">
          <rect x={pad.l} y={pad.t} width={cW} height={cH} />
        </clipPath>
      </defs>

      {/* Grid */}
      {yLines.map(t => (
        <line key={t}
          x1={pad.l} x2={W - pad.r}
          y1={pad.t + cH * (1 - t)} y2={pad.t + cH * (1 - t)}
          stroke="rgba(71,85,105,0.15)" strokeWidth="1"
        />
      ))}

      {/* Area fill */}
      <path d={area} fill="url(#areaGrad)" clipPath="url(#chartClip)" />

      {/* Line */}
      <path d={line} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" clipPath="url(#chartClip)" />

      {/* Dots for small datasets */}
      {n <= 16 && vals.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r="3.5" fill={color} />
      ))}

      {/* X labels */}
      {idxs.map(i => (
        <text key={i} x={px(i)} y={H - 6} textAnchor="middle"
          fontSize="9.5" fill="rgba(148,163,184,0.65)" fontFamily="ui-monospace,monospace">
          {series[i].label}
        </text>
      ))}

      {/* Y max */}
      <text x={pad.l + 2} y={pad.t + 10} fontSize="9" fill="rgba(100,116,139,0.5)" fontFamily="ui-monospace,monospace">
        {fmtNum(maxV)}
      </text>
    </svg>
  );
}

// ── Hourly Heatmap ────────────────────────────────────────────────────────────

function Heatmap({ data }: { data: number[][] }) {
  const flat   = data.flat();
  const maxVal = Math.max(...flat, 1);

  function cellBg(val: number): string {
    if (val === 0) return 'rgba(30,41,59,0.5)';
    const t = val / maxVal;
    if (t < 0.15) return `rgba(6,78,59,0.55)`;
    if (t < 0.35) return `rgba(6,95,70,0.75)`;
    if (t < 0.55) return `rgba(5,150,105,0.8)`;
    if (t < 0.75) return `rgba(16,185,129,0.85)`;
    return `rgba(52,211,153,0.95)`;
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 540 }}>
        {/* Hour markers */}
        <div className="flex items-center mb-1">
          <div className="w-8 shrink-0" />
          <div className="flex flex-1">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="flex-1 text-center">
                {h % 6 === 0 ? (
                  <span className="text-[9px] text-slate-600 font-mono leading-none">
                    {h.toString().padStart(2,'0')}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {HEATMAP_DAYS.map((day, d) => (
          <div key={d} className="flex items-center gap-0.5 mb-0.5">
            <span className="w-8 shrink-0 text-[9px] text-slate-500 font-mono">{day}</span>
            <div className="flex flex-1 gap-0.5">
              {(data[d] ?? Array(24).fill(0)).map((val, h) => (
                <div
                  key={h}
                  title={`${day} ${h.toString().padStart(2,'0')}:00 — ${val} visitor${val !== 1 ? 's' : ''}`}
                  className="flex-1 rounded-[2px] transition-colors"
                  style={{ height: 13, backgroundColor: cellBg(val) }}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 mt-2 ml-8">
          <span className="text-[9px] text-slate-600">Less</span>
          {[0, 0.2, 0.45, 0.7, 1].map(t => (
            <div key={t} className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: cellBg(Math.round(t * maxVal)) }} />
          ))}
          <span className="text-[9px] text-slate-600">More</span>
        </div>
      </div>
    </div>
  );
}

// ── Bar Row ───────────────────────────────────────────────────────────────────

function BarRow({
  label, value, max, prefix, icon,
}: {
  label: string;
  value: number;
  max: number;
  prefix?: string;
  icon?: React.ReactNode;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 py-1.5 group hover:bg-slate-800/40 rounded px-1 -mx-1">
      {icon && <span className="text-base leading-none shrink-0">{icon}</span>}
      <span className="text-slate-300 text-xs font-mono truncate flex-1 min-w-0">{prefix}{label}</span>
      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0">
        <div className="h-full rounded-full bg-emerald-500/70 transition-all duration-500"
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-400 text-xs font-mono w-10 text-right shrink-0">{fmtNum(value)}</span>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, pulse,
}: {
  label: string;
  value: string | number;
  sub?: string;
  pulse?: boolean;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {pulse && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white leading-none font-mono tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
      {children}
    </h3>
  );
}

// ── Live Event Feed ───────────────────────────────────────────────────────────

function EventFeed({ events }: { events: LiveData['recent_events'] }) {
  return (
    <div className="space-y-px overflow-y-auto" style={{ maxHeight: 280 }}>
      {events.length === 0 && (
        <p className="text-slate-600 text-xs py-4 text-center">No recent events</p>
      )}
      {events.map((e, i) => (
        <div key={i} className="flex items-center gap-2 py-1.5 hover:bg-slate-800/30 rounded px-1 -mx-1">
          <span className="text-base leading-none shrink-0">
            {e.country ? (FLAGS[e.country] ?? '🌍') : '🌍'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-300 font-mono truncate">{shortPath(e.path)}</div>
            {(e.city || e.country) && (
              <div className="text-[10px] text-slate-600 truncate">
                {[e.city, e.country].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <span className="text-[10px] text-slate-600 shrink-0 font-mono">{relTime(e.ts)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#06080F] p-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-800/50 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-96 bg-slate-800/30 rounded-2xl" />
        <div className="h-96 bg-slate-800/30 rounded-2xl" />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LiveClient() {
  const [data,         setData]         = useState<LiveData | null>(null);
  const [range,        setRange]        = useState<LiveRange>('30d');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<'visitors' | 'pageviews'>('visitors');
  const [activeTab,    setActiveTab]    = useState<'globe' | 'feed'>('globe');

  const refresh = useCallback(async (r: LiveRange) => {
    try {
      const res = await fetch(`/api/admin/analytics/live?range=${r}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(range);
    const id = setInterval(() => refresh(range), 30_000);
    return () => clearInterval(id);
  }, [range, refresh]);

  const handleRange = useCallback((r: LiveRange) => {
    if (r === range) return;
    setRange(r);
    setLoading(true);
    refresh(r);
  }, [range, refresh]);

  // Derived
  const maxCountry = useMemo(
    () => Math.max(...(data?.top_countries.map(c => c.count) ?? [1]), 1),
    [data],
  );
  const maxPage = useMemo(
    () => Math.max(...(data?.top_pages.map(p => p.views) ?? [1]), 1),
    [data],
  );
  const maxChannel = useMemo(
    () => Math.max(...(data?.top_channels.map(c => c.count) ?? [1]), 1),
    [data],
  );

  if (loading && !data) return <Skeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-[#06080F] flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center max-w-sm">
          <p className="text-red-400 font-mono text-sm mb-2">Failed to load analytics</p>
          <p className="text-red-600 text-xs mb-4">{error}</p>
          <button onClick={() => { setError(null); setLoading(true); refresh(range); }}
            className="text-xs text-red-400 hover:text-red-300 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const rangeLabel = RANGES.find(r => r.value === range)?.label ?? range;

  return (
    <div className="min-h-screen bg-[#06080F] text-white p-4 md:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Live Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            Updated {relTime(data.as_of)} · auto-refresh every 30s
          </p>
        </div>

        {/* Range picker */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-0.5">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => handleRange(r.value)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all',
                range === r.value
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800',
              ].join(' ')}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Live Now"
          value={data.live_visitors}
          sub="last 5 minutes"
          pulse={data.live_visitors > 0}
        />
        <StatCard
          label={`Visitors (${rangeLabel})`}
          value={fmtNum(data.range_visitors)}
          sub="unique sessions"
        />
        <StatCard
          label={`Pageviews (${rangeLabel})`}
          value={fmtNum(data.range_pageviews)}
          sub={`${data.range_visitors > 0 ? (data.range_pageviews / data.range_visitors).toFixed(1) : '—'} per session`}
        />
        <StatCard
          label="Conversions"
          value={data.range_conversions}
          sub={`${data.conversion_rate}% rate`}
        />
        <StatCard
          label="Bounce Rate"
          value={`${data.bounce_rate}%`}
          sub="single-page sessions"
        />
        <StatCard
          label="Avg Duration"
          value={fmtDuration(data.avg_duration_seconds)}
          sub="per session"
        />
      </div>

      {/* ── Globe + Feed ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Globe panel */}
        <div className="lg:col-span-3 bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Tab row */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
              {(['globe', 'feed'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={[
                    'px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize',
                    activeTab === t
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  {t === 'globe' ? '🌍 Globe' : '⚡ Live Feed'}
                </button>
              ))}
            </div>
            {data.live_visitors > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {data.live_visitors} live
              </div>
            )}
          </div>

          <div className="px-4 pb-4">
            {activeTab === 'globe' ? (
              <div className="flex flex-col items-center gap-3">
                <Globe locations={data.visitor_locations} />
                <p className="text-[10px] text-slate-600 text-center">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1 align-middle" />live
                  &nbsp;·&nbsp;
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400/60 mr-1 align-middle" />{rangeLabel} visitor
                  &nbsp;·&nbsp;drag to rotate&nbsp;·&nbsp;scroll/pinch to zoom
                </p>
              </div>
            ) : (
              <>
                <SectionTitle>Recent Page Events</SectionTitle>
                <EventFeed events={data.recent_events} />
              </>
            )}
          </div>
        </div>

        {/* Right panels */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Countries */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex-1">
            <SectionTitle>Countries</SectionTitle>
            {data.top_countries.length === 0
              ? <p className="text-slate-600 text-xs">No data</p>
              : data.top_countries.map(c => (
                  <BarRow
                    key={c.country}
                    label={c.country}
                    value={c.count}
                    max={maxCountry}
                    icon={FLAGS[c.country] ?? '🌍'}
                  />
                ))
            }
          </div>

          {/* Channels */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
            <SectionTitle>Traffic Channels</SectionTitle>
            {data.top_channels.length === 0
              ? <p className="text-slate-600 text-xs">No data</p>
              : data.top_channels.map(c => (
                  <BarRow key={c.channel} label={c.channel} value={c.count} max={maxChannel} />
                ))
            }
          </div>
        </div>
      </div>

      {/* ── Trend Chart ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <SectionTitle>Visitor Trend — {rangeLabel}</SectionTitle>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
            {(['visitors', 'pageviews'] as const).map(m => (
              <button
                key={m}
                onClick={() => setActiveMetric(m)}
                className={[
                  'px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize',
                  activeMetric === m
                    ? (m === 'visitors' ? 'bg-emerald-700 text-white' : 'bg-blue-700 text-white')
                    : 'text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <AreaChart series={data.time_series} activeMetric={activeMetric} />
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <div className="w-4 h-0.5 bg-emerald-400" />Visitors
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <div className="w-4 h-0.5 bg-blue-400 opacity-60" style={{ borderStyle: 'dashed', borderTopWidth: 1 }} />
            Pageviews
          </div>
        </div>
      </div>

      {/* ── Pages + Heatmap ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Top Pages */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <SectionTitle>Top Pages — {rangeLabel}</SectionTitle>
          {data.top_pages.length === 0
            ? <p className="text-slate-600 text-xs">No data</p>
            : data.top_pages.map(p => (
                <BarRow key={p.path} label={shortPath(p.path)} value={p.views} max={maxPage} />
              ))
          }
        </div>

        {/* Heatmap */}
        <div className="lg:col-span-3 bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <SectionTitle>Hourly Activity Heatmap — last 7 days</SectionTitle>
          <Heatmap data={data.heatmap} />
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="text-center text-[10px] text-slate-700 font-mono pb-2">
        Data from Supabase · visitor_sessions + page_views · {data.range_visitors.toLocaleString()} sessions in window
      </div>
    </div>
  );
}
