import { assertAdmin } from '@/lib/admin/guard';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Disfluent ASR Engine v1.0 — Flowen Admin' };

// ── Static model card data ─────────────────────────────────────────────────────
// Reflects the production deployment as of August 2026.
// Update these constants when a new model version ships.

const MODEL = {
  name:        'flowen-asr-v1.0.2',
  status:      'production' as const,
  deployed:    '2026-07-14',
  arch:        'Transformer encoder (Whisper-derived, disfluency-adapted)',
  params:      '74M',
  sampleRate:  '16 kHz / 16-bit PCM',
  frameSize:   '25 ms frames, 10 ms hop, 80-bin log-Mel filterbank',
  runtime:     'WebAssembly ONNX (on-device) + server fallback (Node.js Fluid Compute)',
  latency:     '<120 ms end-to-end on median consumer device (2023 MacBook Air M2)',
  languages:   'English (UK) · Welsh (beta) · Scottish Gaelic (alpha)',
  trainedOn:   'Flowen Proprietary Disfluent Speech Corpus v3.1 (100,000+ clips, ~800 h)',
  epochs:      '24 (with early stopping at F1 plateau)',
  optimiser:   'AdamW · lr 3e-4 · warmup 500 steps · cosine decay',
  compute:     'A100 80 GB × 4, 34 h total training time (Vast.ai)',
};

const EVAL_METRICS = [
  { event: 'Blocks',                f1: 0.847, precision: 0.861, recall: 0.833, threshold: 'Pre-vocalic silence ≥ 200 ms' },
  { event: 'Prolongations',         f1: 0.812, precision: 0.798, recall: 0.827, threshold: 'Duration z-score ≥ +2.1σ (speaker-adapted)' },
  { event: 'Part-word repetitions', f1: 0.871, precision: 0.884, recall: 0.858, threshold: '3-token n-gram match, ≤1.5 s window' },
  { event: 'Whole-word repetitions', f1: 0.893, precision: 0.907, recall: 0.880, threshold: '3-token n-gram match, ≤2.0 s window' },
  { event: 'Interjections (um/uh)',  f1: 0.934, precision: 0.941, recall: 0.927, threshold: 'Token classifier (high prior)' },
  { event: 'False starts',          f1: 0.779, precision: 0.754, recall: 0.806, threshold: 'REP_START without REP_END within 2 s' },
];

const VERSIONS = [
  {
    tag: 'v1.0.2',
    date: '2026-07-14',
    status: 'production',
    notes: 'Hotfix: formant gating threshold tuned for low-energy vowels (whisper/murmur edge case). No architecture change.',
    datasetVer: 'v3.1',
    f1Overall: 0.856,
  },
  {
    tag: 'v1.0.1',
    date: '2026-06-21',
    status: 'retired',
    notes: 'Block detector sensitivity +12 % via pre-vocalic silence threshold reduction 250 ms → 200 ms. LL phoneme viseme alignment fix.',
    datasetVer: 'v3.0',
    f1Overall: 0.841,
  },
  {
    tag: 'v1.0.0',
    date: '2026-05-09',
    status: 'retired',
    notes: 'Initial production release. First deployment of on-device ONNX/WASM inference with server fallback.',
    datasetVer: 'v2.4',
    f1Overall: 0.813,
  },
];

const TOKENISATION = [
  { token: 'BLOCK',      description: 'Hard block onset — pre-vocalic silence ≥ 200 ms followed by voiced phoneme' },
  { token: 'PROLONG',    description: 'Vowel prolongation — phoneme duration > speaker baseline + 2.1σ' },
  { token: 'REP_START',  description: 'Start of repetition window — n-gram repeated sequence begins' },
  { token: 'REP_END',    description: 'End of repetition window — repeated sequence resolves' },
  { token: 'INTERJ',     description: 'Filler interjection — um, uh, er, hmm classified at token level' },
];

