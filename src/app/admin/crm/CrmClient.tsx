'use client';

import { useState, useEffect, useCallback } from 'react';

interface Contact {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  category: string;
  stage: string;
  source: string | null;
  last_contact_at: string | null;
  notes: string | null;
}

const STAGES = ['new', 'contacted', 'in_discussion', 'won', 'lost'] as const;
const STAGE_LABEL: Record<string, string> = {
  new: 'New', contacted: 'Contacted', in_discussion: 'In Discussion', won: 'Won', lost: 'Lost',
};
const CATEGORY_LABEL: Record<string, string> = {
  investor: 'Investor', grant: 'Grant', nhs_partner: 'NHS Partner', press: 'Press',
  affiliate: 'Affiliate', vendor: 'Vendor', other: 'Other',
};

export function CrmClient() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async (category?: string) => {
    const url = category ? `/api/admin/crm?category=${category}` : '/api/admin/crm';
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json() as { contacts: Contact[] };
    setContacts(data.contacts);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchContacts(categoryFilter || undefined).finally(() => setLoading(false));
  }, [fetchContacts, categoryFilter]);

  async function moveStage(id: string, stage: string) {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, stage } : c)));
    await fetch('/api/admin/crm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stage }),
    });
  }

  const byStage = STAGES.map(stage => ({ stage, contacts: contacts.filter(c => c.stage === stage) }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CRM Pipeline</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Investors, grants, NHS partnerships, press, and affiliates — one pipeline, sourced automatically from inbox activity.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setCategoryFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${!categoryFilter ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          All
        </button>
        {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategoryFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${categoryFilter === key ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {byStage.map(({ stage, contacts: stageContacts }) => (
            <div key={stage} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {STAGE_LABEL[stage]} ({stageContacts.length})
              </p>
              <div className="space-y-2">
                {stageContacts.map(c => (
                  <div key={c.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{c.name ?? c.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{c.company ?? c.email}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {CATEGORY_LABEL[c.category] ?? c.category}
                    </span>
                    <select
                      value={c.stage}
                      onChange={e => moveStage(c.id, e.target.value)}
                      className="mt-2 w-full text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-1.5 py-1 text-slate-600 dark:text-slate-300"
                    >
                      {STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
