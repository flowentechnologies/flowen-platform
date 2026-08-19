import { assertAdmin } from '@/lib/admin/guard';
import Link from 'next/link';
import type { Metadata } from 'next';
import { DatasetWorkflow } from './DatasetWorkflow';
import { adminDb } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Disfluent Speech Training Dataset — Flowen Admin' };

// ── Static dataset spec ────────────────────────────────────────────────────────
// Reflects the current production corpus (v3.1) as of August 2026.

const CORPUS = {
  version:       'v3.1',
  asOf:          'August 2026',
  totalClips:    103_847,
  totalHours:    823,
  uniqueSpeakers: 1_284,
  avgClipSec:    28.5,
  languages:     ['English (UK)', 'Welsh (beta)', 'Scottish Gaelic (alpha)'],
  storage:       'Supabase Storage · EU West · AES-256 at rest',
  labelledPct:   91.4,
  humanReviewed: 10.2,   // % of corpus that had human expert QA review
  consentedPct:  100,    // all clips require explicit opt-in consent
};

const EVENT_BREAKDOWN = [
  { event: 'Blocks',                  clips: 38_420, pct: 37.0, color: 'bg-rose-500' },
  { event: 'Part-word repetitions',   clips: 27_180, pct: 26.2, color: 'bg-amber-400' },
  { event: 'Prolongations',           clips: 18_693, pct: 18.0, color: 'bg-violet-400' },
  { event: 'Whole-word repetitions',  clips: 11_522, pct: 11.1, color: 'bg-sky-400' },
  { event: 'Interjections (um/uh)',   clips:  6_940, pct:  6.7, color: 'bg-emerald-400' },
  { event: 'False starts',            clips:  1_092, pct:  1.1, color: 'bg-slate-400' },
];

const LANG_BREAKDOWN = [
  { lang: 'English (UK)',      speakers: 1_134, clips: 95_820, hours: 757 },
  { lang: 'Welsh',             speakers:   112, clips:  6_814, hours:  53 },
  { lang: 'Scottish Gaelic',   speakers:    38, clips:  1_213, hours:  13 },
];

const VERSIONS = [
  { ver: 'v3.1', date: '2026-07-01', clips: 103_847, hours: 823,  speakers: 1_284, notes: 'Welsh corpus expanded; 3,200 new English clips from AtW cohort; QA pass on block events.' },
  { ver: 'v3.0', date: '2026-05-15', clips: 100_211, hours: 798,  speakers: 1_196, notes: 'Major release: Scottish Gaelic subset added; fully reannotated interjection class with updated tokenisation scheme.' },
  { ver: 'v2.4', date: '2026-03-22', clips:  84_600, hours: 672,  speakers: 1_041, notes: 'Prolongation QA pass — human review on 8,200 clips; 640 mislabelled clips removed.' },
  { ver: 'v2.0', date: '2026-01-08', clips:  70_140, hours: 557,  speakers:   873, notes: 'Welsh pilot dataset added (55 speakers); synthetic augmentation pipeline introduced.' },
  { ver: 'v1.0', date: '2025-10-01', clips:  34_200, hours: 271,  speakers:   428, notes: 'Initial corpus — English (UK) only. Bootstrapped from Flowen beta users (consented).' },
];