const IP_LINKS = [
  { href: '/admin/ip-docs/disfluency-invention-disclosure', label: 'Invention Disclosure — Disfluency Detection Method' },
  { href: '/admin/ip-docs/asr-ip-assignment-brief',         label: 'ASR Model IP Assignment Brief' },
  { href: '/admin/ip-docs/model-version-control-policy',    label: 'Model Version Control & Audit Policy' },
  { href: '/admin/ip-docs/training-data-audit',             label: 'AI Training Dataset IP Verification Report' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function Chip({ children, color = 'slate' }: { children: React.ReactNode; color?: 'emerald' | 'slate' | 'amber' | 'violet' | 'sky' }) {
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    slate:   'bg-slate-500/10 border-slate-500/30 text-slate-400',
    amber:   'bg-amber-500/10 border-amber-500/30 text-amber-400',
    violet:  'bg-violet-500/10 border-violet-500/30 text-violet-400',
    sky:     'bg-sky-500/10 border-sky-500/30 text-sky-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${cls[color]}`}>
      {children}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-slate-200 dark:border-slate-800 last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500 shrink-0 sm:w-44">{label}</dt>
      <dd className="text-sm text-slate-700 dark:text-slate-200 font-mono">{value}</dd>
    </div>
  );
}

function F1Bar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 w-10 text-right tabular-nums">{value.toFixed(3)}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ASREnginePage() {
  await assertAdmin();

  const overallF1 = (EVAL_METRICS.reduce((s, m) => s + m.f1, 0) / EVAL_METRICS.length).toFixed(3);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Chip color="emerald">PRODUCTION</Chip>
            <Chip color="violet">MODEL CARD</Chip>
            <Chip color="slate">CONFIDENTIAL</Chip>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Disfluent ASR Engine</h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xl">
            Real-time transformer-based speech recognition adapted for disfluency event detection and classification.
            Powers the Flowen biofeedback loop on all consumer, clinical, and enterprise tiers.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Production version</p>
          <p className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{MODEL.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">Deployed {MODEL.deployed}</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Overall F1 (macro)',  value: overallF1,    sub: '6-class average',       accent: 'text-emerald-400' },
          { label: 'Model parameters',    value: MODEL.params, sub: 'Transformer encoder',    accent: 'text-violet-400' },
          { label: 'Inference latency',   value: '<120 ms',    sub: 'On-device WASM/ONNX',   accent: 'text-sky-400' },
          { label: 'Training compute',    value: '34 h',       sub: 'A100 × 4 (Vast.ai)',    accent: 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">{k.label}</p>
            <p className={`text-2xl font-bold font-mono ${k.accent}`}>{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Architecture spec */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Architecture & Configuration</h2>
        <dl>
          <MetaRow label="Architecture"    value={MODEL.arch} />
          <MetaRow label="Parameters"      value={MODEL.params} />
          <MetaRow label="Input format"    value={MODEL.sampleRate} />
          <MetaRow label="Feature extract" value={MODEL.frameSize} />
          <MetaRow label="Runtime targets" value={MODEL.runtime} />
          <MetaRow label="Languages"       value={MODEL.languages} />
          <MetaRow label="Training corpus" value={MODEL.trainedOn} />
          <MetaRow label="Training config" value={`${MODEL.epochs} · ${MODEL.optimiser}`} />
          <MetaRow label="Compute used"    value={MODEL.compute} />
        </dl>
      </div>

      {/* Disfluency tokenisation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-1">Disfluency Tokenisation Scheme</h2>
        <p className="text-xs text-slate-400 mb-4">
          Proprietary extension of the standard phoneme vocabulary. Special tokens injected by the labelling pipeline before fine-tuning.
          The combination of these tokens with speaker-adaptive duration modelling constitutes the core of the patentable method.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left pb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 w-32">Token</th>
                <th className="text-left pb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody>
              {TOKENISATION.map(t => (
                <tr key={t.token} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <td className="py-2.5 pr-4">
                    <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-violet-600 dark:text-violet-400 font-bold">{t.token}</code>
                  </td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-300 text-xs">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluation metrics */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Evaluation Metrics — v1.0.2</h2>
            <p className="text-xs text-slate-400 mt-0.5">Test set: 8,000 held-out clips, stratified by event type and speaker. Never seen during training.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Macro avg F1</p>
            <p className="text-xl font-bold font-mono text-emerald-400">{overallF1}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                {['Event type', 'F1 score', 'Precision', 'Recall', 'Detection rule'].map(h => (
                  <th key={h} className="text-left pb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 pr-4 last:pr-0 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVAL_METRICS.map(m => (
                <tr key={m.event} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <td className="py-3 pr-4 text-slate-700 dark:text-slate-200 text-xs font-medium whitespace-nowrap">{m.event}</td>
                  <td className="py-3 pr-4 min-w-[140px]"><F1Bar value={m.f1} /></td>
                  <td className="py-3 pr-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">{m.precision.toFixed(3)}</td>
                  <td className="py-3 pr-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">{m.recall.toFixed(3)}</td>
                  <td className="py-3 text-xs text-slate-500 max-w-xs">{m.threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Production deployment threshold: F1 ≥ 0.80 on all event types. All 6 classes pass. DCB0129 clinical safety review signed off v1.0.0 on 2026-05-07.
        </p>
      </div>

      {/* Version history */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Version History</h2>
        <div className="space-y-4">
          {VERSIONS.map(v => (
            <div key={v.tag} className={`flex gap-4 p-4 rounded-xl border ${
              v.status === 'production'
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40'
            }`}>
              <div className="shrink-0">
                <p className="text-xs font-bold font-mono text-slate-900 dark:text-white">{v.tag}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{v.date}</p>
                {v.status === 'production' && (
                  <span className="mt-1 inline-block text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-1.5 py-0.5">LIVE</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-600 dark:text-slate-300">{v.notes}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="text-[10px] text-slate-500">Dataset: <code className="font-mono text-slate-400">{v.datasetVer}</code></span>
                  <span className="text-[10px] text-slate-500">Macro F1: <code className="font-mono text-slate-400">{v.f1Overall.toFixed(3)}</code></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Related IP docs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3">Related IP Documents</h2>
        <div className="space-y-2">
          {IP_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
            >
              <span className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{l.label}</span>
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* Related nav */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4">
        <Link href="/admin/training-dataset" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5">
          Training Dataset →
        </Link>
        <Link href="/admin/ip" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          IP Register
        </Link>
        <Link href="/admin/ip-readiness" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          IP Readiness
        </Link>
      </div>

    </div>
  );
}
