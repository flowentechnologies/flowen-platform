'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeColor = 'emerald' | 'sky' | 'amber' | 'violet';
type StepStatus = 'automated' | 'ongoing';

interface PipelineNode {
  id: string;
  step: string;
  label: string;
  sub: string;
  color: NodeColor;
  status: StepStatus;
  icon: React.ReactNode;
  heading: string;
  description: string;
  specs: { k: string; v: string }[];
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function UploadIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CpuIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="8" y="8" width="8" height="8" />
      <path d="M8 2v2M16 2v2M8 20v2M16 20v2M2 8h2M2 16h2M20 8h2M20 16h2" />
    </svg>
  );
}

function EyeIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function GitIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" /><line x1="6" y1="9" x2="6" y2="15" />
    </svg>
  );
}

function PackageIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

// ── Pipeline definition ───────────────────────────────────────────────────────

const NODES: PipelineNode[] = [
  {
    id: 'consent',
    step: '01',
    label: 'Consent Capture',
    sub: 'GDPR Art. 9(2)(a)',
    color: 'emerald',
    status: 'automated',
    icon: <CheckIcon cls="w-5 h-5" />,
    heading: 'Explicit opt-in at onboarding step 6',
    description: 'Users opt in at onboarding step 6. Stored in profiles.opt_in_telemetry with UTC timestamp. Withdrawal is honoured within 30 days — all associated clips are excluded from the next corpus version commit. The consent audit log is retained indefinitely to satisfy legal obligations.',
    specs: [
      { k: 'Legal basis', v: 'GDPR Art. 9(2)(a) — explicit consent (special category: health data)' },
      { k: 'Stored in', v: 'profiles.opt_in_telemetry (Supabase)' },
      { k: 'Withdrawal SLA', v: '30 days to corpus exclusion' },
      { k: 'Audit log', v: 'Retained indefinitely (legal obligation)' },
    ],
  },
  {
    id: 'ingestion',
    step: '02',
    label: 'Audio Ingestion',
    sub: 'Encrypted · EU West',
    color: 'emerald',
    status: 'automated',
    icon: <UploadIcon cls="w-5 h-5" />,
    heading: 'Encrypted upload + speaker anonymisation',
    description: 'Session audio uploaded over TLS to Supabase Storage (EU West, Frankfurt). Speaker identity is irreversibly one-way hashed before tagging. Clips are trimmed to ±2 s around detected events to minimise storage and reduce incidental PII in the audio stream.',
    specs: [
      { k: 'Storage', v: 'Supabase Storage · EU West (Frankfurt)' },
      { k: 'Encryption', v: 'AES-256 at rest · TLS in transit' },
      { k: 'Speaker ID', v: 'One-way hash before tagging — not reversible' },
      { k: 'Clip trim', v: '±2 s around detected event boundary' },
      { k: 'Access control', v: 'Engineering team only · RLS enforced' },
    ],
  },
  {
    id: 'autolabel',
    step: '03',
    label: 'Auto-labelling',
    sub: 'flowen-asr-v1.0.x',
    color: 'sky',
    status: 'automated',
    icon: <CpuIcon cls="w-5 h-5" />,
    heading: 'Production ASR model labels each new clip',
    description: 'The current production model runs inference on each ingested clip and assigns disfluency event tokens. Clips where all confidences exceed 0.70 are accepted. Below-threshold clips are queued for human QA. This creates the data flywheel: improved models label more data more accurately, accelerating corpus growth.',
    specs: [
      { k: 'Labelling model', v: 'flowen-asr-v1.0.x (current production)' },
      { k: 'Accept threshold', v: 'All token confidences ≥ 0.70' },
      { k: 'Below threshold', v: 'Queued for human QA review (step 04)' },
      { k: 'Throughput', v: '~3,000 clips / day on current infra' },
      { k: 'Data flywheel', v: 'Better model → better labels → better training data' },
    ],
  },
  {
    id: 'qa',
    step: '04',
    label: 'Human QA Review',
    sub: 'SLT · κ ≥ 0.75',
    color: 'amber',
    status: 'ongoing',
    icon: <EyeIcon cls="w-5 h-5" />,
    heading: 'Certified SLT annotation and quality control',
    description: 'Certified speech-language therapists review a 10 % random sample of all auto-labelled clips plus all below-threshold clips. Inter-annotator agreement tracked via Cohen\'s κ per event class (target ≥ 0.75). Disagreements are sent to a third annotator for adjudication.',
    specs: [
      { k: 'Reviewer pool', v: 'Certified SLT annotators' },
      { k: 'Random sample', v: '10 % of auto-labelled clips per batch' },
      { k: 'Low-confidence', v: 'All clips with any token confidence < 0.70' },
      { k: 'IAA target', v: "Cohen's κ ≥ 0.75 per event class" },
      { k: 'Adjudication', v: 'Third reviewer resolves disagreements' },
    ],
  },
  {
    id: 'versioning',
    step: '05',
    label: 'Dataset Versioning',
    sub: 'SHA-256 · audit trail',
    color: 'emerald',
    status: 'automated',
    icon: <GitIcon cls="w-5 h-5" />,
    heading: 'Corpus version commit with checksum audit trail',
    description: 'At each version boundary, accepted clips are committed to the corpus. A SHA-256 checksum of the full dataset is recorded in the Model Registry. Withdrawal exclusions are applied before commit — no withdrawn clips appear in any export. The record links dataset version to the model trained on it.',
    specs: [
      { k: 'Versioning scheme', v: 'Semantic (vMAJOR.MINOR) — e.g. v3.1' },
      { k: 'Integrity check', v: 'SHA-256 hash of full sharded dataset' },
      { k: 'Registry', v: 'Model Registry links dataset → trained model' },
      { k: 'Withdrawal exclusion', v: 'Applied before every commit — no exceptions' },
      { k: 'Retention (audio)', v: '12 months from collection · then auto-deleted' },
    ],
  },
  {
    id: 'export',
    step: '06',
    label: 'Training Export',
    sub: 'Sharded JSONL · no PII',
    color: 'violet',
    status: 'automated',
    icon: <PackageIcon cls="w-5 h-5" />,
    heading: 'Privacy-safe sharded export for model training',
    description: 'Training batch exported as sharded JSONL containing audio path, label sequence, and speaker hash. No personal data appears in the export. Speaker hash enables per-speaker duration normalisation during training without re-identifying individuals. Export feeds the next model version — completing the flywheel back to step 03.',
    specs: [
      { k: 'Format', v: 'Sharded JSONL (audio_path, label_seq, speaker_hash)' },
      { k: 'PII in export', v: 'None — speaker identity is one-way hash only' },
      { k: 'Speaker hash use', v: 'Per-speaker duration normalisation during training' },
      { k: 'Training target', v: 'Next flowen-asr model version (flywheel → step 03)' },
      { k: 'Database right', v: 'CDPA 1988 — substantial investment in selection & arrangement' },
    ],
  },
];

