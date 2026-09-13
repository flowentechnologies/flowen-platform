'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Prospect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  linkedin_url: string | null;
  company_name: string | null;
  company_domain: string | null;
  email: string | null;
  email_status: string | null;
  imported_campaign_id: number | null;
  imported_at: string | null;
}

interface SearchRow {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  people_filters: Record<string, unknown> | null;
  company_filters: Record<string, unknown> | null;
  max_contacts: number;
  preset: 'basic' | 'premium';
  credits_charged: number | null;
  excluded_total: number | null;
  error: string | null;
  created_at: string;
}

interface DedupList { id: string; total: number; created_at: string }

interface Progress {
  attempted: number;
  found: number;
  target: number;
  progress_pct: number;
  eta_seconds: number | null;
}

function parseList(input: string): string[] {
  return input.split(',').map(s => s.trim()).filter(Boolean);
}

/** Segment breakdown — how many people were found at each company. Mirrors src/lib/explee/prospecting.ts's groupByCompany, done client-side since results already live in state. */
function groupByCompany(prospects: Prospect[]) {
  const byDomain = new Map<string, { companyDomain: string; companyName: string | null; count: number }>();
  for (const p of prospects) {
    const domain = p.company_domain ?? '__unknown__';
    const existing = byDomain.get(domain);
    if (existing) existing.count++;
    else byDomain.set(domain, { companyDomain: domain, companyName: p.company_name, count: 1 });
  }
  return [...byDomain.values()].sort((a, b) => b.count - a.count);
}

const PRICE_PER_CREDIT_USD = 0.01;

