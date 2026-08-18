'use client';

import React, { useState, useTransition, useRef, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Folder = 'general' | 'images' | 'audio' | 'video' | 'documents' | 'brand';

interface AssetFile {
  id: string;
  name: string;
  description: string | null;
  folder: Folder;
  filename: string;
  storage_path: string;
  public_url: string;
  file_size: number | null;
  mime_type: string | null;
  tags: string[];
  created_at: string;
}

interface Props {
  initialAssets: AssetFile[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const FOLDERS: { id: Folder; label: string; color: string }[] = [
  { id: 'general',   label: 'General',   color: 'bg-slate-700 text-slate-600 dark:text-slate-300' },
  { id: 'images',    label: 'Images',    color: 'bg-blue-500/10 text-blue-400' },
  { id: 'audio',     label: 'Audio',     color: 'bg-purple-500/10 text-purple-400' },
  { id: 'video',     label: 'Video',     color: 'bg-pink-500/10 text-pink-400' },
  { id: 'documents', label: 'Documents', color: 'bg-amber-500/10 text-amber-400' },
  { id: 'brand',     label: 'Brand',     color: 'bg-indigo-500/10 text-indigo-400' },
];

const FOLDER_MAP = Object.fromEntries(FOLDERS.map(f => [f.id, f]));

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isImage(mime: string | null) {
  return mime?.startsWith('image/') ?? false;
}

function isAudio(mime: string | null) {
  return mime?.startsWith('audio/') ?? false;
}

function isVideo(mime: string | null) {
  return mime?.startsWith('video/') ?? false;
}

function mimeIcon(mime: string | null): string {
  if (!mime) return '📎';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.startsWith('video/')) return '🎬';
  if (mime === 'application/pdf') return '📄';
  if (mime === 'application/zip') return '🗜';
  if (mime === 'text/csv') return '📊';
  if (mime === 'text/plain') return '📝';
  return '📎';
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ onUploaded }: { onUploaded: (asset: AssetFile) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    folder: 'general' as Folder,
    description: '',
    tags: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function field(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !form.name) {
      setForm(prev => ({ ...prev, name: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') }));
    }
  }

  async function upload() {
    if (!file || !form.name) { setError('File and name are required'); return; }
    setError(null);
    setProgress('uploading');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', form.name);
      fd.append('folder', form.folder);
      fd.append('description', form.description);
      fd.append('tags', form.tags);
      const res = await fetch('/api/admin/assets', { method: 'POST', body: fd });
      const data: { data?: AssetFile; error?: string } = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? 'Upload failed'); setProgress('idle'); return; }
      setProgress('done');
      if (data.data) onUploaded(data.data);
      setTimeout(() => {
        setOpen(false);
        setProgress('idle');
        setFile(null);
        setForm({ name: '', folder: 'general', description: '', tags: '' });
      }, 700);
    } catch {
      setError('Network error');
      setProgress('idle');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white transition-colors"
      >
        + Upload Asset
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upload Asset</h3>
              <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-lg">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${file ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-slate-300 dark:border-slate-700 hover:border-slate-500'}`}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={onFileChange}
                  accept="image/*,audio/*,video/*,.pdf,.txt,.csv,.zip"
                />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{fmtBytes(file.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-500">Click to select file</p>
                    <p className="text-[10px] text-slate-600 mt-1">Images, audio, video, PDF, CSV, ZIP · max 50 MB</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Name *</label>
                <input value={form.name} onChange={e => field('name', e.target.value)} placeholder="Asset name" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Folder</label>
                <select value={form.folder} onChange={e => field('folder', e.target.value as Folder)} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/60">
                  {FOLDERS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Tags <span className="normal-case text-slate-600">(comma-separated)</span></label>
                <input value={form.tags} onChange={e => field('tags', e.target.value)} placeholder="hero, onboarding, brand" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => field('description', e.target.value)} rows={2} placeholder="Optional description…" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none" />
              </div>

              {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex gap-3">
              <button
                type="button"
                onClick={upload}
                disabled={progress !== 'idle' || !file}
                className={`px-5 py-2 text-sm font-mono font-bold rounded-xl transition-colors disabled:opacity-40 ${progress === 'done' ? 'bg-emerald-600 text-slate-900 dark:text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white'}`}
              >
                {progress === 'uploading' ? 'Uploading…' : progress === 'done' ? 'Done ✓' : 'Upload'}
              </button>
              <button type="button" onClick={() => { setOpen(false); setError(null); }} className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Generate Video Modal ──────────────────────────────────────────────────────

type GenModel = 'seedance-2.0' | 'seedance-2.0-pro' | 'seedance-2.0-fast';
type GenRatio = '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
type GenRes   = '480p' | '720p' | '1080p' | '2k';
type GenStyle = '' | 'cinematic' | 'anime' | 'realistic' | '3d_render';

type GenPhase =
  | 'idle'
  | 'submitting'
  | 'polling'
  | 'done'
  | 'error';

interface GenForm {
  prompt:          string;
  name:            string;
  model:           GenModel;
  aspect_ratio:    GenRatio;
  resolution:      GenRes;
  duration:        number;
  style:           GenStyle;
  negative_prompt: string;
  audio:           boolean;
}

function GenerateModal({ onGenerated }: { onGenerated: (asset: AssetFile) => void }) {
  const [open, setOpen]   = useState(false);
  const [phase, setPhase] = useState<GenPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<AssetFile | null>(null);

  const [form, setForm] = useState<GenForm>({
    prompt:          '',
    name:            '',
    model:           'seedance-2.0',
    aspect_ratio:    '16:9',
    resolution:      '720p',
    duration:        8,
    style:           '',
    negative_prompt: '',
    audio:           true,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function field<K extends keyof GenForm>(k: K, v: GenForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const stopPolling = useCallback(() => {
    if (pollRef.current)    { clearInterval(pollRef.current);   pollRef.current = null; }
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  function closeModal() {
    stopPolling();
    setOpen(false);
    setPhase('idle');
    setError(null);
    setElapsed(0);
    setJobId(null);
    setGeneratedAsset(null);
    setForm(f => ({ ...f, prompt: '', name: '' }));
  }

  async function pollStatus(id: string) {
    const nameParam = encodeURIComponent(form.name.trim() || form.prompt.slice(0, 60));
    let res: Response;
    try {
      res = await fetch(`/api/admin/seedance/${id}?name=${nameParam}`);
    } catch {
      stopPolling();
      setPhase('error');
      setError('Network error while polling. The video may still be generating — check Assets later.');
      return;
    }

    const data = await res.json() as {
      status: string;
      asset?: AssetFile;
      error?: string;
    };

    if (data.status === 'succeeded' && data.asset) {
      stopPolling();
      setGeneratedAsset(data.asset);
      onGenerated(data.asset);
      setPhase('done');
      return;
    }

    if (data.status === 'failed') {
      stopPolling();
      setPhase('error');
      setError(data.error ?? 'Generation failed on BytePlus');
    }
    // still pending/processing — keep polling
  }

  async function generate() {
    if (!form.prompt.trim()) { setError('Prompt is required'); return; }
    setError(null);
    setPhase('submitting');

    let res: Response;
    try {
      res = await fetch('/api/admin/seedance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          prompt:          form.prompt.trim(),
          model:           form.model,
          aspect_ratio:    form.aspect_ratio,
          resolution:      form.resolution,
          duration:        form.duration,
          audio:           form.audio,
          style:           form.style || undefined,
          negative_prompt: form.negative_prompt.trim() || undefined,
        }),
      });
    } catch {
      setPhase('error');
      setError('Network error submitting job');
      return;
    }

    const data = await res.json() as { jobId?: string; error?: string };
    if (!res.ok || !data.jobId) {
      setPhase('error');
      setError(data.error ?? 'Failed to start generation');
      return;
    }

    setJobId(data.jobId);
    setElapsed(0);
    setPhase('polling');

    // Poll every 5 s, up to 150 attempts (~12.5 min).
    let attempts = 0;
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 150) {
        stopPolling();
        setPhase('error');
        setError('Generation timed out after 12 minutes. The video may still complete — check BytePlus console.');
        return;
      }
      await pollStatus(data.jobId!);
    }, 5000);

    // Poll once immediately so fast generations don't wait 5 s.
    await pollStatus(data.jobId);
  }

  const MODELS: { id: GenModel; label: string; note: string }[] = [
    { id: 'seedance-2.0',      label: 'Standard',    note: 'Balanced quality & speed' },
    { id: 'seedance-2.0-pro',  label: 'Pro',         note: 'Highest quality, slower' },
    { id: 'seedance-2.0-fast', label: 'Fast',        note: 'Quick draft, lower quality' },
  ];

  const RATIOS: { id: GenRatio; label: string }[] = [
    { id: '16:9',  label: '16:9  Landscape (ads, YouTube)' },
    { id: '9:16',  label: '9:16  Portrait (Reels, TikTok)' },
    { id: '1:1',   label: '1:1   Square (Instagram)' },
    { id: '4:3',   label: '4:3   Classic' },
    { id: '21:9',  label: '21:9  Cinematic ultra-wide' },
  ];

  const STYLES: { id: GenStyle; label: string }[] = [
    { id: '',           label: 'Default (none)' },
    { id: 'cinematic',  label: 'Cinematic' },
    { id: 'realistic',  label: 'Realistic' },
    { id: 'anime',      label: 'Anime' },
    { id: '3d_render',  label: '3D Render' },
  ];

  const busy = phase === 'submitting' || phase === 'polling';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors flex items-center gap-1.5"
      >
        <span>✨</span> Generate Video
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  ✨ Generate Video with Seedance 2.0
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">BytePlus AI · saved to your Assets library</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Done state */}
              {phase === 'done' && generatedAsset && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Video ready — saved to Assets</span>
                  </div>
                  <video
                    src={generatedAsset.public_url}
                    controls
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-black"
                    style={{ maxHeight: 320 }}
                  />
                  <p className="text-xs text-slate-500 font-mono truncate">{generatedAsset.public_url}</p>
                  <div className="flex gap-3">
                    <a
                      href={generatedAsset.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                      Open ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setPhase('idle');
                        setJobId(null);
                        setGeneratedAsset(null);
                        setForm(f => ({ ...f, prompt: '', name: '' }));
                      }}
                      className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                    >
                      Generate another
                    </button>
                  </div>
                </div>
              )}

              {/* Polling / submitting state */}
              {(phase === 'polling' || phase === 'submitting') && (
                <div className="py-8 flex flex-col items-center gap-4 text-center">
                  <div className="relative w-14 h-14">
                    <svg className="animate-spin w-14 h-14 text-violet-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {phase === 'submitting' ? 'Submitting to Seedance…' : 'Generating video…'}
                    </p>
                    {phase === 'polling' && (
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        {elapsed}s elapsed · polling every 5 s · typically 30–120 s
                      </p>
                    )}
                    {jobId && (
                      <p className="text-[10px] text-slate-600 font-mono mt-1">Job ID: {jobId}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Form — idle or error */}
              {(phase === 'idle' || phase === 'error') && (
                <>
                  {/* Prompt */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">
                      Prompt <span className="normal-case text-slate-600">*</span>
                    </label>
                    <textarea
                      value={form.prompt}
                      onChange={e => field('prompt', e.target.value)}
                      maxLength={2000}
                      rows={4}
                      placeholder="A cinematic close-up of a person speaking confidently into a microphone on stage, warm golden spotlight, shallow depth of field, crowd blurred in background…"
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/60 resize-none"
                    />
                    <p className="text-[10px] text-slate-600 font-mono mt-1 text-right">{form.prompt.length}/2000</p>
                  </div>

                  {/* Asset name */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">
                      Asset name <span className="normal-case text-slate-600">(optional — defaults to dated label)</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={e => field('name', e.target.value)}
                      placeholder="e.g. Hero Ad — Aug 2026"
                      maxLength={80}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/60"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Model</label>
                    <div className="grid grid-cols-3 gap-2">
                      {MODELS.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => field('model', m.id)}
                          className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${form.model === m.id ? 'border-violet-500/60 bg-violet-500/10' : 'border-slate-300 dark:border-slate-700 hover:border-slate-500'}`}
                        >
                          <p className={`text-xs font-bold ${form.model === m.id ? 'text-violet-400' : 'text-slate-900 dark:text-white'}`}>{m.label}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{m.note}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aspect ratio + duration row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Aspect ratio</label>
                      <select
                        value={form.aspect_ratio}
                        onChange={e => field('aspect_ratio', e.target.value as GenRatio)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500/60"
                      >
                        {RATIOS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Duration — {form.duration}s</label>
                      <input
                        type="range"
                        min={4} max={15} step={1}
                        value={form.duration}
                        onChange={e => field('duration', Number(e.target.value))}
                        className="w-full accent-violet-500 mt-2"
                      />
                      <div className="flex justify-between text-[9px] text-slate-600 font-mono mt-0.5">
                        <span>4 s</span><span>15 s</span>
                      </div>
                    </div>
                  </div>

                  {/* Resolution + style row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Resolution</label>
                      <select
                        value={form.resolution}
                        onChange={e => field('resolution', e.target.value as GenRes)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500/60"
                      >
                        <option value="480p">480p — fastest</option>
                        <option value="720p">720p — standard</option>
                        <option value="1080p">1080p — HD</option>
                        <option value="2k">2K — highest quality</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Style</label>
                      <select
                        value={form.style}
                        onChange={e => field('style', e.target.value as GenStyle)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500/60"
                      >
                        {STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Audio toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-900 dark:text-white">Generate audio</p>
                      <p className="text-[10px] text-slate-500">Include AI-generated audio track</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => field('audio', !form.audio)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.audio ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${form.audio ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Negative prompt */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">
                      Negative prompt <span className="normal-case text-slate-600">(optional)</span>
                    </label>
                    <input
                      value={form.negative_prompt}
                      onChange={e => field('negative_prompt', e.target.value)}
                      placeholder="blurry, low quality, watermark, text, logo…"
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/60"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 font-mono bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {(phase === 'idle' || phase === 'error') && (
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex gap-3 sticky bottom-0 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={generate}
                  disabled={!form.prompt.trim()}
                  className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white transition-colors"
                >
                  ✨ Generate
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            {phase === 'done' && (
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Asset Thumbnail ───────────────────────────────────────────────────────────

function AssetThumb({ asset }: { asset: AssetFile }) {
  if (isImage(asset.mime_type)) {
    return (
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.public_url} alt={asset.name} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-base">
      {mimeIcon(asset.mime_type)}
    </div>
  );
}

// ── Asset Grid ────────────────────────────────────────────────────────────────

function AssetGrid({ assets: initial }: { assets: AssetFile[] }) {
  const [assets, setAssets] = useState(initial);
  const [folderFilter, setFolderFilter] = useState<Folder | 'all'>('all');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUploaded(asset: AssetFile) {
    setAssets(prev => [asset, ...prev]);
  }

  function handleDelete(id: string) {
    setDeleting(id);
    startTransition(async () => {
      await fetch('/api/admin/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_asset', id }),
      });
      setAssets(prev => prev.filter(a => a.id !== id));
      setDeleting(null);
    });
  }

  function copyUrl(asset: AssetFile) {
    navigator.clipboard.writeText(asset.public_url);
    setCopied(asset.id);
    setTimeout(() => setCopied(null), 1500);
  }

  const filtered = assets.filter(a => {
    const matchFolder = folderFilter === 'all' || a.folder === folderFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      a.name.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q));
    return matchFolder && matchSearch;
  });

  const folderCounts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.folder] = (acc[a.folder] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or tag…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
        />
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFolderFilter('all')}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${folderFilter === 'all' ? 'bg-indigo-600 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            All ({assets.length})
          </button>
          {FOLDERS.map(f => folderCounts[f.id] ? (
            <button
              key={f.id}
              type="button"
              onClick={() => setFolderFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${folderFilter === f.id ? 'bg-indigo-600 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {f.label} ({folderCounts[f.id]})
            </button>
          ) : null)}
        </div>
        <UploadModal onUploaded={handleUploaded} />
        <GenerateModal onGenerated={handleUploaded} />
      </div>

      {/* Asset list */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-slate-600 font-mono">No assets found — upload your first file above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(asset => {
            const folderCfg = FOLDER_MAP[asset.folder];
            return (
              <div key={asset.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-700 rounded-xl px-4 py-3.5 flex items-center gap-4 group transition-colors">
                <AssetThumb asset={asset} />

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{asset.name}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${folderCfg?.color ?? 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      {folderCfg?.label ?? asset.folder}
                    </span>
                    {isAudio(asset.mime_type) && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-500/10 text-purple-400">AUDIO</span>
                    )}
                    {isVideo(asset.mime_type) && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-pink-500/10 text-pink-400">VIDEO</span>
                    )}
                  </div>
                  {asset.description && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{asset.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-0.5">
                    <p className="text-[10px] text-slate-600 font-mono">{fmtBytes(asset.file_size)} · {fmtDate(asset.created_at)}</p>
                    {asset.tags.length > 0 && (
                      <div className="flex gap-1">
                        {asset.tags.slice(0, 4).map(tag => (
                          <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => copyUrl(asset)}
                    className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-500 transition-colors"
                  >
                    {copied === asset.id ? 'Copied ✓' : 'Copy URL'}
                  </button>
                  <a
                    href={asset.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-500 transition-colors"
                  >
                    Open ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(asset.id)}
                    disabled={deleting === asset.id || isPending}
                    className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AssetsClient({ initialAssets }: Props) {
  return <AssetGrid assets={initialAssets} />;
}
