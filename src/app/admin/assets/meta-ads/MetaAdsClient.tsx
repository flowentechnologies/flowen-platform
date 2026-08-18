'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Ratio = '9:16' | '1:1' | '16:9' | '3:4';
type Phase = 'idle' | 'submitting' | 'polling' | 'done' | 'error';

interface MetaFormat {
  id:          string;
  label:       string;
  ratio:       Ratio;
  resolution:  '720p' | '1080p';
  description: string;
  placements:  string[];
  /** Approximate CSS aspect ratio for the preview box */
  cssRatio:    string;
}

interface AssetFile {
  id:          string;
  name:        string;
  public_url:  string;
  file_size:   number | null;
  created_at:  string;
}

interface JobState {
  phase:   Phase;
  jobId:   string | null;
  elapsed: number;
  asset:   AssetFile | null;
  error:   string | null;
}

// ── Meta Ad Format Specs ──────────────────────────────────────────────────────

const META_FORMATS: MetaFormat[] = [
  {
    id:          'stories',
    label:       'Stories & Reels',
    ratio:       '9:16',
    resolution:  '1080p',
    description: 'Full-screen vertical video',
    placements:  ['Instagram Stories', 'Instagram Reels', 'Facebook Stories'],
    cssRatio:    '9/16',
  },
  {
    id:          'feed-square',
    label:       'Feed Square',
    ratio:       '1:1',
    resolution:  '1080p',
    description: 'Square format — maximum feed coverage',
    placements:  ['Instagram Feed', 'Facebook Feed', 'Audience Network'],
    cssRatio:    '1/1',
  },
  {
    id:          'feed-portrait',
    label:       'Feed Portrait',
    ratio:       '3:4',
    resolution:  '1080p',
    description: 'Tall portrait — takes more feed real estate',
    placements:  ['Instagram Feed', 'Facebook Feed'],
    cssRatio:    '3/4',
  },
  {
    id:          'feed-landscape',
    label:       'Feed Landscape',
    ratio:       '16:9',
    resolution:  '720p',
    description: 'Widescreen — Facebook in-stream and right column',
    placements:  ['Facebook Feed', 'Facebook In-Stream', 'Right Column'],
    cssRatio:    '16/9',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtElapsed(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtBytes(b: number | null) {
  if (!b) return '';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Phase badge ───────────────────────────────────────────────────────────────

function PhaseBadge({ phase, elapsed }: { phase: Phase; elapsed: number }) {
  if (phase === 'idle')
    return <span className="text-xs text-slate-500">Not started</span>;
  if (phase === 'submitting')
    return <span className="text-xs text-amber-400 animate-pulse">Submitting…</span>;
  if (phase === 'polling')
    return (
      <span className="text-xs text-violet-400 animate-pulse">
        ⏳ Generating — {fmtElapsed(elapsed)}
      </span>
    );
  if (phase === 'done')
    return <span className="text-xs text-emerald-400 font-semibold">✓ Done</span>;
  if (phase === 'error')
    return <span className="text-xs text-red-400 font-semibold">✕ Failed</span>;
  return null;
}

// ── Format Card ───────────────────────────────────────────────────────────────

function FormatCard({
  fmt,
  selected,
  onToggle,
  job,
}: {
  fmt:      MetaFormat;
  selected: boolean;
  onToggle: () => void;
  job:      JobState;
}) {
  const busy = job.phase === 'submitting' || job.phase === 'polling';

  return (
    <div
      className={`
        relative border rounded-2xl p-4 transition-all cursor-pointer select-none
        ${selected
          ? 'border-violet-500/60 bg-violet-500/5'
          : 'border-slate-700 bg-slate-900 hover:border-slate-600'}
        ${busy ? 'pointer-events-none opacity-90' : ''}
      `}
      onClick={() => !busy && onToggle()}
    >
      {/* Checkbox */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-white">{fmt.label}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{fmt.description}</p>
        </div>
        <div
          className={`
            w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 ml-2 mt-0.5
            ${selected ? 'bg-violet-600 border-violet-600' : 'border-slate-600'}
          `}
        >
          {selected && <span className="text-white text-xs font-bold">✓</span>}
        </div>
      </div>

      {/* Ratio preview box */}
      <div className="flex items-center justify-center mb-3">
        <div
          className="bg-slate-800 border border-slate-700 rounded overflow-hidden flex items-center justify-center"
          style={{
            aspectRatio: fmt.cssRatio,
            maxHeight: '80px',
            maxWidth: fmt.ratio === '16:9' ? '142px' : fmt.ratio === '9:16' ? '45px' : '80px',
            width: '100%',
          }}
        >
          {job.phase === 'done' && job.asset ? (
            <video
              src={job.asset.public_url}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
              autoPlay
            />
          ) : job.phase === 'polling' ? (
            <div className="flex flex-col items-center gap-1">
              <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <span className="text-[10px] text-slate-600 font-mono">{fmt.ratio}</span>
          )}
        </div>
      </div>

      {/* Placements */}
      <div className="flex flex-wrap gap-1 mb-2">
        {fmt.placements.map(p => (
          <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {p}
          </span>
        ))}
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <PhaseBadge phase={job.phase} elapsed={job.elapsed} />
        {job.phase === 'done' && job.asset && (
          <button
            onClick={e => {
              e.stopPropagation();
              navigator.clipboard.writeText(job.asset!.public_url);
            }}
            className="text-[11px] text-slate-400 hover:text-white transition-colors"
          >
            Copy URL
          </button>
        )}
      </div>

      {/* Error message */}
      {job.phase === 'error' && job.error && (
        <p className="mt-2 text-[11px] text-red-400 leading-snug">{job.error}</p>
      )}

      {/* File size */}
      {job.phase === 'done' && job.asset?.file_size && (
        <p className="mt-1 text-[10px] text-slate-600 font-mono">{fmtBytes(job.asset.file_size)}</p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MetaAdsClient({ existingAssets }: { existingAssets: AssetFile[] }) {
  const [prompt, setPrompt]         = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [model, setModel]           = useState('dreamina-seedance-2-5-260628');
  const [duration, setDuration]     = useState(8);
  const [genAudio, setGenAudio]     = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set(META_FORMATS.map(f => f.id)));
  const [jobs, setJobs]             = useState<Record<string, JobState>>(() =>
    Object.fromEntries(META_FORMATS.map(f => [f.id, { phase: 'idle', jobId: null, elapsed: 0, asset: null, error: null }]))
  );
  const [savedAssets, setSavedAssets] = useState<AssetFile[]>(existingAssets);

  // Refs for per-format poll/elapsed intervals
  const pollRefs    = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const elapsedRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(pollRefs.current).forEach(clearInterval);
      Object.values(elapsedRefs.current).forEach(clearInterval);
    };
  }, []);

  function setJob(id: string, patch: Partial<JobState>) {
    setJobs(j => ({ ...j, [id]: { ...j[id], ...patch } }));
  }

  function stopJob(id: string) {
    if (pollRefs.current[id])    { clearInterval(pollRefs.current[id]);    delete pollRefs.current[id]; }
    if (elapsedRefs.current[id]) { clearInterval(elapsedRefs.current[id]); delete elapsedRefs.current[id]; }
  }

  const pollStatus = useCallback(async (fmtId: string, jobId: string, name: string) => {
    const nameParam = encodeURIComponent(name);
    let res: Response;
    try {
      res = await fetch(`/api/admin/seedance/${jobId}?name=${nameParam}`);
    } catch {
      stopJob(fmtId);
      setJob(fmtId, { phase: 'error', error: 'Network error while polling' });
      return;
    }

    const data = await res.json() as { status: string; asset?: AssetFile; error?: string };

    if (data.status === 'succeeded' && data.asset) {
      stopJob(fmtId);
      setJob(fmtId, { phase: 'done', asset: data.asset });
      setSavedAssets(prev => [data.asset!, ...prev]);
      return;
    }
    if (data.status === 'failed') {
      stopJob(fmtId);
      setJob(fmtId, { phase: 'error', error: data.error ?? 'Generation failed' });
    }
    // pending/processing — keep polling
  }, []);

  async function generateFormat(fmt: MetaFormat, name: string) {
    setJob(fmt.id, { phase: 'submitting', jobId: null, elapsed: 0, asset: null, error: null });

    let res: Response;
    try {
      res = await fetch('/api/admin/seedance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          prompt,
          model,
          ratio:          fmt.ratio,
          resolution:     fmt.resolution,
          duration,
          generate_audio: genAudio,
        }),
      });
    } catch {
      setJob(fmt.id, { phase: 'error', error: 'Network error submitting job' });
      return;
    }

    const data = await res.json() as { jobId?: string; error?: string };
    if (!res.ok || !data.jobId) {
      setJob(fmt.id, { phase: 'error', error: data.error ?? 'Failed to start generation' });
      return;
    }

    setJob(fmt.id, { phase: 'polling', jobId: data.jobId });

    // Elapsed timer
    elapsedRefs.current[fmt.id] = setInterval(() => {
      setJobs(j => ({ ...j, [fmt.id]: { ...j[fmt.id], elapsed: j[fmt.id].elapsed + 1 } }));
    }, 1000);

    // Poll every 5s, max 150 attempts
    let attempts = 0;
    // Poll immediately
    await pollStatus(fmt.id, data.jobId, name);

    pollRefs.current[fmt.id] = setInterval(async () => {
      attempts++;
      if (attempts > 150) {
        stopJob(fmt.id);
        setJob(fmt.id, { phase: 'error', error: 'Timed out after 12 min' });
        return;
      }
      await pollStatus(fmt.id, data.jobId!, name);
    }, 5000);
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    const cname = campaignName.trim() || prompt.slice(0, 40);

    // Fire all selected formats simultaneously
    await Promise.all(
      META_FORMATS
        .filter(f => selected.has(f.id))
        .map(fmt => generateFormat(fmt, `${cname} — ${fmt.label}`))
    );
  }

  function resetAll() {
    Object.keys(jobs).forEach(stopJob);
    setJobs(Object.fromEntries(
      META_FORMATS.map(f => [f.id, { phase: 'idle', jobId: null, elapsed: 0, asset: null, error: null }])
    ));
    setPrompt('');
    setCampaignName('');
  }

  const anyBusy = Object.values(jobs).some(j => j.phase === 'submitting' || j.phase === 'polling');
  const allDone = META_FORMATS.filter(f => selected.has(f.id)).every(f => jobs[f.id]?.phase === 'done');
  const anyStarted = Object.values(jobs).some(j => j.phase !== 'idle');
  const selectedCount = selected.size;

  // Filter saved meta-ads assets for the library below
  const metaAssets = savedAssets.filter(a => a.name.includes('—') || true); // show all for now

  return (
    <div className="space-y-8">

      {/* ── Campaign brief ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Campaign brief</h2>
          <p className="text-sm text-slate-400 mt-0.5">One prompt generates all selected formats simultaneously</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Campaign name</label>
            <input
              type="text"
              placeholder="e.g. Summer Launch 2026"
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
              disabled={anyBusy}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              disabled={anyBusy}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            >
              <option value="dreamina-seedance-2-5-260628">Seedance 2.5 — Latest</option>
              <option value="dreamina-seedance-2-0-260128">Seedance 2.0 — Standard</option>
              <option value="dreamina-seedance-2-0-fast-260128">Seedance 2.0 Fast — Lower cost</option>
              <option value="dreamina-seedance-2-0-mini-260615">Seedance 2.0 Mini — Drafts</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Video prompt</label>
          <textarea
            rows={3}
            placeholder="Describe the ad video. e.g. A speech therapist working with a child, warm natural light, modern clinic, confidence and progress. Clear professional voiceover."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={anyBusy}
            className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-6">
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Duration</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={4} max={15} step={1}
                value={duration}
                onChange={e => setDuration(+e.target.value)}
                disabled={anyBusy}
                className="w-24 accent-violet-500"
              />
              <span className="text-sm font-mono text-slate-300">{duration}s</span>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none mt-4">
            <div
              onClick={() => !anyBusy && setGenAudio(a => !a)}
              className={`
                w-9 h-5 rounded-full transition-colors flex-shrink-0
                ${genAudio ? 'bg-violet-600' : 'bg-slate-700'}
                ${anyBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform m-0.5 ${genAudio ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm text-slate-300">Generate audio</span>
          </label>
        </div>
      </div>

      {/* ── Format selection grid ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ad formats</h2>
            <p className="text-sm text-slate-400 mt-0.5">{selectedCount} of {META_FORMATS.length} selected</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected(new Set(META_FORMATS.map(f => f.id)))}
              disabled={anyBusy}
              className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-30"
            >
              All
            </button>
            <span className="text-slate-700">·</span>
            <button
              onClick={() => setSelected(new Set())}
              disabled={anyBusy}
              className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-30"
            >
              None
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {META_FORMATS.map(fmt => (
            <FormatCard
              key={fmt.id}
              fmt={fmt}
              selected={selected.has(fmt.id)}
              onToggle={() => setSelected(s => {
                const n = new Set(s);
                n.has(fmt.id) ? n.delete(fmt.id) : n.add(fmt.id);
                return n;
              })}
              job={jobs[fmt.id]}
            />
          ))}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        {!anyStarted || allDone ? (
          <button
            onClick={handleGenerate}
            disabled={anyBusy || !prompt.trim() || selectedCount === 0}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-sm transition-colors flex items-center gap-2"
          >
            ✨ Generate {selectedCount > 1 ? `${selectedCount} formats` : 'format'}
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={anyBusy || !prompt.trim() || selectedCount === 0}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-sm transition-colors flex items-center gap-2"
          >
            {anyBusy
              ? `⏳ Generating… (${Object.values(jobs).filter(j => j.phase === 'done').length}/${selectedCount} done)`
              : '✨ Regenerate'}
          </button>
        )}
        {anyStarted && (
          <button
            onClick={resetAll}
            disabled={anyBusy}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-30"
          >
            Reset
          </button>
        )}
        {allDone && (
          <span className="text-sm text-emerald-400 font-semibold">
            ✓ All {selectedCount} formats saved to Assets
          </span>
        )}
      </div>

      {/* ── Generated library ── */}
      {metaAssets.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Generated assets
            <span className="ml-2 text-sm font-normal text-slate-400">({metaAssets.length} videos)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {metaAssets.map(a => (
              <div key={a.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <video
                  src={a.public_url}
                  className="w-full aspect-video object-cover bg-slate-950"
                  muted
                  loop
                  playsInline
                  controls
                />
                <div className="p-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{a.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">{fmtBytes(a.file_size)}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(a.public_url)}
                    className="mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
