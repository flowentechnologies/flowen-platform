import { assertAdmin } from '@/lib/admin/guard';
import Link from 'next/link';

export const metadata = { title: 'ASR Engine - Flowen Admin' };
export const dynamic = 'force-dynamic';

// Display-only status page. Every value below is either read from the running
// deployment (environment presence, never the value) or states what the code does.
export default async function ASREnginePage() {
  await assertAdmin();
  const openAiKeySet = Boolean(process.env.OPENAI_API_KEY);

  const rows: [string, string][] = [
    ['Web transcription', 'Browser Web Speech API. Availability depends on the browser.'],
    ['Mobile transcription', 'POST /api/practice/asr sends audio chunks to OpenAI whisper-1.'],
    [
      'Mobile transcription credential',
      openAiKeySet
        ? 'OPENAI_API_KEY is set in this deployment (value hidden)'
        : 'OPENAI_API_KEY is not set in this deployment: mobile transcription returns 503',
    ],
    ['Audio format accepted', 'Base64 WAV, 0.5 to 30 seconds, up to 24 MB encoded'],
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <p className="text-sm text-emerald-600 font-semibold">Implementation status</p>
        <h1 className="text-3xl font-bold">ASR Engine</h1>
        <p className="mt-2 text-slate-500">
          Transcription and acoustic biofeedback are separate paths. No trained Flowen model, model
          registry or accuracy benchmark exists. Nothing on this page is a model statistic.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6 bg-white dark:bg-slate-900">
        <h2 className="text-xl font-semibold">Real-time acoustic path</h2>
        <p className="mt-2">
          16 kHz mono PCM, 10 ms frames, on-device AudioWorklet and rule-based event detection. The
          speaker baseline adapts within each session. This loop makes no transcription network request.
        </p>
        <p className="mt-3 text-slate-500">
          The sub-80 ms figure is a design target that needs on-device measurement. It is not a
          verified benchmark. Block and repetition heuristics can misclassify ordinary pauses.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6 bg-white dark:bg-slate-900">
        <h2 className="text-xl font-semibold">Transcription (what runs today)</h2>
        <dl className="grid sm:grid-cols-2 gap-4 mt-4">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase text-slate-500">{label}</dt>
              <dd className="mt-1 break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-sm text-slate-500">
          Transcription is a third-party service, not a Flowen-built model. A move to self-hosted
          Whisper is drafted separately and is not deployed.
        </p>
      </section>

      <section className="rounded-2xl border border-amber-300 p-6">
        <h2 className="text-xl font-semibold">Training is not connected</h2>
        <p className="mt-2">
          Collected samples can be counted on the dataset page. There is no GPU worker, model registry,
          evaluation split or promotion and rollback service, so a training job cannot honestly be
          started from here.
        </p>
      </section>

      <nav className="flex flex-wrap gap-5 text-emerald-600 underline">
        <Link href="/admin/training-dataset">Training dataset</Link>
        <Link href="/admin/usage-costs">Usage and costs</Link>
      </nav>
    </div>
  );
}
