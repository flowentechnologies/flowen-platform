'use client';

import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeColor = 'emerald' | 'sky' | 'amber' | 'violet' | 'indigo';
type StepStatus = 'automated' | 'ongoing' | 'manual';

interface PipelineNode {
  id: string;
  step: string;
  label: string;
  sub: string;
  color: NodeColor;
  status: StepStatus;
  heading: string;
  description: string;
  specs: { k: string; v: string }[];
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
    heading: 'Explicit opt-in at onboarding step 6',
    description:
      'Users opt in to training data collection at onboarding step 6. The consent event is stored in profiles.opt_in_telemetry with a UTC timestamp. Withdrawal is honoured within 30 days — all associated clips are excluded from the next corpus version commit. The consent audit log is retained indefinitely to satisfy legal obligations.',
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
    heading: 'Encrypted upload + speaker anonymisation',
    description:
      'Session audio is uploaded over TLS to Supabase Storage (EU West, Frankfurt). Before any labelling or storage, the speaker\'s identity is irreversibly one-way hashed. Audio clips are trimmed to ±2 s around detected events to minimise storage and reduce incidental PII in the audio stream.',
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
    heading: 'Production ASR model labels each new clip',
    description:
      'The current production model (flowen-asr-v1.0.x) runs inference on each ingested clip and assigns disfluency event tokens. Clips where all token confidences exceed 0.70 are accepted directly into the labelled pool. Clips with any token below threshold are queued for human QA review. This creates the data flywheel: improved models label more data more accurately, accelerating corpus growth.',
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
    sub: 'SLT annotators · κ ≥ 0.75',
    color: 'amber',
    status: 'ongoing',
    heading: 'Certified SLT annotation and quality control',
    description:
      'Certified speech-language therapists (SLTs) review a 10 % random sample of all auto-labelled clips plus all clips flagged below the confidence threshold. Inter-annotator agreement is tracked using Cohen\'s κ per event class — the target is κ ≥ 0.75. Clips where reviewers disagree are sent to a third annotator for adjudication before being included.',
    specs: [
      { k: 'Reviewer pool', v: 'Certified SLT annotators' },
      { k: 'Random sample', v: '10% of auto-labelled clips per batch' },
      { k: 'Low-confidence', v: 'All clips with confidence < 0.70' },
      { k: 'IAA target', v: 'Cohen\'s κ ≥ 0.75 per event class' },
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
    heading: 'Corpus version commit with checksum audit trail',
    description:
      'At each version boundary, accepted clips are committed to the corpus. A SHA-256 checksum of the full dataset is recorded in the Model Registry for audit trail. Withdrawal exclusions are applied before commit — no withdrawn clips are included in any export. The version record links dataset version to the model version trained on it.',
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
    heading: 'Privacy-safe sharded export for model training',
    description:
      'The training batch is exported as sharded JSONL files containing audio file path, label sequence, and speaker hash. No personal data or raw speaker identity appears in the export. The speaker hash enables per-speaker duration normalisation during fine-tuning without re-identifying individuals. Exported batches are used to fine-tune the next model version, completing the data flywheel loop back to step 03.',
    specs: [
      { k: 'Format', v: 'Sharded JSONL (audio_path, label_seq, speaker_hash)' },
      { k: 'PII in export', v: 'None — speaker identity is the one-way hash only' },
      { k: 'Speaker hash use', v: 'Per-speaker duration normalisation during training' },
      { k: 'Training target', v: 'Next flowen-asr model version (flywheel loop)' },
      { k: 'Database right', v: 'CDPA 1988 — substantial investment in selection & arrangement' },
    ],
  },
];

// ── Colour map (full literal class strings) ───────────────────────────────────

const COLOR: Record<NodeColor, {
  step: string;
  sub: string;
  idleBorder: string;
  idleBg: string;
  activeBorder: string;
  activeBg: string;
  activeSub: string;
  panelDot: string;
  panelBorder: string;
}> = {
  emerald: {
    step:         'text-emerald-500 dark:text-emerald-400',
    sub:          'text-emerald-600 dark:text-emerald-500',
    idleBorder:   'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700',
    idleBg:       'bg-white dark:bg-slate-900',
    activeBorder: 'border-emerald-400 dark:border-emerald-500',
    activeBg:     'bg-emerald-500/5 dark:bg-emerald-500/10',
    activeSub:    'text-emerald-500 dark:text-emerald-400',
    panelDot:     'bg-emerald-400',
    panelBorder:  'border-emerald-500/30',
  },
  sky: {
    step:         'text-sky-500 dark:text-sky-400',
    sub:          'text-sky-600 dark:text-sky-500',
    idleBorder:   'border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700',
    idleBg:       'bg-white dark:bg-slate-900',
    activeBorder: 'border-sky-400 dark:border-sky-500',
    activeBg:     'bg-sky-500/5 dark:bg-sky-500/10',
    activeSub:    'text-sky-500 dark:text-sky-400',
    panelDot:     'bg-sky-400',
    panelBorder:  'border-sky-500/30',
  },
  amber: {
    step:         'text-amber-500 dark:text-amber-400',
    sub:          'text-amber-600 dark:text-amber-500',
    idleBorder:   'border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700',
    idleBg:       'bg-white dark:bg-slate-900',
    activeBorder: 'border-amber-400 dark:border-amber-500',
    activeBg:     'bg-amber-500/5 dark:bg-amber-500/10',
    activeSub:    'text-amber-500 dark:text-amber-400',
    panelDot:     'bg-amber-400',
    panelBorder:  'border-amber-500/30',
  },
  violet: {
    step:         'text-violet-500 dark:text-violet-400',
    sub:          'text-violet-600 dark:text-violet-500',
    idleBorder:   'border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700',
    idleBg:       'bg-white dark:bg-slate-900',
    activeBorder: 'border-violet-400 dark:border-violet-500',
    activeBg:     'bg-violet-500/5 dark:bg-violet-500/10',
    activeSub:    'text-violet-500 dark:text-violet-400',
    panelDot:     'bg-violet-400',
    panelBorder:  'border-violet-500/30',
  },
  indigo: {
    step:         'text-indigo-500 dark:text-indigo-400',
    sub:          'text-indigo-600 dark:text-indigo-500',
    idleBorder:   'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700',
    idleBg:       'bg-white dark:bg-slate-900',
    activeBorder: 'border-indigo-400 dark:border-indigo-500',
    activeBg:     'bg-indigo-500/5 dark:bg-indigo-500/10',
    activeSub:    'text-indigo-500 dark:text-indigo-400',
    panelDot:     'bg-indigo-400',
    panelBorder:  'border-indigo-500/30',
  },
};

