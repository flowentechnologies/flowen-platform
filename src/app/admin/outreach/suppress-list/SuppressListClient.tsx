'use client';

import { useState, useEffect, useCallback } from 'react';

interface ListSummary { list: string; count: number; created_at: string }

function parseLines(input: string): string[] {
  return input.split('\n').map(s => s.trim()).filter(Boolean);
}

export function SuppressListClient() {
  const [people, setPeople] = useState<ListSummary[]>([]);
  const [companies, setCompanies] = useState<ListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [peopleName, setPeopleName] = useState('');
  const [peopleEntries, setPeopleEntries] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyEntries, setCompanyEntries] = useState('');
  const [saving, setSaving] = useState<'people' | 'companies' | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchLists = useCallback(async () => {
    const res = await fetch('/api/admin/outreach/suppress-list');
    if (!res.ok) { setError('Failed to load suppress lists'); return; }
    const data = await res.json() as { people: ListSummary[]; companies: ListSummary[] };
    setPeople(data.people);
    setCompanies(data.companies);
  }, []);

  useEffect(() => {
    fetchLists().finally(() => setLoading(false));
  }, [fetchLists]);

  async function addList(kind: 'people' | 'companies') {
    const raw = kind === 'people' ? peopleEntries : companyEntries;
    const entries = parseLines(raw);
    if (entries.length === 0) return;
    setSaving(kind);
    setError(null);
    const res = await fetch('/api/admin/outreach/suppress-list', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, list: (kind === 'people' ? peopleName : companyName).trim() || undefined, entries }),
    });
    const data = await res.json() as { error?: string; list?: string; added?: number; skipped?: number };
    setSaving(null);
    if (!res.ok) { setError(data.error ?? 'Failed to add'); return; }
    if (kind === 'people') { setPeopleEntries(''); setPeopleName(''); } else { setCompanyEntries(''); setCompanyName(''); }
    await fetchLists();
  }

  async function deleteList(kind: 'people' | 'companies', list: string) {
    setDeleting(`${kind}:${list}`);
    setError(null);
    const res = await fetch(`/api/admin/outreach/suppress-list?kind=${kind}&list=${encodeURIComponent(list)}`, { method: 'DELETE' });
    const data = await res.json() as { error?: string };
    setDeleting(null);
    if (!res.ok) { setError(data.error ?? 'Failed to delete'); return; }
    await fetchLists();
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Suppress lists</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Organization-wide — applies to every AutoGTM campaign, running or not. Checked right before each send,
          so adding someone here stops a sequence already mid-flight, not just future ones.
          Back to <a href="/admin/outreach" className="text-emerald-600 dark:text-emerald-400 hover:underline">Outreach</a>.
        </p>
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* People */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">People (by email)</h2>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
            <input
              value={peopleName} onChange={e => setPeopleName(e.target.value)}
              placeholder="List name (optional, default: API)"
              className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
            />
            <textarea
              value={peopleEntries} onChange={e => setPeopleEntries(e.target.value)} rows={4}
              placeholder={'One email per line\njane@acme.com\njohn@acme.com'}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300"
            />
            <button
              type="button" onClick={() => addList('people')} disabled={saving === 'people' || !peopleEntries.trim()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white disabled:opacity-40"
            >
              {saving === 'people' ? 'Adding…' : 'Add to suppress list'}
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
            {people.map(l => (
              <div key={l.list} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{l.list} <span className="text-slate-400">({l.count})</span></span>
                <button type="button" onClick={() => deleteList('people', l.list)} disabled={deleting === `people:${l.list}`} className="text-[11px] text-rose-500 hover:underline disabled:opacity-40">
                  {deleting === `people:${l.list}` ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            ))}
            {people.length === 0 && <p className="px-4 py-4 text-xs text-slate-400 text-center">No people suppress lists yet.</p>}
          </div>
        </div>

        {/* Companies */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Companies (by domain)</h2>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
            <input
              value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder="List name (optional, default: API)"
              className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
            />
            <textarea
              value={companyEntries} onChange={e => setCompanyEntries(e.target.value)} rows={4}
              placeholder={'One domain per line\nacme.com\nglobex.io'}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300"
            />
            <button
              type="button" onClick={() => addList('companies')} disabled={saving === 'companies' || !companyEntries.trim()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white disabled:opacity-40"
            >
              {saving === 'companies' ? 'Adding…' : 'Add to suppress list'}
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
            {companies.map(l => (
              <div key={l.list} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{l.list} <span className="text-slate-400">({l.count})</span></span>
                <button type="button" onClick={() => deleteList('companies', l.list)} disabled={deleting === `companies:${l.list}`} className="text-[11px] text-rose-500 hover:underline disabled:opacity-40">
                  {deleting === `companies:${l.list}` ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            ))}
            {companies.length === 0 && <p className="px-4 py-4 text-xs text-slate-400 text-center">No company suppress lists yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
