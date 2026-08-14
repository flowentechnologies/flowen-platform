'use client';

import { useState, useTransition } from 'react';
import {
  approveSlpApplication,
  rejectSlpApplication,
  waitlistSlpApplication,
} from '@/app/actions/slp-beta-admin';

export interface Application {
  id: string;
  created_at: string;
  name: string;
  email: string;
  organisation: string;
  caseload_size: string;
  client_group: string;
  motivation: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'waitlisted';
}

type Filter = 'all' | 'pending' | 'accepted' | 'waitlisted' | 'rejected';

const STATUS_STYLES: Record<Application['status'], string> = {
  pending:    'bg-amber-500/10 border-amber-500/30 text-amber-400',
  accepted:   'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  rejected:   'bg-rose-500/10 border-rose-500/30 text-rose-400',
  waitlisted: 'bg-slate-700/60 border-slate-600 text-slate-400',
};

const CASELOAD_LABELS: Record<string, string> = {
  '1-10':  '1–10 patients',
  '11-30': '11–30 patients',
  '31-50': '31–50 patients',
  '50+':   '50+ patients',
};

const CLIENT_LABELS: Record<string, string> = {
  adults:   'Adults',
  children: 'Children',
  both:     'Adults & Children',
};

function ActionButtons({ app, onDone }: { app: Application; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<'reject' | null>(null);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function approve() {
    startTransition(async () => {
      const res = await approveSlpApplication(app.id, app.email, app.name);
      if (res.ok) {
        showToast(res.hadAccount
          ? `✓ Approved — portal access activated for ${app.name}`
          : `✓ Approved — acceptance email sent (no account yet)`
        );
        onDone();
      } else {
        showToast(`Error: ${res.error}`);
      }
    });
  }

  function reject() {
    startTransition(async () => {
      const res = await rejectSlpApplication(app.id, app.email, app.name);
      if (res.ok) { showToast(`Rejected — email sent to ${app.name}`); setConfirm(null); onDone(); }
      else showToast(`Error: ${res.error}`);
    });
  }

  function waitlist() {
    startTransition(async () => {
      const res = await waitlistSlpApplication(app.id);
      if (res.ok) { showToast(`${app.name} moved to waitlist`); onDone(); }
      else showToast(`Error: ${res.error}`);
    });
  }

  if (app.status !== 'pending') return null;

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      {toast && (
        <span className="text-xs text-emerald-400 mr-2">{toast}</span>
      )}
      {confirm === 'reject' ? (
        <>
          <span className="text-xs text-slate-400 mr-1">Are you sure?</span>
          <button
            onClick={reject}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold hover:bg-rose-500/30 transition-colors disabled:opacity-50"
          >
            {pending ? 'Sending…' : 'Yes, reject'}
          </button>
          <button
            onClick={() => setConfirm(null)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-xs hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            onClick={approve}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
          >
            {pending ? 'Processing…' : 'Approve'}
          </button>
          <button
            onClick={waitlist}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-xs hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Waitlist
          </button>
          <button
            onClick={() => setConfirm('reject')}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-500 text-xs hover:text-rose-400 hover:border-rose-500/30 transition-colors disabled:opacity-50"
          >
            Reject
          </button>
        </>
      )}
    </div>
  );
}

function ApplicationCard({ app }: { app: Application }) {
  const [expanded, setExpanded] = useState(false);
  const [key, setKey] = useState(0); // force re-render after action

  return (
    <div key={key} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* Left: identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-bold text-white">{app.name}</p>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[app.status]}`}>
              {app.status}
            </span>
          </div>
          <p className="text-xs text-slate-400">{app.email}</p>
          <p className="text-xs text-slate-500">{app.organisation}</p>
        </div>

        {/* Right: meta */}
        <div className="flex flex-wrap gap-3 text-right shrink-0">
          <div>
            <p className="text-xs text-slate-300">{CASELOAD_LABELS[app.caseload_size] ?? app.caseload_size}</p>
            <p className="text-[10px] text-slate-600">caseload</p>
          </div>
          <div>
            <p className="text-xs text-slate-300">{CLIENT_LABELS[app.client_group] ?? app.client_group}</p>
            <p className="text-[10px] text-slate-600">client group</p>
          </div>
          <div>
            <p className="text-xs text-slate-300">
              {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </p>
            <p className="text-[10px] text-slate-600">applied</p>
          </div>
        </div>
      </div>

      {/* Motivation */}
      {app.motivation && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? '▾ Hide motivation' : '▸ Show motivation'}
          </button>
          {expanded && (
            <p className="mt-2 text-xs text-slate-400 leading-relaxed border-l-2 border-slate-700 pl-3">
              {app.motivation}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <ActionButtons app={app} onDone={() => setKey(k => k + 1)} />
    </div>
  );
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'accepted',  label: 'Accepted' },
  { key: 'waitlisted',label: 'Waitlisted' },
  { key: 'rejected',  label: 'Rejected' },
];

export default function SlpBetaClient({ applications }: { applications: Application[] }) {
  const [filter, setFilter] = useState<Filter>('pending');

  const counts = {
    all:        applications.length,
    pending:    applications.filter(a => a.status === 'pending').length,
    accepted:   applications.filter(a => a.status === 'accepted').length,
    waitlisted: applications.filter(a => a.status === 'waitlisted').length,
    rejected:   applications.filter(a => a.status === 'rejected').length,
  };

  const visible = filter === 'all' ? applications : applications.filter(a => a.status === filter);

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total applications', value: counts.all },
          { label: 'Pending review',     value: counts.pending,   highlight: counts.pending > 0 },
          { label: 'Accepted',           value: counts.accepted },
          { label: 'Waitlisted',         value: counts.waitlisted },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className={`text-2xl font-extrabold tabular-nums ${s.highlight ? 'text-amber-400' : 'text-white'}`}>
              {s.value}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${filter === f.key
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300'}
            `}
          >
            {f.label}
            {counts[f.key] > 0 && (
              <span className={`ml-1.5 tabular-nums ${f.key === 'pending' && filter !== 'pending' ? 'text-amber-400' : 'opacity-60'}`}>
                {counts[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Application list */}
      {visible.length === 0 ? (
        <div className="text-center py-16 border border-slate-800 rounded-2xl">
          <p className="text-slate-500 text-sm">
            {filter === 'pending' ? 'No pending applications.' : `No ${filter} applications.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(app => (
            <ApplicationCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