export function ProspectingClient() {
  // ── Search form ──────────────────────────────────────────────────────
  const [companyDefinition, setCompanyDefinition] = useState('');
  const [companyGeo, setCompanyGeo] = useState('');
  const [peopleJobTitles, setPeopleJobTitles] = useState('');
  const [peopleGeo, setPeopleGeo] = useState('');
  const [maxContacts, setMaxContacts] = useState(50);
  const [preset, setPreset] = useState<'basic' | 'premium'>('basic');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // ── Active search + results ──────────────────────────────────────────
  const [search, setSearch] = useState<SearchRow | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [view, setView] = useState<'people' | 'companies'>('people');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Past searches ────────────────────────────────────────────────────
  const [pastSearches, setPastSearches] = useState<SearchRow[]>([]);

  // ── Dedup list — excludes CRM contacts already owned from new searches ─
  const [dedupList, setDedupList] = useState<DedupList | null>(null);
  const [dedupRefreshing, setDedupRefreshing] = useState(false);
  const [dedupError, setDedupError] = useState<string | null>(null);

  const loadDedupList = useCallback(async () => {
    const res = await fetch('/api/admin/prospecting/dedup-list');
    if (!res.ok) return;
    const data = await res.json() as { list: DedupList | null };
    setDedupList(data.list);
  }, []);

  useEffect(() => { loadDedupList(); }, [loadDedupList]);

  async function refreshDedupList() {
    setDedupRefreshing(true);
    setDedupError(null);
    const res = await fetch('/api/admin/prospecting/dedup-list', { method: 'POST' });
    const data = await res.json() as { error?: string; id?: string; total?: number };
    setDedupRefreshing(false);
    if (!res.ok) { setDedupError(data.error ?? 'Failed to build dedup list'); return; }
    await loadDedupList();
  }

  const loadPastSearches = useCallback(async () => {
    const res = await fetch('/api/admin/prospecting/search');
    if (!res.ok) return;
    const data = await res.json() as { searches: SearchRow[] };
    setPastSearches(data.searches);
  }, []);

  useEffect(() => { loadPastSearches(); }, [loadPastSearches]);

  const pollSearch = useCallback((id: string) => {
    if (pollRef.current) clearTimeout(pollRef.current);
    const tick = async () => {
      const res = await fetch(`/api/admin/prospecting/search/${id}`);
      if (!res.ok) return;
      const data = await res.json() as { search: SearchRow; prospects: Prospect[]; progress: Progress | null };
      setSearch(data.search);
      setProspects(data.prospects);
      setProgress(data.progress);
      if (data.search.status === 'pending') {
        pollRef.current = setTimeout(tick, 3000);
      } else {
        loadPastSearches();
      }
    };
    tick();
  }, [loadPastSearches]);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  async function runSearch() {
    if (!companyDefinition.trim() && !peopleJobTitles.trim()) {
      setSearchError('Provide at least a company definition or a job title');
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSelected(new Set());
    const res = await fetch('/api/admin/prospecting/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyDefinition: companyDefinition.trim() || undefined,
        companyGeo: parseList(companyGeo),
        peopleJobTitles: parseList(peopleJobTitles),
        peopleGeo: parseList(peopleGeo),
        maxContacts, preset,
      }),
    });
    const data = await res.json() as { searchId?: string; error?: string };
    setSearching(false);
    if (!res.ok || !data.searchId) {
      setSearchError(data.error ?? 'Search failed to start');
      return;
    }
    setProspects([]);
    pollSearch(data.searchId);
  }

  function openPastSearch(row: SearchRow) {
    setSelected(new Set());
    setSearch(row);
    pollSearch(row.id);
  }

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllUnimported() {
    setSelected(new Set(prospects.filter(p => !p.imported_campaign_id).map(p => p.id)));
  }

  const companies = groupByCompany(prospects);

  // ── Import ───────────────────────────────────────────────────────────
  const [campaignName, setCampaignName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [followupInstructions, setFollowupInstructions] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ status: string; campaign_id: number | null; error?: string | null } | null>(null);
  const importPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (importPollRef.current) clearTimeout(importPollRef.current); }, []);

  function pollImport(id: string) {
    const tick = async () => {
      const res = await fetch(`/api/admin/prospecting/import/${id}`);
      if (!res.ok) return;
      const data = await res.json() as { import: { status: string; campaign_id: number | null; error?: string | null } };
      setImportStatus(data.import);
      if (data.import.status === 'pending') importPollRef.current = setTimeout(tick, 3000);
    };
    tick();
  }

  async function runImport() {
    if (selected.size === 0 || !campaignName.trim()) return;
    setImporting(true);
    setImportError(null);
    setImportStatus(null);
    const res = await fetch('/api/admin/prospecting/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospectIds: [...selected], campaignName: campaignName.trim(),
        instructions: instructions.trim() || undefined,
        followupInstructions: followupInstructions.trim() || undefined,
      }),
    });
    const data = await res.json() as { importId?: string; error?: string; submitted?: number; skipped?: number };
    setImporting(false);
    if (!res.ok || !data.importId) {
      setImportError(data.error ?? 'Import failed to start');
      return;
    }
    setImportStatus({ status: 'pending', campaign_id: null });
    pollImport(data.importId);
  }

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Prospecting</h1>
        <p className="text-slate-400 text-sm mt-1">
          Find new people via Explee (find-and-enrich) and send selected results into a brand-new outreach campaign.
          Billable per email found — {preset === 'basic' ? '1.5' : '5'} credits/email at the {preset} preset.
        </p>
      </div>

      {/* ── Dedup list — excludes CRM contacts already owned ─────────── */}
      <div className="flex items-center gap-3 flex-wrap text-xs bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5">
        {dedupList ? (
          <span className="text-slate-500 dark:text-slate-400">
            🛡️ Excluding <strong className="text-slate-700 dark:text-slate-300">{dedupList.total}</strong> known CRM contacts from new searches
            <span className="text-slate-400"> · built {new Date(dedupList.created_at).toLocaleDateString('en-GB')}</span>
          </span>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">No dedup list built yet — new searches may re-find people already in your CRM.</span>
        )}
        <button
          type="button" onClick={refreshDedupList} disabled={dedupRefreshing}
          className="ml-auto text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-40"
        >
          {dedupRefreshing ? 'Building…' : dedupList ? 'Refresh from CRM' : 'Build from CRM'}
        </button>
        {dedupError && <p className="text-[10px] text-rose-500 w-full">{dedupError}</p>}
      </div>

      {/* ── Search form ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Company definition</label>
            <input
              value={companyDefinition} onChange={e => setCompanyDefinition(e.target.value)}
              placeholder="e.g. speech therapy clinic, NHS trust, private SLT practice"
              className="mt-1 w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Company geo (comma-separated ISO codes)</label>
            <input
              value={companyGeo} onChange={e => setCompanyGeo(e.target.value)}
              placeholder="GB, US"
              className="mt-1 w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Job titles (comma-separated)</label>
            <input
              value={peopleJobTitles} onChange={e => setPeopleJobTitles(e.target.value)}
              placeholder="Head of Speech and Language Therapy, Clinical Lead"
              className="mt-1 w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">People geo (comma-separated ISO codes)</label>
            <input
              value={peopleGeo} onChange={e => setPeopleGeo(e.target.value)}
              placeholder="GB"
              className="mt-1 w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max contacts</label>
            <input
              type="number" min={1} max={500} value={maxContacts}
              onChange={e => setMaxContacts(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
              className="mt-1 w-28 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preset</label>
            <div className="mt-1 flex gap-1.5">
              {(['basic', 'premium'] as const).map(p => (
                <button
                  key={p} type="button" onClick={() => setPreset(p)}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg border ${preset === p ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                >
                  {p === 'basic' ? 'Basic (1.5 cr/email)' : 'Premium (5 cr/email)'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Est. worst case: {maxContacts} × {preset === 'basic' ? 1.5 : 5} = {maxContacts * (preset === 'basic' ? 1.5 : 5)} credits
            (${(maxContacts * (preset === 'basic' ? 1.5 : 5) * PRICE_PER_CREDIT_USD).toFixed(2)}) — only charged per email actually found.
          </p>
          <button
            type="button" onClick={runSearch} disabled={searching || search?.status === 'pending'}
            className="ml-auto text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-500 text-white disabled:opacity-40"
          >
            {searching ? 'Starting…' : 'Run search'}
          </button>
        </div>
        {searchError && <p className="text-xs text-rose-500">{searchError}</p>}
      </div>

      {/* ── Past searches ───────────────────────────────────────────── */}
      {pastSearches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pastSearches.map(s => (
            <button
              key={s.id} type="button" onClick={() => openPastSearch(s)}
              className={`text-[11px] px-2.5 py-1 rounded-full border ${search?.id === s.id ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
            >
              {(s.company_filters as { definition?: string })?.definition ?? 'Search'} · {new Date(s.created_at).toLocaleDateString('en-GB')} · {s.status}
            </button>
          ))}
        </div>
      )}

      {/* ── Progress ────────────────────────────────────────────────── */}
      {search?.status === 'pending' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Searching… {progress ? `${progress.found}/${progress.target} found (${progress.progress_pct}%)` : 'starting…'}
            {progress?.eta_seconds != null && ` · ~${progress.eta_seconds}s remaining`}
          </p>
          <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress?.progress_pct ?? 0}%` }} />
          </div>
        </div>
      )}
      {search?.status === 'failed' && (
        <p className="text-sm text-rose-500">Search failed: {search.error}</p>
      )}

      {/* ── Results ─────────────────────────────────────────────────── */}
      {search?.status === 'completed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {prospects.length} found · {search.credits_charged ?? 0} credits charged
              (${((search.credits_charged ?? 0) * PRICE_PER_CREDIT_USD).toFixed(2)})
              {!!search.excluded_total && <span className="text-slate-400"> · {search.excluded_total} already-known contacts excluded</span>}
            </p>
            <div className="flex gap-1.5">
              {(['people', 'companies'] as const).map(v => (
                <button
                  key={v} type="button" onClick={() => setView(v)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${view === v ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent' : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                >
                  {v === 'people' ? 'People' : `Companies (${companies.length})`}
                </button>
              ))}
            </div>
          </div>

          {view === 'people' ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{selected.size} selected</p>
                <button type="button" onClick={selectAllUnimported} className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline">
                  Select all not yet imported
                </button>
              </div>
              <div className="max-h-96 overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
                {prospects.map(p => (
                  <label key={p.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${p.imported_campaign_id ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/50'}`}>
                    <input
                      type="checkbox" checked={selected.has(p.id)} disabled={!!p.imported_campaign_id}
                      onChange={() => toggleSelected(p.id)}
                      className="shrink-0"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{p.first_name} {p.last_name}</span>
                      <span className="text-slate-400"> · {p.title ?? '—'} · {p.company_name ?? p.company_domain ?? '—'}</span>
                      {p.imported_campaign_id && <span className="ml-2 text-[10px] text-emerald-500">✓ imported</span>}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">{p.email}</span>
                    {p.linkedin_url && (
                      <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-sky-500 shrink-0 text-xs">in</a>
                    )}
                  </label>
                ))}
                {prospects.length === 0 && <p className="px-4 py-6 text-sm text-slate-400 text-center">No emails found for these filters.</p>}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-2">Company</th>
                    <th className="px-4 py-2">Domain</th>
                    <th className="px-4 py-2 text-right">People found</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {companies.map(c => (
                    <tr key={c.companyDomain}>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{c.companyName ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-400">{c.companyDomain === '__unknown__' ? '—' : c.companyDomain}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Import into a new campaign ────────────────────────────── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Create Explee campaign from {selected.size} selected</p>
            <input
              value={campaignName} onChange={e => setCampaignName(e.target.value)}
              placeholder="Campaign name"
              className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
            />
            <button type="button" onClick={() => setShowAdvanced(v => !v)} className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline">
              {showAdvanced ? 'Hide' : 'Show'} copy brief (optional)
            </button>
            {showAdvanced && (
              <div className="space-y-2">
                <textarea
                  value={instructions} onChange={e => setInstructions(e.target.value)} rows={2}
                  placeholder="First email brief — omit to let Explee brief from your project description alone"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300"
                />
                <textarea
                  value={followupInstructions} onChange={e => setFollowupInstructions(e.target.value)} rows={2}
                  placeholder="Follow-up brief (shared by every follow-up email)"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300"
                />
              </div>
            )}
            <button
              type="button" onClick={runImport}
              disabled={importing || selected.size === 0 || !campaignName.trim() || importStatus?.status === 'pending'}
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-sky-500 text-white disabled:opacity-40"
            >
              {importing || importStatus?.status === 'pending' ? 'Creating…' : `Import ${selected.size} into new campaign`}
            </button>
            {importError && <p className="text-xs text-rose-500">{importError}</p>}
            {importStatus?.status === 'completed' && (
              <p className="text-xs text-emerald-500">
                Campaign created ✓ {importStatus.campaign_id && (
                  <a href="/admin/outreach" className="underline">View in Outreach ↗</a>
                )}
              </p>
            )}
            {importStatus?.status === 'failed' && <p className="text-xs text-rose-500">Import failed: {importStatus.error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
