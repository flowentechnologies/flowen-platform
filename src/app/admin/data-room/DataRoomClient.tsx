'use client';

import React, { useState, useTransition, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'financial' | 'legal' | 'clinical' | 'technical' | 'corporate' | 'regulatory';

interface Document {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  filename: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  version: string;
  created_at: string;
}

interface Invite {
  id: string;
  investor_name: string;
  investor_email: string;
  token: string;
  access_level: 'standard' | 'full';
  expires_at: string;
  last_accessed_at: string | null;
  access_count: number;
  revoked: boolean;
  created_at: string;
}

interface Props {
  initialDocuments: Document[];
  initialInvites:   Invite[];
  siteUrl: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: 'financial',  label: 'Financial',  color: 'bg-emerald-500/10 text-emerald-400' },
  { id: 'legal',      label: 'Legal',      color: 'bg-blue-500/10 text-blue-400' },
  { id: 'clinical',   label: 'Clinical',   color: 'bg-purple-500/10 text-purple-400' },
  { id: 'technical',  label: 'Technical',  color: 'bg-orange-500/10 text-orange-400' },
  { id: 'corporate',  label: 'Corporate',  color: 'bg-slate-600/40 text-slate-600 dark:text-slate-300' },
  { id: 'regulatory', label: 'Regulatory', color: 'bg-amber-500/10 text-amber-400' },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const MIME_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/msword': '📝',
  'image/png': '🖼',
  'image/jpeg': '🖼',
  'text/csv': '📊',
};

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

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isExpired(iso: string) { return new Date(iso) < new Date(); }