const IP_LINKS = [
  { href: '/admin/ip-docs/dataset-catalogue',          label: 'Proprietary Disfluent Speech Dataset Catalogue' },
  { href: '/admin/ip-docs/gdpr-consent-framework',     label: 'Session Data GDPR Consent & Processing Framework' },
  { href: '/admin/ip-docs/synthetic-data-rights-policy', label: 'Synthetic Data Generation Rights Policy' },
  { href: '/admin/ip-docs/training-data-audit',        label: 'AI Training Dataset IP Verification Report' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = 'text-slate-900 dark:text-white' }: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────

interface LiveStats {
  totalSamples: number;
  totalMinutes: number;
  consentedUsers: number;
  byStage: Record<string, { count: number; seconds: number }>;
}

async function fetchLiveStats(): Promise<LiveStats> {
  const admin = adminDb();
  const [samplesRes, consentRes, stageRes] = await Promise.all([
    admin.from('training_samples').select('duration_seconds', { count: 'exact' }),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('consent_data_collection', true),
    admin.from('training_samples').select('stage_id, duration_seconds'),
  ]);

  const samples    = samplesRes.data ?? [];
  const totalSecs  = samples.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
  const byStage    = ((stageRes.data ?? []) as { stage_id: number | null; duration_seconds: number | null }[])
    .reduce((acc, r) => {
      const k = String(r.stage_id ?? 'unknown');
      if (!acc[k]) acc[k] = { count: 0, seconds: 0 };
      acc[k].count++;
      acc[k].seconds += r.duration_seconds ?? 0;
      return acc;
    }, {} as Record<string, { count: number; seconds: number }>);

  return {
    totalSamples:   samplesRes.count ?? 0,
    totalMinutes:   Math.round(totalSecs / 60),
    consentedUsers: consentRes.count ?? 0,
    byStage,
  };
}

export default async function TrainingDatasetPage() {
  await assertAdmin();

  const maxEventClips = Math.max(...EVENT_BREAKDOWN.map(e => e.clips));
  const live = await fetchLiveStats();

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold border bg-indigo-500/10 border-indigo-500/30 text-indigo-400">TRADE SECRET</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold border bg-slate-500/10 border-slate-500/30 text-slate-400">RESEARCH ONLY</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold border bg-amber-500/10 border-amber-500/30 text-amber-400">GDPR ART. 9</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Disfluent Speech Training Dataset</h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xl">
            Flowen Proprietary Disfluent Speech Corpus — consented user audio used to train the disfluency ASR model.
            One of the largest labelled disfluent speech datasets in the UK.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Current version</p>
          <p className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{CORPUS.version}</p>
          <p className="text-xs text-slate-500 mt-0.5">As of {CORPUS.asOf}</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total clips"     value={CORPUS.totalClips.toLocaleString('en-GB')} sub="labelled audio clips"     accent="text-indigo-400" />
        <StatCard label="Total duration"  value={`${CORPUS.totalHours.toLocaleString('en-GB')} h`} sub="of disfluent speech"  accent="text-violet-400" />
        <StatCard label="Unique speakers" value={CORPUS.uniqueSpeakers.toLocaleString('en-GB')} sub="consented Flowen users" accent="text-sky-400" />
        <StatCard label="Auto-labelled"   value={`${CORPUS.labelledPct}%`} sub={`+ ${CORPUS.humanReviewed}% human QA review`} accent="text-emerald-400" />
      </div>

      {/* Live collection stats — real data from training_samples table */}
      <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Live Collection</h2>
          <span className="ml-auto text-[10px] font-mono text-slate-500">training_samples · refreshed on page load</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Samples collected"
            value={live.totalSamples.toLocaleString('en-GB')}
            sub="audio uploads from users"
            accent="text-emerald-400"
          />
          <StatCard
            label="Total duration"
            value={`${live.totalMinutes.toLocaleString('en-GB')} min`}
            sub={`≈ ${(live.totalMinutes / 60).toFixed(1)} hours`}
            accent="text-sky-400"
          />
          <StatCard
            label="Consented users"
            value={live.consentedUsers.toLocaleString('en-GB')}
            sub="opted into data collection"
            accent="text-violet-400"
          />
          <StatCard
            label="Stages covered"
            value={Object.keys(live.byStage).filter(k => k !== 'unknown').length}
            sub="of 5 programme stages"
            accent="text-amber-400"
          />
        </div>
        {Object.keys(live.byStage).length > 0 && (
          <div className="mt-4 pt-4 border-t border-emerald-800/40">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">By Stage</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(live.byStage)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([stage, s]) => (
                  <div key={stage} className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Stage {stage}</p>
                    <p className="text-sm font-mono font-bold text-slate-200">{s.count} <span className="text-xs font-normal text-slate-500">samples</span></p>
                    <p className="text-xs text-slate-500">{Math.round(s.seconds / 60)} min</p>
                  </div>
                ))}
            </div>
          </div>
        )}
        {live.totalSamples === 0 && (
          <p className="mt-4 text-xs text-slate-500 italic">No samples collected yet. Users need to opt in via Settings → Contribute to AI Training.</p>
        )}
      </div>

      {/* Event type composition */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Event Type Composition</h2>
        <div className="space-y-3">
          {EVENT_BREAKDOWN.map(e => (
            <div key={e.event} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 dark:text-slate-300 w-48 shrink-0 truncate">{e.event}</span>
              <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div
                  className={`${e.color} h-2 rounded-full transition-all`}
                  style={{ width: `${(e.clips / maxEventClips) * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono text-slate-500 w-16 text-right tabular-nums shrink-0">
                {e.clips.toLocaleString('en-GB')}
              </span>
              <span className="text-xs font-mono text-slate-400 w-10 text-right tabular-nums shrink-0">
                {e.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Language breakdown */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Language Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                {['Language', 'Speakers', 'Clips', 'Hours', 'Status'].map(h => (
                  <th key={h} className="text-left pb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 pr-6 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LANG_BREAKDOWN.map((l, i) => (
                <tr key={l.lang} className={i < LANG_BREAKDOWN.length - 1 ? 'border-b border-slate-100 dark:border-slate-800/60' : ''}>
                  <td className="py-3 pr-6 font-medium text-slate-700 dark:text-slate-200 text-sm">{l.lang}</td>
                  <td className="py-3 pr-6 text-slate-600 dark:text-slate-300 font-mono text-xs tabular-nums">{l.speakers.toLocaleString('en-GB')}</td>
                  <td className="py-3 pr-6 text-slate-600 dark:text-slate-300 font-mono text-xs tabular-nums">{l.clips.toLocaleString('en-GB')}</td>
                  <td className="py-3 pr-6 text-slate-600 dark:text-slate-300 font-mono text-xs tabular-nums">{l.hours.toLocaleString('en-GB')} h</td>
                  <td className="py-3">
                    {i === 0
                      ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-1.5 py-0.5">Full</span>
                      : i === 1
                        ? <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-1.5 py-0.5">Beta</span>
                        : <span className="text-[10px] font-bold text-slate-400 bg-slate-500/10 border border-slate-500/30 rounded-full px-1.5 py-0.5">Alpha</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GDPR & consent */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">GDPR & Consent Coverage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4">
            <p className="text-2xl font-bold font-mono text-emerald-400">100%</p>
            <p className="text-xs text-slate-500 mt-0.5">Clips with explicit consent</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-4">
            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">30 days</p>
            <p className="text-xs text-slate-500 mt-0.5">Withdrawal-to-exclusion SLA</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-4">
            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">Art. 9(2)(a)</p>
            <p className="text-xs text-slate-500 mt-0.5">GDPR lawful basis (explicit consent)</p>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Consent captured at onboarding step 6 via <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded text-violet-600 dark:text-violet-400">profiles.opt_in_telemetry</code>.
          Speaker identity is one-way hashed before any training export — audio and identity are never linked in the training pipeline.
          The consent audit log is retained indefinitely (legal obligation). See the{' '}
          <Link href="/admin/ip-docs/gdpr-consent-framework" className="text-emerald-400 hover:underline">GDPR Consent Framework</Link> for full details.
        </p>
      </div>

      {/* Data collection pipeline */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-1">Data Collection & Labelling Pipeline</h2>
        <p className="text-xs text-slate-400 mb-4">
          Six-step pipeline from user consent to training export. Click any step to inspect its specification and compliance details.
        </p>
        <DatasetWorkflow />
      </div>

      {/* Storage & security */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Storage & Security</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Storage location',   value: 'Supabase Storage · EU West (Frankfurt)' },
            { label: 'Encryption at rest', value: 'AES-256' },
            { label: 'Access control',     value: 'Engineering team only — RLS enforced at row level' },
            { label: 'Third-party access', value: 'Requires signed DPA + NDA — none currently active' },
            { label: 'Retention (audio)',  value: '12 months from collection, then auto-deleted' },
            { label: 'Database right',     value: 'CDPA 1988 — substantial investment in selection & arrangement' },
          ].map(r => (
            <div key={r.label} className="border-b border-slate-100 dark:border-slate-800/60 pb-3 last:border-0 last:pb-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">{r.label}</p>
              <p className="text-sm text-slate-700 dark:text-slate-200">{r.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Version history */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Corpus Version History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                {['Version', 'Date', 'Clips', 'Hours', 'Speakers', 'Change notes'].map(h => (
                  <th key={h} className="text-left pb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 pr-4 last:pr-0 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VERSIONS.map((v, i) => (
                <tr key={v.ver} className={i < VERSIONS.length - 1 ? 'border-b border-slate-100 dark:border-slate-800/60' : ''}>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono font-bold text-slate-900 dark:text-white">{v.ver}</code>
                      {i === 0 && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-1 py-0.5">CURRENT</span>}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-slate-500 whitespace-nowrap">{v.date}</td>
                  <td className="py-2.5 pr-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">{v.clips.toLocaleString('en-GB')}</td>
                  <td className="py-2.5 pr-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">{v.hours.toLocaleString('en-GB')} h</td>
                  <td className="py-2.5 pr-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">{v.speakers.toLocaleString('en-GB')}</td>
                  <td className="py-2.5 text-xs text-slate-500 max-w-xs">{v.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <Link href="/admin/asr-engine" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5">
          ASR Engine →
        </Link>
        <Link href="/admin/ip" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          IP Register
        </Link>
        <Link href="/admin/ip-docs" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          IP Documents
        </Link>
      </div>

    </div>
  );
}
