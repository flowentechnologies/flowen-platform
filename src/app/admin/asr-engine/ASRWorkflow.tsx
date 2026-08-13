'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeColor = 'sky' | 'violet' | 'amber' | 'emerald';

interface PipelineNode {
  id: string;
  step: string;
  label: string;
  sub: string;
  color: NodeColor;
  icon: React.ReactNode;
  heading: string;
  description: string;
  specs: { k: string; v: string; isToken?: boolean }[];
}

// ── Icons (inline SVG paths) ──────────────────────────────────────────────────

function MicIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function WaveIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={cls}>
      <path d="M2 12h2l2-7 2 14 2-9 2 5 2-3 2 3 2-5 2 2h2" />
    </svg>
  );
}

function NetworkIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={cls}>
      <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 7v3M12 14v3M6.5 17.5l4-4M17.5 17.5l-4-4" />
    </svg>
  );
}

function TagIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function TuneIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={cls}>
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2.5" fill="none" /><circle cx="15" cy="12" r="2.5" fill="none" /><circle cx="9" cy="18" r="2.5" fill="none" />
    </svg>
  );
}

function BoltIcon({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

// ── Pipeline definition ───────────────────────────────────────────────────────

const NODES: PipelineNode[] = [
  {
    id: 'capture',
    step: '01',
    label: 'Audio Capture',
    sub: '16 kHz · VAD',
    color: 'sky',
    icon: <MicIcon cls="w-5 h-5" />,
    heading: 'Microphone input via Web Audio API',
    description: 'Raw audio captured at 16 kHz. A voice-activity detector gates the stream — frames below –45 dBFS are discarded before feature extraction, reducing inference load by ~30 % on typical speech. Client-side resampling handles devices that default to 44.1 or 48 kHz.',
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
    sub: '80 bins · 25 ms',
    color: 'sky',
    icon: <WaveIcon cls="w-5 h-5" />,
    heading: '80-bin log-Mel filterbank spectrogram',
    description: 'Hann-windowed 25 ms frames with 10 ms hop are converted to an 80-bin log-Mel spectrogram covering 0–8 kHz. Per-channel energy normalisation is applied before the encoder. Output is a float32 matrix of shape [T × 80].',
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
    sub: '74M params',
    color: 'violet',
    icon: <NetworkIcon cls="w-5 h-5" />,
    heading: 'Disfluency-adapted Whisper encoder',
    description: 'A Whisper (small) encoder fine-tuned for 24 epochs on the Flowen Disfluent Speech Corpus. The encoder produces contextualised frame representations that distinguish fluent phoneme sequences from disfluency events. No decoder is used at inference — encoder output feeds directly to the token classifier.',
    specs: [
      { k: 'Base model', v: 'OpenAI Whisper small (encoder only)' },
      { k: 'Parameters', v: '74M' },
      { k: 'Training epochs', v: '24 (early stopping at F1 plateau)' },
      { k: 'Optimiser', v: 'AdamW · lr 3e-4 · cosine decay' },
      { k: 'Compute', v: 'A100 80 GB × 4 · 34 h total (Vast.ai)' },
    ],
  },
  {
    id: 'classifier',
    step: '04',
    label: 'Token Classifier',
    sub: '5 disfluency classes',
    color: 'violet',
    icon: <TagIcon cls="w-5 h-5" />,
    heading: 'Proprietary disfluency token vocabulary',
    description: 'A linear classification head over encoder outputs assigns one of 5 proprietary special tokens per frame region. These tokens are injected into the Whisper vocabulary before fine-tuning — the extension of the phoneme vocabulary to include structured disfluency markers constitutes the core of the patentable method.',
    specs: [
      { k: 'BLOCK', v: 'Pre-vocalic silence ≥ 200 ms + voiced onset', isToken: true },
      { k: 'PROLONG', v: 'Duration z-score ≥ +2.1σ (speaker-adapted)', isToken: true },
      { k: 'REP_START', v: '3-token n-gram repetition window opens', isToken: true },
      { k: 'REP_END', v: 'Repetition window resolves (≤1.5 s / ≤2.0 s)', isToken: true },
      { k: 'INTERJ', v: 'um / uh / er / hmm — high-prior classifier', isToken: true },
    ],
  },
  {
    id: 'adapt',
    step: '05',
    label: 'Speaker Adaptation',
    sub: 'Per-speaker baseline',
    color: 'amber',
    icon: <TuneIcon cls="w-5 h-5" />,
    heading: 'Dynamic threshold calibration per speaker',
    description: 'Speaker-specific duration baselines computed from the first 30 s of each session. Prolongation detection uses z-scores relative to that speaker\'s own mean — not population norms — reducing false positives on naturally slow/fast speakers by ~19 %. The formant gating in v1.0.2 handles the whisper/murmur edge case.',
    specs: [
      { k: 'Baseline window', v: '30 s rolling from session start' },
      { k: 'Prolongation gate', v: '≥ +2.1σ above speaker mean duration' },
      { k: 'Confidence gate', v: '≥ 0.70 to accept; below → queued' },
      { k: 'Formant gating', v: 'Low-energy vowel filter (added v1.0.2)' },
      { k: 'FP reduction', v: '~19 % vs. population-norm threshold' },
    ],
  },
  {
    id: 'output',
    step: '06',
    label: 'Event Stream',
    sub: '< 120 ms p50',
    color: 'emerald',
    icon: <BoltIcon cls="w-5 h-5" />,
    heading: 'Real-time disfluency events + biofeedback',
    description: 'Detected events are emitted as a structured JSON stream with onset time, duration, event type, and confidence. The on-device WebAssembly/ONNX path keeps round-trip under 120 ms p50. A server-side Node.js Fluid Compute fallback activates when WASM initialisation fails.',
    specs: [
      { k: 'Format', v: '{ onset_ms, duration_ms, type, confidence }' },
      { k: 'Primary runtime', v: 'WebAssembly ONNX (on-device)' },
      { k: 'Fallback runtime', v: 'Node.js Fluid Compute (server)' },
      { k: 'Latency p50', v: '< 120 ms (2023 MacBook Air M2)' },
      { k: 'Consumers', v: 'Viseme system · live WPM · session recorder · HUD' },
    ],
  },
];

const AUTO_MS = 2800;

// ── Colour map ────────────────────────────────────────────────────────────────

const C: Record<NodeColor, {
  icon: string; idleBorder: string; idleBg: string; idleText: string;
  activeBorder: string; activeBg: string; activeText: string; activeSub: string;
  arrowStroke: string; arrowParticle: string;
  tokenBg: string; tokenText: string;
  panelBorder: string; panelDot: string;
}> = {
  sky: {
    icon:         'text-sky-500 dark:text-sky-400',
    idleBorder:   'border-slate-200 dark:border-slate-800',
    idleBg:       'bg-white dark:bg-slate-900',
    idleText:     'text-slate-400 dark:text-slate-600',
    activeBorder: 'border-sky-400 dark:border-sky-500',
    activeBg:     'bg-sky-500/5 dark:bg-sky-900/30',
    activeText:   'text-sky-600 dark:text-sky-300',
    activeSub:    'text-sky-500 dark:text-sky-400',
    arrowStroke:  '#38bdf8',
    arrowParticle:'#7dd3fc',
    tokenBg:      'bg-sky-100 dark:bg-sky-900/40',
    tokenText:    'text-sky-700 dark:text-sky-300',
    panelBorder:  'border-sky-500/30',
    panelDot:     'bg-sky-400',
  },
  violet: {
    icon:         'text-violet-500 dark:text-violet-400',
    idleBorder:   'border-slate-200 dark:border-slate-800',
    idleBg:       'bg-white dark:bg-slate-900',
    idleText:     'text-slate-400 dark:text-slate-600',
    activeBorder: 'border-violet-400 dark:border-violet-500',
    activeBg:     'bg-violet-500/5 dark:bg-violet-900/30',
    activeText:   'text-violet-600 dark:text-violet-300',
    activeSub:    'text-violet-500 dark:text-violet-400',
    arrowStroke:  '#a78bfa',
    arrowParticle:'#c4b5fd',
    tokenBg:      'bg-violet-100 dark:bg-violet-900/40',
    tokenText:    'text-violet-700 dark:text-violet-300',
    panelBorder:  'border-violet-500/30',
    panelDot:     'bg-violet-400',
  },
  amber: {
    icon:         'text-amber-500 dark:text-amber-400',
    idleBorder:   'border-slate-200 dark:border-slate-800',
    idleBg:       'bg-white dark:bg-slate-900',
    idleText:     'text-slate-400 dark:text-slate-600',
    activeBorder: 'border-amber-400 dark:border-amber-500',
    activeBg:     'bg-amber-500/5 dark:bg-amber-900/30',
    activeText:   'text-amber-600 dark:text-amber-300',
    activeSub:    'text-amber-500 dark:text-amber-400',
    arrowStroke:  '#fbbf24',
    arrowParticle:'#fcd34d',
    tokenBg:      'bg-amber-100 dark:bg-amber-900/40',
    tokenText:    'text-amber-700 dark:text-amber-300',
    panelBorder:  'border-amber-500/30',
    panelDot:     'bg-amber-400',
  },
  emerald: {
    icon:         'text-emerald-500 dark:text-emerald-400',
    idleBorder:   'border-slate-200 dark:border-slate-800',
    idleBg:       'bg-white dark:bg-slate-900',
    idleText:     'text-slate-400 dark:text-slate-600',
    activeBorder: 'border-emerald-400 dark:border-emerald-500',
    activeBg:     'bg-emerald-500/5 dark:bg-emerald-900/30',
    activeText:   'text-emerald-600 dark:text-emerald-300',
    activeSub:    'text-emerald-500 dark:text-emerald-400',
    arrowStroke:  '#34d399',
    arrowParticle:'#6ee7b7',
    tokenBg:      'bg-emerald-100 dark:bg-emerald-900/40',
    tokenText:    'text-emerald-700 dark:text-emerald-300',
    panelBorder:  'border-emerald-500/30',
    panelDot:     'bg-emerald-400',
  },
};

// ── Animated arrow ────────────────────────────────────────────────────────────

function AnimatedArrow({ fromColor, toColor, active }: {
  fromColor: NodeColor;
  toColor: NodeColor;
  active: boolean; // true when the upstream node is selected
}) {
  const stroke = active ? C[fromColor].arrowStroke : '#334155';
  const particle = C[fromColor].arrowParticle;
  const dur = active ? '0.7s' : '2.5s';

  return (
    <div className="flex-shrink-0 flex items-center justify-center w-10" aria-hidden>
      <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
        {/* Flowing dashed line */}
        <path d="M0 12 H32" stroke={stroke} strokeWidth={active ? 1.5 : 1} strokeDasharray="4 3">
          <animate attributeName="stroke-dashoffset" from="21" to="0" dur={dur} repeatCount="indefinite" />
        </path>
        {/* Arrowhead */}
        <path d="M28 8 L36 12 L28 16" stroke={stroke} strokeWidth={active ? 1.5 : 1} strokeLinecap="round" strokeLinejoin="round" />
        {/* Moving particle */}
        {active && (
          <circle r="2.5" fill={particle} opacity="0.9">
            <animateMotion dur={dur} repeatCount="indefinite" path="M0 12 H32" />
          </circle>
        )}
      </svg>
    </div>
  );
}

// ── Node card ─────────────────────────────────────────────────────────────────

function NodeCard({
  node, isSelected, onClick,
}: {
  node: PipelineNode; isSelected: boolean; onClick: () => void;
}) {
  const c = C[node.color];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex-1 min-w-[108px] max-w-[148px] text-left rounded-xl border p-3
        transition-all duration-200 cursor-pointer select-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400
        ${isSelected
          ? `${c.activeBorder} ${c.activeBg} shadow-sm`
          : `${c.idleBorder} ${c.idleBg} hover:border-slate-300 dark:hover:border-slate-700`}
      `}
    >
      {/* Pulsing ring when selected */}
      {isSelected && (
        <span
          className={`absolute -inset-px rounded-xl border-2 ${c.activeBorder} opacity-40 animate-ping`}
          style={{ animationDuration: '2s' }}
        />
      )}

      {/* Icon */}
      <div className={`mb-2 ${isSelected ? c.icon : 'text-slate-400 dark:text-slate-600'} transition-colors duration-200`}>
        {node.icon}
      </div>

      {/* Step badge */}
      <span className={`text-[10px] font-mono font-bold block mb-1 ${isSelected ? c.activeText : c.idleText} transition-colors duration-200`}>
        {node.step}
      </span>

      {/* Label */}
      <span className={`text-xs font-semibold leading-snug block ${isSelected ? `text-slate-900 dark:text-white` : 'text-slate-600 dark:text-slate-300'} transition-colors duration-200`}>
        {node.label}
      </span>

      {/* Sub-label */}
      <span className={`text-[10px] font-mono mt-1 block leading-tight ${isSelected ? c.activeSub : 'text-slate-400 dark:text-slate-600'} transition-colors duration-200`}>
        {node.sub}
      </span>
    </button>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ node, version }: { node: PipelineNode; version: number }) {
  const c = C[node.color];

  return (
    <div
      key={version}
      className={`mt-4 rounded-xl border ${c.panelBorder} bg-slate-50 dark:bg-slate-800/50 p-5`}
      style={{ animation: 'asrFadeIn 0.25s ease' }}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${c.panelDot}`} />
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{node.heading}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-2xl">{node.description}</p>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {node.specs.map(s => (
            <div key={s.k} className="flex gap-2 text-xs">
              <dt className="shrink-0 w-28 font-mono font-bold text-slate-400 dark:text-slate-500 leading-relaxed">
                {s.isToken
                  ? <code className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.tokenBg} ${c.tokenText}`}>{s.k}</code>
                  : s.k}
              </dt>
              <dd className="text-slate-600 dark:text-slate-300 font-mono leading-relaxed">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ASRWorkflow() {
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

  return (
    <>
      <style>{`
        @keyframes asrFadeIn {
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
        <div className="flex items-center gap-1">
          {NODES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectNode(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                i === selectedIdx
                  ? `w-4 ${C[NODES[i].color].panelDot}`
                  : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
              }`}
              aria-label={`Select stage ${i + 1}`}
            />
          ))}
        </div>
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600 ml-auto">
          {node.step} / {NODES.length} — {node.label}
        </span>
      </div>

      {/* Node rail */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center min-w-max sm:min-w-0 gap-0">
          {NODES.map((n, i) => (
            <div key={n.id} className="flex items-center flex-1">
              {i > 0 && (
                <AnimatedArrow
                  fromColor={NODES[i - 1].color}
                  toColor={n.color}
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

      {/* Detail panel */}
      <DetailPanel node={node} version={panelVersion} />
    </>
  );
}
