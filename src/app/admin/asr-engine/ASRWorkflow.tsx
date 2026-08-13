'use client';

import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeColor = 'sky' | 'violet' | 'amber' | 'emerald';

interface SpecRow {
  k: string;
  v: string;
  isToken?: boolean;
}

interface PipelineNode {
  id: string;
  step: string;
  label: string;
  sub: string;
  color: NodeColor;
  heading: string;
  description: string;
  specs: SpecRow[];
}

// ── Pipeline definition ───────────────────────────────────────────────────────

const NODES: PipelineNode[] = [
  {
    id: 'capture',
    step: '01',
    label: 'Audio Capture',
    sub: '16 kHz · VAD',
    color: 'sky',
    heading: 'Microphone input via Web Audio API',
    description:
      'Raw audio captured at 16 kHz from the device microphone. A voice-activity detector (VAD) gates the stream — frames below –45 dBFS are discarded before feature extraction, reducing inference load by ~30 % on typical speech.',
    specs: [
      { k: 'Sample rate', v: '16 kHz' },
      { k: 'Bit depth', v: '16-bit PCM' },
      { k: 'Channels', v: 'Mono (downmixed at capture)' },
      { k: 'VAD gate', v: '–45 dBFS silence threshold' },
    ],
  },
  {
    id: 'features',
    step: '02',
    label: 'Log-Mel Features',
    sub: '80 bins · 25 ms frames',
    color: 'sky',
    heading: '80-bin log-Mel filterbank spectrogram',
    description:
      'Hann-windowed 25 ms frames with 10 ms hop are converted to an 80-bin log-Mel spectrogram covering 0–8 kHz. Per-channel energy normalisation is applied before the encoder. Output is a float32 matrix of shape [T × 80] where T is the number of frames.',
    specs: [
      { k: 'Frame length', v: '25 ms' },
      { k: 'Frame hop', v: '10 ms' },
      { k: 'Window fn', v: 'Hann' },
      { k: 'Mel bins', v: '80 (0–8 kHz)' },
      { k: 'Output dtype', v: 'float32 [T × 80]' },
    ],
  },
  {
    id: 'encoder',
    step: '03',
    label: 'Transformer Encoder',
    sub: '74M params · Whisper',
    color: 'violet',
    heading: 'Disfluency-adapted Whisper encoder',
    description:
      'A Whisper (small) encoder fine-tuned for 24 epochs on the Flowen Disfluent Speech Corpus. The encoder produces contextualised frame representations that distinguish fluent phoneme sequences from disfluency patterns. No decoder is used at inference — the encoder output feeds directly to the token classifier.',
    specs: [
      { k: 'Base model', v: 'OpenAI Whisper small (encoder only)' },
      { k: 'Parameters', v: '74M' },
      { k: 'Training epochs', v: '24 (early stopping at F1 plateau)' },
      { k: 'Optimiser', v: 'AdamW · lr 3e-4 · cosine decay' },
      { k: 'LR warmup', v: '500 steps' },
      { k: 'Compute', v: 'A100 80 GB × 4 · 34 h total (Vast.ai)' },
    ],
  },
  {
    id: 'classifier',
    step: '04',
    label: 'Token Classifier',
    sub: '5 disfluency classes',
    color: 'violet',
    heading: 'Proprietary disfluency token vocabulary',
    description:
      'A linear classification head over encoder outputs assigns one of 5 proprietary special tokens per frame region. These tokens are injected into the Whisper vocabulary before fine-tuning — this extension of the phoneme vocabulary to include structured disfluency markers constitutes the core of the patentable method.',
    specs: [
      { k: 'BLOCK', v: 'Pre-vocalic silence ≥ 200 ms + voiced phoneme onset', isToken: true },
      { k: 'PROLONG', v: 'Phoneme duration z-score ≥ +2.1σ (speaker-adapted)', isToken: true },
      { k: 'REP_START', v: '3-token n-gram repetition window opens', isToken: true },
      { k: 'REP_END', v: 'Repetition window resolves (≤1.5 s / ≤2.0 s)', isToken: true },
      { k: 'INTERJ', v: 'um / uh / er / hmm — token classifier (high prior)', isToken: true },
    ],
  },
  {
    id: 'adapt',
    step: '05',
    label: 'Speaker Adaptation',
    sub: 'Per-speaker baseline',
    color: 'amber',
    heading: 'Dynamic threshold calibration per speaker',
    description:
      'Speaker-specific phoneme duration baselines are computed from the first 30 s of each session. Prolongation detection uses z-scores relative to that speaker\'s own mean — not population norms — reducing false positives on naturally slow or fast speakers by ~19 %. The formant gating added in v1.0.2 handles the whisper/murmur edge case where low-energy vowels were over-classified as blocks.',
    specs: [
      { k: 'Baseline window', v: '30 s rolling from session start' },
      { k: 'Prolongation gate', v: '≥ +2.1σ above speaker mean duration' },
      { k: 'Confidence gate', v: '≥ 0.70 to accept label; below → queue' },
      { k: 'Formant gating', v: 'Low-energy vowel filter (added v1.0.2)' },
      { k: 'False-positive reduction', v: '~19 % vs. population-norm threshold' },
    ],
  },
  {
    id: 'output',
    step: '06',
    label: 'Event Stream',
    sub: '< 120 ms end-to-end',
    color: 'emerald',
    heading: 'Real-time disfluency events + biofeedback',
    description:
      'Detected events are emitted as a structured JSON stream with onset time, duration, event type, and confidence score. The on-device WebAssembly/ONNX path keeps the round-trip below 120 ms p50 on a 2023 MacBook Air M2. A server-side Node.js Fluid Compute fallback activates when WASM initialisation fails (low-end devices, cold start).',
    specs: [
      { k: 'Output format', v: '{ onset_ms, duration_ms, type, confidence }' },
      { k: 'Primary runtime', v: 'WebAssembly ONNX (on-device)' },
      { k: 'Fallback runtime', v: 'Node.js Fluid Compute (server)' },
      { k: 'Latency p50', v: '< 120 ms (2023 MacBook Air M2)' },
      { k: 'Consumers', v: 'Viseme system · live WPM · session recorder · HUD' },
    ],
  },
];

