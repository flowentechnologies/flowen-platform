import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import Link from 'next/link';

export const metadata = { title: 'Training Dataset - Flowen Admin' };
export const dynamic = 'force-dynamic';

type Sample = { stage_id: number | null; duration_seconds: number | null; created_at: string | null };

// Display-only. Counts come straight from the database on every load.
// No audio, transcripts, storage paths or signed links are shown or exported here.
export default async function TrainingDatasetPage() {
  await assertAdmin();
  const db = adminDb();

  const [samplesRes, consentRes] = await Promise.all([
    db.from('training_samples').select('stage_id, duration_seconds, created_at', { count: 'exact' }).limit(10000),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('consent_data_collection', true),
  ]);

  const failed = Boolean(samplesRes.error || consentRes.error);
  const rows = (samplesRes.data ?? []) as Sample[];
  const total = samplesRes.count ?? 0;
  const seconds = rows.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
  const truncated = total > rows.length;
  const latest = rows.map(r => r.created_at).filter((v): v is string => Boolean(v)).sort().at(-1);

  const byStage = new Map<string, { count: number; seconds: number }>();
  for (const r of rows) {
    const k = r.stage_id == null ? 'Unknown' : `Stage ${r.stage_id}`;
    const cur = byStage.get(k) ?? { count: 0, seconds: 0 };
    cur.count += 1;
    cur.seconds += r.duration_seconds ?? 0;
    byStage.set(k, cur);
  }

  const stats: [string, string][] = [
    ['Samples', total.toLocaleString('en-GB')],
    ['Audio collected', `${Math.round(seconds)} seconds (${(seconds / 60).toFixed(1)} min)`],
    ['Users currently opted in', (consentRes.count ?? 0).toLocaleString('en-GB')],
    ['Latest sample', latest ? new Date(latest).toLocaleString('en-GB') : 'None yet'],
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-emerald-600">Admin-only data status</p>
        <h1 className="text-3xl font-bold">Training Dataset</h1>
        <p className="mt-2 text-slate-500">
          Live counts of opted-in practice contributions. These are database counts, not a model card.
          No training job runs and no audio is exported from this page.
        </p>
      </header>

      {failed && (
        <section className="rounded-2xl border border-red-300 p-5 text-sm">
          The dataset could not be read from the database. The figures below may be incomplete.
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6 bg-white dark:bg-slate-900">
        <dl className="grid sm:grid-cols-2 gap-4">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase text-slate-500">{label}</dt>
              <dd className="mt-1 text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {truncated && (
          <p className="mt-4 text-sm text-slate-500">
            Duration and stage figures cover the first {rows.length.toLocaleString('en-GB')} samples only.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6 bg-white dark:bg-slate-900">
        <h2 className="text-xl font-semibold">By stage</h2>
        {byStage.size === 0 ? (
          <p className="mt-2 text-slate-500">No samples collected yet.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {[...byStage.entries()].map(([stage, v]) => (
              <li key={stage}>{stage}: {v.count} sample{v.count === 1 ? '' : 's'}, {Math.round(v.seconds)} seconds</li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-amber-300 p-5">
        <h2 className="font-semibold">Speech data is sensitive</h2>
        <p className="mt-2 text-sm">
          Voice and transcripts are not anonymous. Retention, withdrawal, reviewer provenance and
          per-speaker train and test splits are not implemented, so this dataset is not ready for training.
        </p>
      </section>

      <nav className="flex flex-wrap gap-5 text-emerald-600 underline">
        <Link href="/admin/asr-engine">ASR engine status</Link>
        <Link href="/dashboard/settings">User contribution settings</Link>
      </nav>
    </div>
  );
}
