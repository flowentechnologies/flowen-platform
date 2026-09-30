'use client';
import { useCallback, useEffect, useState } from 'react';
type Sample = { id: string; created_at: string; duration_seconds: number | null; stage_id: number | null; transcript: string | null; disfluency_events: unknown; eligible: boolean; consent_version: string | null };
type Data = { samples: Sample[]; stats: { total_samples: number; consented_users: number }; has_more: boolean };
async function action(body: Record<string, unknown>) {
  const r = await fetch('/api/admin/dataset/sample', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Request failed'); return data;
}
function Review({ sample, onSaved }: { sample: Sample; onSaved: () => void }) {
  const [transcript, setTranscript] = useState(sample.transcript ?? '');
  const [events, setEvents] = useState(JSON.stringify(sample.disfluency_events ?? [], null, 2));
  const [url, setUrl] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => { if (!url) return; const timer = setTimeout(() => setUrl(''), 60000); return () => clearTimeout(timer); }, [url]);
  const run = async (play: boolean) => {
    setBusy(true); setMessage('');
    try {
      if (play) setUrl((await action({ id: sample.id, action: 'playback' })).url);
      else { const parsed = JSON.parse(events); await action({ id: sample.id, action: 'annotate', transcript, events: parsed, previous: sample.transcript ?? '', previousEvents: JSON.stringify(sample.disfluency_events ?? []) }); setMessage('Annotation saved'); onSaved(); }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(false); }
  };
  return <article className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">Sample {sample.id.slice(0, 8)}</h3><p className="text-sm text-slate-500">{sample.duration_seconds ?? '?'} seconds · stage {sample.stage_id ?? '?'} · {new Date(sample.created_at).toLocaleDateString('en-GB')}</p></div>
    {!sample.eligible ? <p className="text-amber-700 dark:text-amber-300">Excluded: current consent or collection consent record is missing. Speech content is hidden.</p> : <>
      <p className="text-xs text-slate-500">Collection consent version: {sample.consent_version}</p>
      <button type="button" disabled={busy} onClick={() => run(true)} className="rounded-lg border px-4 py-2 disabled:opacity-50">Load audio for review</button>
      {url && <audio controls src={url} preload="none" className="w-full" aria-label={`Audio for sample ${sample.id.slice(0, 8)}`} />}
      <label className="block text-sm font-medium">Transcript<textarea value={transcript} onChange={e => setTranscript(e.target.value)} maxLength={20000} rows={3} className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent p-3 mt-1" /></label>
      <label className="block text-sm font-medium">Event annotations (JSON)<textarea value={events} onChange={e => setEvents(e.target.value)} rows={4} className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent p-3 mt-1 font-mono text-xs" /></label>
      <p className="text-xs text-slate-500">Each event: {`{"type":"BLOCK","onset_ms":200,"duration_ms":300}`}. Types: BLOCK, PROLONG, REP_START, REP_END, INTERJ, FALSE_START. Timestamps must fit the audio duration. Empty [] means no event annotations, not a fluent-speech certification.</p>
      <button type="button" onClick={() => run(false)} disabled={busy} className="rounded-lg bg-emerald-700 text-white px-4 py-2 disabled:opacity-50">{busy ? 'Working...' : 'Save annotation'}</button>
    </>}
    <p role="status" className="text-sm">{message}</p>
  </article>;
}
export function DatasetReview() {
  const [page, setPage] = useState(0), [data, setData] = useState<Data | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try { const r = await fetch(`/api/admin/dataset?page=${page}`, { cache: 'no-store', signal }); const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Dataset unavailable'); setData(body); }
    catch (e) { if (signal?.aborted) return; setData(null); setError(e instanceof Error ? e.message : 'Dataset unavailable'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [page]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  return <section className="space-y-4"><div className="flex flex-wrap gap-4 justify-between items-center"><h2 className="text-xl font-semibold">Collection and annotation queue</h2><button onClick={() => load()} disabled={loading} className="rounded-lg border px-4 py-2 disabled:opacity-50">Refresh</button></div>
    {loading && <p role="status">Loading current dataset...</p>}{error && <p role="alert" className="text-red-600">{error}. Try Refresh. Missing tables or database permissions are not treated as an empty corpus.</p>}
    {data && !loading && <><div className="grid grid-cols-2 gap-4">{[['Collected samples', data.stats.total_samples], ['Currently opted-in users', data.stats.consented_users]].map(([label, count]) => <div key={label} className="rounded-xl border p-5"><p className="text-sm text-slate-500">{label}</p><p className="text-3xl font-bold mt-1">{count}</p></div>)}</div>
      {!data.samples.length && <p className="rounded-xl border p-6">No samples on this page. Existing users can choose to contribute in Settings, then complete a practice session. Contribution is optional and does not unlock features.</p>}
      {data.samples.map(s => <Review key={`${s.id}:${s.transcript}:${JSON.stringify(s.disfluency_events)}`} sample={s} onSaved={() => load()} />)}
      <nav aria-label="Dataset pages" className="flex items-center gap-4"><button disabled={!page} onClick={() => setPage(p => p - 1)} className="border rounded-lg px-4 py-2 disabled:opacity-50">Previous</button><span>Page {page + 1}</span><button disabled={!data.has_more} onClick={() => setPage(p => p + 1)} className="border rounded-lg px-4 py-2 disabled:opacity-50">Next</button></nav></>}
  </section>;
}
