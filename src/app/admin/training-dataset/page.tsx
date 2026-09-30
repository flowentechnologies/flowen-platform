import { assertAdmin } from '@/lib/admin/guard';
import Link from 'next/link';
import { DatasetReview } from './DatasetReview';
export const metadata = { title: 'Training Dataset - Flowen Admin' };
export const dynamic = 'force-dynamic';
export default async function TrainingDatasetPage() {
  await assertAdmin();
  return <div className="max-w-5xl space-y-6"><header><p className="text-sm font-semibold text-emerald-600">Admin-only data review</p><h1 className="text-3xl font-bold">Training Dataset</h1><p className="mt-2 text-slate-500">Review existing opted-in practice contributions. Counts come from the database, not a model card. No training job or external audio export runs here.</p></header>
    <section className="rounded-2xl border border-amber-300 p-5"><h2 className="font-semibold">Speech data remains sensitive</h2><p className="mt-2 text-sm">Only training-data samples with recorded consent and a currently opted-in contributor can be played or annotated. Playback links expire after 60 seconds; an already issued link remains valid until expiry. Voice and transcripts are not anonymous. Ordinary session recordings are never included.</p><p className="mt-2 text-sm">Current transcript and event fields are editable annotations, not proof of expert review. Corpus versioning, reviewer provenance, per-speaker train/test splits and training/export withdrawal controls must be implemented before model training.</p></section>
    <DatasetReview />
    <nav className="flex flex-wrap gap-5 text-emerald-600 underline"><Link href="/admin/asr-engine">ASR configuration and training readiness</Link><Link href="/dashboard/settings">Existing user contribution settings</Link><Link href="/admin/tickets/gdpr-requests">Data rights requests</Link></nav>
  </div>;
}
