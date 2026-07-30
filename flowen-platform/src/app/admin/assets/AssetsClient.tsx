'use client';

import React, { useState, useTransition, useRef } from 'react';

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
  { id: 'general',   label: 'General',   color: 'bg-slate-700 text-slate-300' },
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
        className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
      >
        + Upload Asset
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Upload Asset</h3>
              <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${file ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-500'}`}
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
                    <p className="text-sm font-medium text-white">{file.name}</p>
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
                <input value={form.name} onChange={e => field('name', e.target.value)} placeholder="Asset name" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Folder</label>
                <select value={form.folder} onChange={e => field('folder', e.target.value as Folder)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                  {FOLDERS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Tags <span className="normal-case text-slate-600">(comma-separated)</span></label>
                <input value={form.tags} onChange={e => field('tags', e.target.value)} placeholder="hero, onboarding, brand" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => field('description', e.target.value)} rows={2} placeholder="Optional description…" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none" />
              </div>

              {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              <button
                type="button"
                onClick={upload}
                disabled={progress !== 'idle' || !file}
                className={`px-5 py-2 text-sm font-mono font-bold rounded-xl transition-colors disabled:opacity-40 ${progress === 'done' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
              >
                {progress === 'uploading' ? 'Uploading…' : progress === 'done' ? 'Done ✓' : 'Upload'}
              </button>
              <button type="button" onClick={() => { setOpen(false); setError(null); }} className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors">Cancel</button>
            </div>
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
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.public_url} alt={asset.name} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-base">
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
          className="flex-1 min-w-48 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
        />
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFolderFilter('all')}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${folderFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            All ({assets.length})
          </button>
          {FOLDERS.map(f => folderCounts[f.id] ? (
            <button
              key={f.id}
              type="button"
              onClick={() => setFolderFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${folderFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              {f.label} ({folderCounts[f.id]})
            </button>
          ) : null)}
        </div>
        <UploadModal onUploaded={handleUploaded} />
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
              <div key={asset.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-3.5 flex items-center gap-4 group transition-colors">
                <AssetThumb asset={asset} />

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{asset.name}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${folderCfg?.color ?? 'bg-slate-800 text-slate-400'}`}>
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
                          <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
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
                    className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                  >
                    {copied === asset.id ? 'Copied ✓' : 'Copy URL'}
                  </button>
                  <a
                    href={asset.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                  >
                    Open ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(asset.id)}
                    disabled={deleting === asset.id || isPending}
                    className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40"
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