const AUTO_MS = 2800;

// ── Colour map ────────────────────────────────────────────────────────────────

const C: Record<NodeColor, {
  icon: string; idleBorder: string; idleBg: string; idleText: string;
  activeBorder: string; activeBg: string; activeText: string; activeSub: string;
  arrowStroke: string; arrowParticle: string;
  panelBorder: string; panelDot: string;
}> = {
  emerald: {
    icon: 'text-emerald-500 dark:text-emerald-400',
    idleBorder: 'border-slate-200 dark:border-slate-800',
    idleBg: 'bg-white dark:bg-slate-900',
    idleText: 'text-slate-400 dark:text-slate-600',
    activeBorder: 'border-emerald-400 dark:border-emerald-500',
    activeBg: 'bg-emerald-500/5 dark:bg-emerald-900/30',
    activeText: 'text-emerald-600 dark:text-emerald-300',
    activeSub: 'text-emerald-500 dark:text-emerald-400',
    arrowStroke: '#34d399', arrowParticle: '#6ee7b7',
    panelBorder: 'border-emerald-500/30', panelDot: 'bg-emerald-400',
  },
  sky: {
    icon: 'text-sky-500 dark:text-sky-400',
    idleBorder: 'border-slate-200 dark:border-slate-800',
    idleBg: 'bg-white dark:bg-slate-900',
    idleText: 'text-slate-400 dark:text-slate-600',
    activeBorder: 'border-sky-400 dark:border-sky-500',
    activeBg: 'bg-sky-500/5 dark:bg-sky-900/30',
    activeText: 'text-sky-600 dark:text-sky-300',
    activeSub: 'text-sky-500 dark:text-sky-400',
    arrowStroke: '#38bdf8', arrowParticle: '#7dd3fc',
    panelBorder: 'border-sky-500/30', panelDot: 'bg-sky-400',
  },
  amber: {
    icon: 'text-amber-500 dark:text-amber-400',
    idleBorder: 'border-slate-200 dark:border-slate-800',
    idleBg: 'bg-white dark:bg-slate-900',
    idleText: 'text-slate-400 dark:text-slate-600',
    activeBorder: 'border-amber-400 dark:border-amber-500',
    activeBg: 'bg-amber-500/5 dark:bg-amber-900/30',
    activeText: 'text-amber-600 dark:text-amber-300',
    activeSub: 'text-amber-500 dark:text-amber-400',
    arrowStroke: '#fbbf24', arrowParticle: '#fcd34d',
    panelBorder: 'border-amber-500/30', panelDot: 'bg-amber-400',
  },
  violet: {
    icon: 'text-violet-500 dark:text-violet-400',
    idleBorder: 'border-slate-200 dark:border-slate-800',
    idleBg: 'bg-white dark:bg-slate-900',
    idleText: 'text-slate-400 dark:text-slate-600',
    activeBorder: 'border-violet-400 dark:border-violet-500',
    activeBg: 'bg-violet-500/5 dark:bg-violet-900/30',
    activeText: 'text-violet-600 dark:text-violet-300',
    activeSub: 'text-violet-500 dark:text-violet-400',
    arrowStroke: '#a78bfa', arrowParticle: '#c4b5fd',
    panelBorder: 'border-violet-500/30', panelDot: 'bg-violet-400',
  },
};