const STATUS_LABEL: Record<StepStatus, { label: string; dot: string; text: string }> = {
  automated: { label: 'Automated',     dot: 'bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' },
  ongoing:   { label: 'Ongoing/manual', dot: 'bg-amber-400',   text: 'text-amber-600 dark:text-amber-400' },
  manual:    { label: 'Manual',         dot: 'bg-slate-400',   text: 'text-slate-500 dark:text-slate-400' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Arrow() {
  return (
    <div className="flex-shrink-0 flex items-center justify-center w-5" aria-hidden>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-300 dark:text-slate-700">
        <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function NodeCard({
  node,
  isSelected,
  onClick,
}: {
  node: PipelineNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const c = COLOR[node.color];
  const s = STATUS_LABEL[node.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-1 min-w-[110px] max-w-[150px] text-left rounded-xl border p-3
        transition-all duration-150 cursor-pointer select-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400
        ${isSelected ? `${c.activeBorder} ${c.activeBg}` : `${c.idleBorder} ${c.idleBg}`}
      `}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[10px] font-mono font-bold ${isSelected ? c.step : 'text-slate-400 dark:text-slate-600'}`}>
          {node.step}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} title={s.label} />
      </div>
      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug block">
        {node.label}
      </span>
      <span className={`text-[10px] font-mono mt-1 block leading-tight ${isSelected ? c.activeSub : 'text-slate-400 dark:text-slate-600'}`}>
        {node.sub}
      </span>
    </button>
  );
}

function DetailPanel({ node }: { node: PipelineNode }) {
  const c = COLOR[node.color];
  const s = STATUS_LABEL[node.status];
  return (
    <div className={`mt-3 rounded-xl border ${c.panelBorder} bg-slate-50 dark:bg-slate-800/60 p-5 space-y-3`}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${c.panelDot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
              {node.heading}
            </p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700/60 ${s.text}`}>
              <span className={`w-1 h-1 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-3xl">
            {node.description}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {node.specs.map(s => (
            <div key={s.k} className="flex gap-2 text-xs">
              <dt className="shrink-0 font-mono font-bold text-slate-400 dark:text-slate-500 w-32 leading-relaxed">
                {s.k}
              </dt>
              <dd className="text-slate-600 dark:text-slate-300 font-mono leading-relaxed">
                {s.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ── Flywheel annotation ───────────────────────────────────────────────────────

function FlywheelBadge({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400">
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="shrink-0">
        <path d="M4 1v2.5L6 2M4 7V4.5L2 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <circle cx="4" cy="4" r="3.25" stroke="currentColor" strokeWidth="0.75" />
      </svg>
      flywheel
    </span>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function DatasetWorkflow() {
  const [selected, setSelected] = useState<string>(NODES[0].id);
  const selectedNode = NODES.find(n => n.id === selected)!;

  // Legend
  const legend = [
    { dot: 'bg-emerald-400', label: 'Automated' },
    { dot: 'bg-amber-400',   label: 'Ongoing / manual' },
  ];

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {legend.map(l => (
          <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
            <span className={`w-1.5 h-1.5 rounded-full ${l.dot}`} />
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[10px] font-mono text-sky-400 ml-auto">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M4 1v2.5L6 2M4 7V4.5L2 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            <circle cx="4" cy="4" r="3.25" stroke="currentColor" strokeWidth="0.75" />
          </svg>
          flywheel loop
        </span>
      </div>

      {/* Node rail */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center gap-0 min-w-max sm:min-w-0">
          {NODES.map((node, i) => (
            <div key={node.id} className="flex items-center gap-0 flex-1">
              {i > 0 && <Arrow />}
              <NodeCard
                node={node}
                isSelected={selected === node.id}
                onClick={() => setSelected(node.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Flywheel return indicator */}
      <div className="mt-1 flex items-center gap-1 px-[calc(100%/6*2+10px)] opacity-60" aria-hidden>
        <div className="flex-1 border-b border-dashed border-sky-500/30" />
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-sky-500/50 shrink-0">
          <path d="M2 6h10M8 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[9px] font-mono text-sky-500/60 px-1">model → labels new data</span>
        <div className="flex-1 border-b border-dashed border-sky-500/30" />
      </div>

      {/* Detail panel */}
      <div className="mt-2">
        <DetailPanel node={selectedNode} />
      </div>

      {/* Step hint */}
      <p className="text-[10px] font-mono text-slate-400 dark:text-slate-600 mt-2">
        Click any step to inspect its spec ·{' '}
        <span className="tabular-nums">{NODES.findIndex(n => n.id === selected) + 1} / {NODES.length}</span>
      </p>
    </div>
  );
}
