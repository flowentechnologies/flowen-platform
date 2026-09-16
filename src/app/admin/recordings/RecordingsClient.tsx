'use client';

import { useState, useEffect } from 'react';

interface Recording {
  id: string;
  user_id: string;
  brand: string | null;
  stage_id: number | null;
  created_at: string;
  duration_seconds: number | null;
  total_blocks_detected: number | null;
  total_repetitions_detected: number | null;
  total_prolongations_detected: number | null;
  audio_storage_path: string;
  audio_storage_provider: string;
  signedUrl: string | null;
}

interface ApiResponse {
  by_category: Record<string, { count: number; seconds: number }>;
  recordings: Recording[];
  page: number;
  has_more: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RecordingsClient() {
  const [byCategory, setByCategory] = useState<ApiResponse['by_category']>({});
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [brand, setBrand] = useState('');
  const [stageId, setStageId] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (brand) params.set('brand', brand);
    if (stageId) params.set('stage_id', stageId);

    fetch(`/api/admin/recordings?${params.toString()}`)
      .then(res => res.json())
      .then((data: ApiResponse) => {
        setByCategory(data.by_category);
        setRecordings(data.recordings);
        setHasMore(data.has_more);
      })
      .finally(() => setLoading(false));
  }, [brand, stageId, page]);

  const play = async (rec: Recording) => {
    if (rec.signedUrl) { setPlayingId(rec.id); return; }
    const res = await fetch(`/api/admin/recordings?export=1&id=${rec.id}`);
    const data: ApiResponse = await res.json();
    const withUrl = data.recordings[0];
    setRecordings(prev => prev.map(r => (r.id === rec.id && withUrl ? { ...r, signedUrl: withUrl.signedUrl } : r)));
    setPlayingId(rec.id);
  };

  const categoryEntries = Object.entries(byCategory).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Session Recordings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Practice session audio — Supabase Storage or Cloudflare R2, whichever <code>audio_storage_provider</code> says.
          Not a training dataset — see <a href="/admin/training-dataset" className="underline">Training Dataset</a> for the
          separately consent-gated ML corpus. This page is for finding and playing back one session&apos;s recording.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categoryEntries.length === 0 && !loading && (
          <p className="text-sm text-slate-400 col-span-full">No recordings yet.</p>
        )}
        {categoryEntries.slice(0, 8).map(([label, stats]) => (
          <button
            key={label}
            onClick={() => {
              const [b, stg] = label.split(' / stage ');
              setBrand(b === 'unbranded' ? '' : b);
              setStageId(stg === 'unknown' ? '' : stg);
              setPage(0);
            }}
            className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-amber-400 transition"
          >
            <p className="text-lg font-bold text-slate-900 dark:text-white">{stats.count}</p>
            <p className="text-xs text-slate-400 mt-1">{label} · {Math.round(stats.seconds / 60)}m</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={brand}
          onChange={e => { setBrand(e.target.value); setPage(0); }}
          className="text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5"
        >
          <option value="">All brands</option>
          <option value="flowen">Flowen</option>
          <option value="vocali">Vocali</option>
        </select>
        <input
          value={stageId}
          onChange={e => { setStageId(e.target.value.replace(/[^0-9]/g, '')); setPage(0); }}
          placeholder="Stage #"
          className="text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 w-24"
        />
        {(brand || stageId) && (
          <button
            onClick={() => { setBrand(''); setStageId(''); setPage(0); }}
            className="text-xs text-slate-400 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-2">
          {recordings.length === 0 && <p className="text-sm text-slate-400">No recordings match these filters.</p>}
          {recordings.map(rec => (
            <div key={rec.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {rec.brand ?? 'unbranded'} · stage {rec.stage_id ?? '—'} · {formatDuration(rec.duration_seconds)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {rec.total_blocks_detected ?? 0} blocks · {rec.total_repetitions_detected ?? 0} repetitions · {rec.total_prolongations_detected ?? 0} prolongations
                </p>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">{rec.audio_storage_provider}</span>
                <p className="text-[10px] text-slate-400">{new Date(rec.created_at).toLocaleDateString('en-GB')}</p>
                {playingId === rec.id && rec.signedUrl ? (
                  <audio controls autoPlay src={rec.signedUrl} className="h-8" />
                ) : (
                  <button
                    onClick={() => play(rec)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold"
                  >
                    Play
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex justify-between pt-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={!hasMore}
              onClick={() => setPage(p => p + 1)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