const STATUS_DOT: Record<StepStatus, { dot: string; label: string }> = {
  automated: { dot: 'bg-emerald-400', label: 'Automated' },
  ongoing:   { dot: 'bg-amber-400',   label: 'Ongoing / manual' },
};

// ── Animated forward arrow ────────────────────────────────────────────────────

function AnimatedArrow({ fromColor, active }: { fromColor: NodeColor; active: boolean }) {
  const stroke = active ? C[fromColor].arrowStroke : '#334155';
  const particle = C[fromColor].arrowParticle;
  const dur = active ? '0.7s' : '2.5s';

  return (
    <div className="flex-shrink-0 flex items-center justify-center w-9" aria-hidden>
      <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
        <path d="M0 12 H28" stroke={stroke} strokeWidth={active ? 1.5 : 1} strokeDasharray="4 3">
          <animate attributeName="stroke-dashoffset" from="21" to="0" dur={dur} repeatCount="indefinite" />
        </path>
        <path d="M24 8 L32 12 L24 16" stroke={stroke} strokeWidth={active ? 1.5 : 1} strokeLinecap="round" strokeLinejoin="round" />
        {active && (
          <circle r="2.5" fill={particle} opacity="0.9">
            <animateMotion dur={dur} repeatCount="indefinite" path="M0 12 H28" />
          </circle>
        )}
      </svg>
    </div>
  );
}

// ── Flywheel return arrow (Export → Auto-labelling, right to left) ─────────────

function FlywheelArrow({ active }: { active: boolean }) {
  // Spans from step 06 back to step 03 (indices 5 → 2), a visual arc below the diagram.
  // We approximate this as a long backwards dashed arrow.
  const stroke = active ? '#38bdf8' : '#1e293b';
  const dur = active ? '1.2s' : '4s';

  return (
    <div className="mt-1 relative h-6 w-full" aria-label="Flywheel: training export feeds auto-labelling">
      <svg width="100%" height="24" viewBox="0 0 600 24" preserveAspectRatio="none" fill="none">
        {/* Horizontal return line — right to left dashes */}
        <path d="M580 12 H60" stroke={stroke} strokeWidth={active ? 1.5 : 0.75} strokeDasharray="5 4" opacity={active ? 0.7 : 0.3}>
          <animate attributeName="stroke-dashoffset" from="0" to="27" dur={dur} repeatCount="indefinite" />
        </path>
        {/* Left arrowhead (pointing left = toward step 03) */}
        <path d="M64 8 L56 12 L64 16" stroke={stroke} strokeWidth={active ? 1.5 : 0.75} strokeLinecap="round" strokeLinejoin="round" opacity={active ? 0.7 : 0.3} />
        {/* Moving particle — travels backwards */}
        {active && (
          <circle r="2" fill="#7dd3fc" opacity="0.8">
            <animateMotion dur={dur} repeatCount="indefinite" path="M580 12 H60" />
          </circle>
        )}
      </svg>

      {/* Label centred on the arc */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`text-[9px] font-mono px-1.5 rounded ${active ? 'text-sky-400' : 'text-slate-600 dark:text-slate-700'} transition-colors`}>
          flywheel — new model feeds back to step 03
        </span>
      </div>
    </div>
  );
}

// ── Node card ─────────────────────────────────────────────────────────────────