// ── Colour map (full literal class strings — no dynamic concatenation) ─────────

const COLOR: Record<NodeColor, {
  step: string;
  sub: string;
  idleBorder: string;
  idleBg: string;
  activeBorder: string;
  activeBg: string;
  activeSub: string;
  tokenCode: string;
  panelDot: string;
  panelBorder: string;
}> = {
  sky: {
    step:         'text-sky-500 dark:text-sky-400',
    sub:          'text-sky-600 dark:text-sky-500',
    idleBorder:   'border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700',
    idleBg:       'bg-white dark:bg-slate-900',
    activeBorder: 'border-sky-400 dark:border-sky-500',
    activeBg:     'bg-sky-500/5 dark:bg-sky-500/10',
    activeSub:    'text-sky-500 dark:text-sky-400',
    tokenCode:    'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
    panelDot:     'bg-sky-400',
    panelBorder:  'border-sky-500/30',
  },
  violet: {
    step:         'text-violet-500 dark:text-violet-400',
    sub:          'text-violet-600 dark:text-violet-500',
    idleBorder:   'border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700',
    idleBg:       'bg-white dark:bg-slate-900',
    activeBorder: 'border-violet-400 dark:border-violet-500',
    activeBg:     'bg-violet-500/5 dark:bg-violet-500/10',
    activeSub:    'text-violet-500 dark:text-violet-400',
    tokenCode:    'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    panelDot:     'bg-violet-400',
    panelBorder:  'border-violet-500/30',
  },
  amber: {
    step:         'text-amber-500 dark:text-amber-400',
    sub:          'text-amber-600 dark:text-amber-500',
    idleBorder:   'border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700',
    idleBg:       'bg-white dark:bg-slate-900',
    activeBorder: 'border-amber-400 dark:border-amber-500',
    activeBg:     'bg-amber-500/5 dark:bg-amber-500/10',
    activeSub:    'text-amber-500 dark:text-amber-400',
    tokenCode:    'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    panelDot:     'bg-amber-400',
    panelBorder:  'border-amber-500/30',
  },
  emerald: {
    step:         'text-emerald-500 dark:text-emerald-400',
    sub:          'text-emerald-600 dark:text-emerald-500',
    idleBorder:   'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700',
    idleBg:       'bg-white dark:bg-slate-900',
    activeBorder: 'border-emerald-400 dark:border-emerald-500',
    activeBg:     'bg-emerald-500/5 dark:bg-emerald-500/10',
    activeSub:    'text-emerald-500 dark:text-emerald-400',
    tokenCode:    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    panelDot:     'bg-emerald-400',
    panelBorder:  'border-emerald-500/30',
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Arrow() {
  return (
    <div className="flex-shrink-0 flex items-center justify-center w-6" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-300 dark:text-slate-700">
        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-1 min-w-[110px] max-w-[160px] text-left rounded-xl border p-3
        transition-all duration-150 cursor-pointer select-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400
        ${isSelected ? `${c.activeBorder} ${c.activeBg}` : `${c.idleBorder} ${c.idleBg}`}
      `}
    >
      <span className={`text-[10px] font-mono font-bold block mb-1.5 ${isSelected ? c.step : 'text-slate-400 dark:text-slate-600'}`}>
        {node.step}
      </span>
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
  return (
    <div className={`mt-3 rounded-xl border ${c.panelBorder} bg-slate-50 dark:bg-slate-800/60 p-5 space-y-3`}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${c.panelDot}`} />
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
            {node.heading}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-3xl">
            {node.description}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {node.specs.map(s => (
            <div key={s.k} className="flex gap-2 text-xs">
              <dt className="shrink-0 font-mono font-bold text-slate-400 dark:text-slate-500 w-28">
                {s.isToken ? (
                  <code className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.tokenCode}`}>
                    {s.k}
                  </code>
                ) : s.k}
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

// ── Main export ───────────────────────────────────────────────────────────────

export function ASRWorkflow() {
  const [selected, setSelected] = useState<string>(NODES[0].id);
  const selectedNode = NODES.find(n => n.id === selected)!;

  return (
    <div>
      {/* Node rail */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center gap-0 min-w-max sm:min-w-0">
          {NODES.map((node, i) => (
            <div key={node.id} className="flex items-center gap-0 flex-1">
              {i > 0 && <Arrow />}
              <NodeCard
                node={node}
                isSelected={selected === node.id}
                onClick={() => setSelected(node.id === selected ? node.id : node.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <DetailPanel node={selectedNode} />

      {/* Step hint */}
      <p className="text-[10px] font-mono text-slate-400 dark:text-slate-600 mt-2">
        Click any stage to inspect its spec ·{' '}
        <span className="tabular-nums">{NODES.findIndex(n => n.id === selected) + 1} / {NODES.length}</span>
      </p>
    </div>
  );
}
