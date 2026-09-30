import { assertAdmin } from '@/lib/admin/guard';
import Link from 'next/link';
import { getAsrConfig } from '@/lib/asr/config';
export const metadata = { title: 'ASR Engine - Flowen Admin' };
export const dynamic = 'force-dynamic';
export default async function ASREnginePage() {
  await assertAdmin();
  const config = getAsrConfig();
  const limited = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  return <div className="space-y-6 max-w-5xl">
    <header><p className="text-sm text-emerald-600 font-semibold">Implementation status</p><h1 className="text-3xl font-bold">ASR Engine</h1><p className="mt-2 text-slate-500">Transcription and acoustic biofeedback are separate paths. No trained Flowen model artifact or benchmark is registered in this implementation.</p></header>
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6 bg-white dark:bg-slate-900"><h2 className="text-xl font-semibold">Real-time acoustic path</h2><p className="mt-2">16 kHz mono PCM, 10 ms frames, on-device AudioWorklet and rule-based event detection. Speaker baseline adapts within each session. No transcription network request is added to this loop.</p><p className="mt-3 text-slate-500">The sub-80 ms target needs device measurements. It is not a verified model-inference benchmark. Block and repetition heuristics can misclassify ordinary pauses and similar-duration sounds.</p></section>
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6 bg-white dark:bg-slate-900"><h2 className="text-xl font-semibold">Transcription configuration</h2><dl className="grid sm:grid-cols-2 gap-4 mt-4">{[
      ['Web', 'Browser Web Speech API; availability depends on browser'],
      ['Mobile endpoint', `/api/practice/asr → ${config.model}`],
      ['Provider credential', config.configured ? 'Configured (value hidden)' : 'Not configured'],
      ['Distributed request limit', limited ? 'Configured: 360 chunks / user / hour' : 'Not configured: paid Production requests fail closed'],
      ['Language', config.language], ['Request timeout', `${config.timeoutMs} ms`],
      ['Vocabulary prompt', config.prompt ? 'Configured; value hidden' : 'None (no coaching text injected)'],
      ['Audio format', 'Mono PCM16 WAV, 8–48 kHz; 0.5–30 seconds'],
    ].map(([label, value]) => <div key={label}><dt className="text-xs uppercase text-slate-500">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl><p className="mt-5 text-sm text-slate-500">Change ASR_LANGUAGE (two-letter language code), ASR_TIMEOUT_MS (1,000–30,000) and optional ASR_VOCABULARY_PROMPT in deployment settings, then redeploy. Credential values are never shown here. Provider and model changes require review of accuracy, data processing and cost.</p></section>
    <section className="rounded-2xl border border-amber-300 p-6"><h2 className="text-xl font-semibold">Training is not connected yet</h2><p className="mt-2">Dataset review is available. There is no GPU worker, model registry, validated evaluation split or model promotion/rollback service. A training job cannot honestly be started from this page.</p><ul className="list-disc pl-5 mt-3 space-y-1"><li>Approve permitted speech-data use, retention, withdrawal and processor terms.</li><li>Review labels and split by speaker before evaluation to prevent leakage.</li><li>Select a training service and spending limit, then connect a job runner.</li><li>Measure event accuracy and end-to-end device latency before any rollout.</li></ul></section>
    <nav className="flex flex-wrap gap-5 text-emerald-600 underline"><Link href="/admin/training-dataset">Review training data</Link><Link href="/admin/usage-costs">Usage and measured latency</Link><Link href="/dashboard/settings">Contribution settings</Link></nav>
  </div>;
}