function NodeCard({ node, isSelected, onClick }: {
  node: PipelineNode; isSelected: boolean; onClick: () => void;
}) {
  const c = C[node.color];
  const s = STATUS_DOT[node.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex-1 min-w-[104px] max-w-[142px] text-left rounded-xl border p-3
        transition-all duration-200 cursor-pointer select-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400
        ${isSelected
          ? `${c.activeBorder} ${c.activeBg} shadow-sm`
          : `${c.idleBorder} ${c.idleBg} hover:border-slate-300 dark:hover:border-slate-700`}
      `}
    >
      {isSelected && (
        <span
          className={`absolute -inset-px rounded-xl border-2 ${c.activeBorder} opacity-40 animate-ping`}
          style={{ animationDuration: '2s' }}
        />
      )}

      {/* Icon + status dot row */}
      <div className="flex items-start justify-between mb-2">
        <div className={`${isSelected ? c.icon : 'text-slate-400 dark:text-slate-600'} transition-colors duration-200`}>
          {node.icon}
        </div>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${s.dot}`} title={s.label} />
      </div>

      <span className={`text-[10px] font-mono font-bold block mb-1 ${isSelected ? c.activeText : c.idleText} transition-colors duration-200`}>
        {node.step}
      </span>
      <span className={`text-xs font-semibold leading-snug block ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'} transition-colors duration-200`}>
        {node.label}
      </span>
      <span className={`text-[10px] font-mono mt-1 block leading-tight ${isSelected ? c.activeSub : c.idleText} transition-colors duration-200`}>
        {node.sub}
      </span>
    </button>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ node, version }: { node: PipelineNode; version: number }) {
  const c = C[node.color];
  const s = STATUS_DOT[node.status];

  return (
    <div
      key={version}
      className={`rounded-xl border ${c.panelBorder} bg-slate-50 dark:bg-slate-800/50 p-5`}
      style={{ animation: 'dsFadeIn 0.25s ease' }}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${c.panelDot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{node.heading}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700/60`}>
              <span className={`w-1 h-1 rounded-full ${s.dot}`} />
              <span className="text-slate-500 dark:text-slate-400">{s.label}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">{node.description}</p>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {node.specs.map(s => (
            <div key={s.k} className="flex gap-2 text-xs">
              <dt className="shrink-0 w-32 font-mono font-bold text-slate-400 dark:text-slate-500 leading-relaxed">{s.k}</dt>
              <dd className="text-slate-600 dark:text-slate-300 font-mono leading-relaxed">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function DatasetWorkflow() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [panelVersion, setPanelVersion] = useState(0);

  const advance = useCallback(() => {
    setSelectedIdx(i => {
      const next = (i + 1) % NODES.length;
      setPanelVersion(v => v + 1);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(advance, AUTO_MS);
    return () => clearInterval(id);
  }, [playing, advance]);

  function selectNode(idx: number) {
    if (idx === selectedIdx) return;
    setPlaying(false);
    setSelectedIdx(idx);
    setPanelVersion(v => v + 1);
  }

  const node = NODES[selectedIdx];
  // Flywheel is active when Export (idx 5) is selected or Auto-labelling (idx 2) is next up
  const flywheelActive = selectedIdx === 5;

  return (
    <>
      <style>{`
        @keyframes dsFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => setPlaying(p => !p)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold
            border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400
            hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500
            transition-colors"
        >
          {playing ? (
            <>
              <svg viewBox="0 0 10 12" className="w-2.5 h-3" fill="currentColor">
                <rect x="0" y="0" width="3.5" height="12" rx="1" />
                <rect x="6.5" y="0" width="3.5" height="12" rx="1" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
                <path d="M2 1l10 5-10 5V1z" />
              </svg>
              Play
            </>
          )}
        </button>

        {/* Step dots */}
        <div className="flex items-center gap-1">
          {NODES.map((n, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectNode(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === selectedIdx
                  ? `w-4 ${C[n.color].panelDot}`
                  : 'w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
              }`}
              aria-label={`Select step ${i + 1}`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 ml-auto">
          {[
            { dot: 'bg-emerald-400', label: 'Automated' },
            { dot: 'bg-amber-400',   label: 'Ongoing' },
          ].map(l => (
            <span key={l.label} className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-slate-400 dark:text-slate-600">
              <span className={`w-1.5 h-1.5 rounded-full ${l.dot}`} />
              {l.label}
            </span>
          ))}
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">
            {node.step} / {NODES.length}
          </span>
        </div>
      </div>

      {/* Node rail */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center min-w-max sm:min-w-0 gap-0">
          {NODES.map((n, i) => (
            <div key={n.id} className="flex items-center flex-1">
              {i > 0 && (
                <AnimatedArrow
                  fromColor={NODES[i - 1].color}
                  active={selectedIdx === i - 1}
                />
              )}
              <NodeCard
                node={n}
                isSelected={selectedIdx === i}
                onClick={() => selectNode(i)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Flywheel return arrow */}
      <FlywheelArrow active={flywheelActive} />

      {/* Detail panel */}
      <div className="mt-3">
        <DetailPanel node={node} version={panelVersion} />
      </div>
    </>
  );
}