async function apiJson(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin/data-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

// ── File icon ─────────────────────────────────────────────────────────────────

function FileIcon({ mime }: { mime: string | null }) {
  return (
    <span className="text-base leading-none" role="img" aria-hidden>
      {mime ? (MIME_ICONS[mime] ?? '📎') : '📎'}
    </span>
  );
}

// ── Upload modal ──────────────────────────────────────────────────────────────

function UploadModal({ onUploaded }: { onUploaded: (doc: Document) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'financial' as Category, description: '', version: 'v1' });
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function field(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !form.title) setForm(prev => ({ ...prev, title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') }));
  }

  async function upload() {
    if (!file || !form.title || !form.category) { setError('File, title, and category are required'); return; }
    setError(null);
    setProgress('uploading');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title);
      fd.append('category', form.category);
      fd.append('description', form.description);
      fd.append('version', form.version);
      const res = await fetch('/api/admin/data-room', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? 'Upload failed'); setProgress('idle'); return; }
      setProgress('done');
      onUploaded(data.data);
      setTimeout(() => { setOpen(false); setProgress('idle'); setFile(null); setForm({ title: '', category: 'financial', description: '', version: 'v1' }); }, 800);
    } catch {
      setError('Network error'); setProgress('idle');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white transition-colors"
      >
        + Upload Document
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upload Document</h3>
              <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-lg">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${file ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-slate-300 dark:border-slate-700 hover:border-slate-500'}`}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" className="hidden" onChange={onFileChange}
                  accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg,.csv,.txt" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{fmtBytes(file.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-500">Click to select file</p>
                    <p className="text-[10px] text-slate-600 mt-1">PDF, XLSX, DOCX, CSV, PNG · max 50 MB</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Title *</label>
                <input value={form.title} onChange={e => field('title', e.target.value)} placeholder="Document title" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Category *</label>
                  <select value={form.category} onChange={e => field('category', e.target.value as Category)} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/60">
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Version</label>
                  <input value={form.version} onChange={e => field('version', e.target.value)} placeholder="v1" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => field('description', e.target.value)} rows={2} placeholder="Brief description for the index…" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none" />
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

// ── Create invite modal ───────────────────────────────────────────────────────

function CreateInviteModal({ onCreated, siteUrl }: { onCreated: (inv: Invite) => void; siteUrl: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ investor_name: '', investor_email: '', access_level: 'standard' as 'standard' | 'full', expires_at: '' });
  const [created, setCreated] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  function field(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    if (!form.investor_name || !form.investor_email) { setError('Name and email required'); return; }
    setError(null);
    startTransition(async () => {
      const res = await apiJson('create_invite', { ...form, expires_at: form.expires_at || `${defaultExpiry}T23:59:59Z` });
      if (res.error) { setError(res.error); return; }
      setCreated(res.data);
      onCreated(res.data);
    });
  }

  function close() { setOpen(false); setCreated(null); setError(null); setForm({ investor_name: '', investor_email: '', access_level: 'standard', expires_at: '' }); }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white transition-colors">
        + Create Invite
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{created ? 'Invite Created' : 'Create Investor Invite'}</h3>
              <button type="button" onClick={close} className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-lg">×</button>
            </div>

            {created ? (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-emerald-400 font-mono">Invite generated for <strong className="text-slate-900 dark:text-white">{created.investor_name}</strong></p>
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">Access Link</p>
                  <p className="text-xs font-mono text-slate-900 dark:text-white break-all">{siteUrl}/data-room/{created.token}</p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(`${siteUrl}/data-room/${created.token}`)}
                    className="mt-2 px-3 py-1.5 text-[10px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Copy link
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">Expires: {fmtDate(created.expires_at)} · Access: {created.access_level}</p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Investor Name *</label>
                  <input value={form.investor_name} onChange={e => field('investor_name', e.target.value)} placeholder="Full name or firm" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Email *</label>
                  <input type="email" value={form.investor_email} onChange={e => field('investor_email', e.target.value)} placeholder="investor@fund.com" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Access Level</label>
                    <select value={form.access_level} onChange={e => field('access_level', e.target.value as 'standard' | 'full')} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/60">
                      <option value="standard">Standard</option>
                      <option value="full">Full</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Expires</label>
                    <input type="date" value={form.expires_at} onChange={e => field('expires_at', e.target.value)} defaultValue={defaultExpiry} min={new Date().toISOString().slice(0, 10)} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/60" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 font-mono">Defaults to 30-day expiry if not set.</p>
                {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
              </div>
            )}

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex gap-3">
              {created ? (
                <button type="button" onClick={close} className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white transition-colors">Done</button>
              ) : (
                <>
                  <button type="button" onClick={submit} disabled={isPending} className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white transition-colors disabled:opacity-40">
                    {isPending ? 'Creating…' : 'Create Invite'}
                  </button>
                  <button type="button" onClick={close} className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────────

function DocumentsTab({ docs: initial }: { docs: Document[] }) {
  const [docs, setDocs] = useState(initial);
  const [catFilter, setCatFilter] = useState<Category | 'all'>('all');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUploaded(doc: Document) { setDocs(prev => [doc, ...prev]); }

  async function download(doc: Document) {
    setDownloading(doc.id);
    try {
      const res = await apiJson('get_signed_url', { id: doc.id });
      if (res.url) window.open(res.url, '_blank');
    } finally {
      setDownloading(null);
    }
  }

  function handleDelete(id: string) {
    setDeleting(id);
    startTransition(async () => {
      await apiJson('delete_document', { id });
      setDocs(prev => prev.filter(d => d.id !== id));
      setDeleting(null);
    });
  }

  const filtered = catFilter === 'all' ? docs : docs.filter(d => d.category === catFilter);
  const catCounts = docs.reduce<Record<string, number>>((a, d) => { a[d.category] = (a[d.category] ?? 0) + 1; return a; }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setCatFilter('all')}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${catFilter === 'all' ? 'bg-indigo-600 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            All ({docs.length})
          </button>
          {CATEGORIES.map(c => catCounts[c.id] ? (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatFilter(c.id)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${catFilter === c.id ? 'bg-indigo-600 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {c.label} ({catCounts[c.id]})
            </button>
          ) : null)}
        </div>
        <div className="ml-auto">
          <UploadModal onUploaded={handleUploaded} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-slate-600 font-mono">No documents yet — upload your first file above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => {
            const catCfg = CATEGORY_MAP[doc.category];
            return (
              <div key={doc.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-700 rounded-xl px-4 py-3.5 flex items-center gap-4 group transition-colors">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <FileIcon mime={doc.mime_type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{doc.title}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${catCfg?.color ?? 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      {catCfg?.label ?? doc.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 shrink-0">{doc.version}</span>
                  </div>
                  {doc.description && <p className="text-[11px] text-slate-500 truncate mt-0.5">{doc.description}</p>}
                  <p className="text-[10px] text-slate-600 font-mono mt-0.5">{fmtBytes(doc.file_size)} · {fmtDate(doc.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => download(doc)}
                    disabled={downloading === doc.id}
                    className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40"
                  >
                    {downloading === doc.id ? '…' : '↓ Download'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleting === doc.id || isPending}
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

// ── Invites tab ───────────────────────────────────────────────────────────────

function InvitesTab({ invites: initial, siteUrl }: { invites: Invite[]; siteUrl: string }) {
  const [invites, setInvites] = useState(initial);
  const [copying, setCopying] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreated(inv: Invite) { setInvites(prev => [inv, ...prev]); }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${siteUrl}/data-room/${token}`);
    setCopying(token);
    setTimeout(() => setCopying(null), 1500);
  }

  function revoke(id: string) {
    startTransition(async () => {
      await apiJson('revoke_invite', { id });
      setInvites(prev => prev.map(inv => inv.id === id ? { ...inv, revoked: true } : inv));
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await apiJson('delete_invite', { id });
      setInvites(prev => prev.filter(inv => inv.id !== id));
    });
  }

  const active  = invites.filter(i => !i.revoked && !isExpired(i.expires_at));
  const expired = invites.filter(i => i.revoked || isExpired(i.expires_at));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-xs font-mono text-slate-400">
          {invites.length > 0 && <>
            <span>Active: <span className="text-slate-900 dark:text-white font-bold">{active.length}</span></span>
            {expired.length > 0 && <span className="text-slate-600">Expired/Revoked: <span className="font-bold">{expired.length}</span></span>}
          </>}
        </div>
        <CreateInviteModal onCreated={handleCreated} siteUrl={siteUrl} />
      </div>

      {invites.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600 font-mono">No invites — create one to share access</p>
      ) : (
        <div className="space-y-2">
          {[...active, ...expired].map(inv => {
            const expired_ = isExpired(inv.expires_at);
            const inactive = inv.revoked || expired_;
            return (
              <div key={inv.id} className={`bg-white dark:bg-slate-900 border rounded-xl px-5 py-4 flex items-start gap-4 group ${inactive ? 'border-slate-800/50 opacity-50' : 'border-slate-200 dark:border-slate-800 hover:border-slate-700'} transition-colors`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{inv.investor_name}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${inv.access_level === 'full' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      {inv.access_level}
                    </span>
                    {inv.revoked && <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-500/10 text-red-400">REVOKED</span>}
                    {!inv.revoked && expired_ && <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400">EXPIRED</span>}
                  </div>
                  <p className="text-xs text-slate-500">{inv.investor_email}</p>
                  <div className="flex flex-wrap gap-4 mt-1.5 text-[10px] font-mono text-slate-600">
                    <span>Expires {fmtDate(inv.expires_at)}</span>
                    <span>Accessed {inv.access_count}×</span>
                    {inv.last_accessed_at && <span>Last: {fmtDateTime(inv.last_accessed_at)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!inactive && (
                    <button
                      type="button"
                      onClick={() => copyLink(inv.token)}
                      className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      {copying === inv.token ? 'Copied ✓' : 'Copy link'}
                    </button>
                  )}
                  {!inv.revoked && !expired_ && (
                    <button
                      type="button"
                      onClick={() => revoke(inv.id)}
                      disabled={isPending}
                      className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-amber-800/50 text-amber-600 hover:text-amber-400 transition-colors disabled:opacity-40"
                    >
                      Revoke
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(inv.id)}
                    disabled={isPending}
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

type Tab = 'documents' | 'invites';

export function DataRoomClient({ initialDocuments, initialInvites, siteUrl }: Props) {
  const [tab, setTab] = useState<Tab>('documents');

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'documents', label: 'Documents', count: initialDocuments.length },
    { id: 'invites',   label: 'Investor Invites', count: initialInvites.length },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-mono rounded-t-lg transition-colors flex items-center gap-2 -mb-px border-b-2 ${
              tab === t.id
                ? 'border-indigo-500 text-slate-900 dark:text-white bg-slate-800/50'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${tab === t.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'documents' && <DocumentsTab docs={initialDocuments} />}
      {tab === 'invites'   && <InvitesTab invites={initialInvites} siteUrl={siteUrl} />}
    </div>
  );
}
