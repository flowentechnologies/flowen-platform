'use client';

import React, { useState, useTransition } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SegmentCounts {
  waitlist: number;
  all_users: number;
  founding: number;
  active_subscribers: number;
}

interface ConsentRecord {
  id: string;
  user_id: string;
  email: string | null;
  consent_type: string;
  action: string;
  version: string | null;
  ip_address: string | null;
  created_at: string;
}

interface Props {
  counts: SegmentCounts;
  consentRecords: ConsentRecord[];
  legalDocs: { key: string; title: string; content: string }[];
}

// ── Email Templates catalog ───────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  {
    fn: 'sendWaitlistConfirmation',
    trigger: 'User joins waitlist',
    recipient: 'New lead',
    subject: "You're on the Flowen waitlist",
    preview: 'Thank you for joining — we\'ll be in touch when spots open.',
  },
  {
    fn: 'sendAdminWaitlistAlert',
    trigger: 'User joins waitlist',
    recipient: 'Admin',
    subject: 'New waitlist signup',
    preview: 'A new lead has joined the Flowen waitlist.',
  },
  {
    fn: 'sendWelcomeEmail',
    trigger: 'User completes onboarding',
    recipient: 'New user',
    subject: 'Welcome to Flowen',
    preview: 'Your account is set up and you\'re ready to begin.',
  },
  {
    fn: 'sendAdminNewUserAlert',
    trigger: 'User completes onboarding',
    recipient: 'Admin',
    subject: 'New user onboarded',
    preview: 'A new user has completed onboarding on Flowen.',
  },
  {
    fn: 'sendPaymentConfirmation',
    trigger: 'Stripe checkout.session.completed',
    recipient: 'Customer',
    subject: 'Payment confirmed — Flowen',
    preview: 'Your payment was processed successfully.',
  },
  {
    fn: 'sendAdminPaymentAlert',
    trigger: 'Stripe checkout.session.completed',
    recipient: 'Admin',
    subject: 'New payment received',
    preview: 'A customer has successfully completed checkout.',
  },
  {
    fn: 'sendPaymentFailedUser',
    trigger: 'Stripe invoice.payment_failed',
    recipient: 'Customer',
    subject: 'Payment failed — action required',
    preview: 'We were unable to process your payment. Please update your details.',
  },
  {
    fn: 'sendAdminPaymentFailedAlert',
    trigger: 'Stripe invoice.payment_failed',
    recipient: 'Admin',
    subject: 'Payment failure alert',
    preview: 'A subscription payment has failed and may need follow-up.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<string, string> = {
  waitlist:           'Waitlist',
  all_users:          'All Users',
  founding:           'Founding Members',
  active_subscribers: 'Active Subscribers',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Broadcast tab ─────────────────────────────────────────────────────────────

function BroadcastTab({ counts }: { counts: SegmentCounts }) {
  const [segment, setSegment] = useState<keyof SegmentCounts>('waitlist');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const recipientCount = counts[segment] ?? 0;

  function resetForm() {
    setSubject('');
    setBody('');
    setSegment('waitlist');
    setConfirming(false);
    setPreview(false);
  }

  function send() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/content/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segment, subject, body }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Send failed'); setConfirming(false); return; }
        setResult(data);
        resetForm();
      } catch {
        setError('Network error — broadcast failed');
        setConfirming(false);
      }
    });
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className={`p-6 rounded-2xl border ${result.failed === 0 ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-amber-500/5 border-amber-500/30'}`}>
          <p className={`text-lg font-bold mb-1 ${result.failed === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            Broadcast {result.failed === 0 ? 'sent successfully' : 'completed with errors'}
          </p>
          <p className="text-sm text-slate-400 font-mono">
            {result.sent} sent · {result.failed} failed · {result.total} total recipients
          </p>
          {result.errors.length > 0 && (
            <pre className="mt-4 text-[10px] text-red-400 font-mono bg-slate-950 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
              {result.errors.join('\n')}
            </pre>
          )}
        </div>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide mb-3">Audience Segment</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(counts) as (keyof SegmentCounts)[]).map(seg => (
            <button
              key={seg}
              type="button"
              onClick={() => setSegment(seg)}
              className={`p-3 rounded-xl border text-left transition-colors ${
                segment === seg
                  ? 'border-indigo-500/60 bg-indigo-500/10'
                  : 'border-slate-700 bg-slate-900 hover:border-slate-600'
              }`}
            >
              <p className={`text-xs font-mono mb-1 ${segment === seg ? 'text-indigo-400' : 'text-slate-500'}`}>
                {SEGMENT_LABELS[seg]}
              </p>
              <p className={`text-xl font-black ${segment === seg ? 'text-white' : 'text-slate-500'}`}>
                {counts[seg]}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Email subject line…"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Body</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={8}
          placeholder="Write your message here. Each paragraph will be rendered as its own block in the email…"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 resize-y font-mono leading-relaxed"
        />
        <p className="mt-1.5 text-[10px] text-slate-600 font-mono">Plain text only · newlines become paragraph breaks · {body.length} chars</p>
      </div>

      {/* Preview pane */}
      {preview && subject && body && (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">Preview</span>
            <button type="button" onClick={() => setPreview(false)} className="text-[10px] font-mono text-slate-500 hover:text-slate-300">hide</button>
          </div>
          <div className="bg-[#0f172a] p-6">
            <div className="max-w-lg mx-auto bg-[#1e293b] rounded-2xl border border-[#334155] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#334155]">
                <span className="inline-flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-500 rounded-md inline-flex items-center justify-center text-xs font-black text-slate-900">F</span>
                  <span className="text-sm font-bold text-white">Flowen</span>
                </span>
              </div>
              <div className="px-6 py-5">
                <h2 className="text-lg font-extrabold text-white mb-3">{subject}</h2>
                {body.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className="text-sm text-slate-400 leading-relaxed mb-3">{line}</p>
                ))}
              </div>
              <div className="px-6 py-3 border-t border-[#334155] bg-[#0f172a]">
                <p className="text-[10px] text-slate-600">Flowen · hello@flowen.digital · Unsubscribe / Privacy</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 font-mono bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{error}</p>
      )}

      {confirming ? (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-5 space-y-4">
          <p className="text-sm text-amber-300 font-mono">
            Send <span className="font-bold text-white">"{subject}"</span> to{' '}
            <span className="font-bold text-white">{recipientCount}</span> {SEGMENT_LABELS[segment]} recipients?
          </p>
          <p className="text-[11px] text-slate-500 font-mono">This action cannot be undone. Emails will be sent one-by-one (max 500).</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={send}
              disabled={isPending}
              className="px-5 py-2.5 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40"
            >
              {isPending ? 'Sending…' : `Confirm — send to ${recipientCount}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="px-5 py-2.5 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {!preview && subject && body && (
            <button
              type="button"
              onClick={() => setPreview(true)}
              className="px-4 py-2.5 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              Preview email
            </button>
          )}
          <button
            type="button"
            disabled={!subject.trim() || !body.trim() || recipientCount === 0}
            onClick={() => setConfirming(true)}
            className="px-5 py-2.5 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Send to {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Templates tab ─────────────────────────────────────────────────────────────

function TemplatesTab() {
  return (
    <div className="space-y-3">
      {EMAIL_TEMPLATES.map(t => (
        <div key={t.fn} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <code className="text-xs text-indigo-400 font-mono">{t.fn}()</code>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                t.recipient === 'Admin' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {t.recipient}
              </span>
            </div>
            <p className="text-sm text-white font-medium truncate">{t.subject}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t.preview}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-slate-600 font-mono leading-relaxed">Trigger</p>
            <p className="text-[11px] text-slate-400 font-mono">{t.trigger}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Legal tab ─────────────────────────────────────────────────────────────────

function LegalTab({ docs }: { docs: { key: string; title: string; content: string }[] }) {
  return (
    <div className="space-y-4">
      {docs.map(doc => (
        <details key={doc.key} className="group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800/50 transition-colors list-none">
            <span className="text-sm font-semibold text-white">{doc.title}</span>
            <span className="text-[10px] font-mono text-slate-500 group-open:text-slate-300 transition-colors">
              <span className="group-open:hidden">▼ expand</span>
              <span className="hidden group-open:inline">▲ collapse</span>
            </span>
          </summary>
          <div className="border-t border-slate-800 px-5 py-5">
            <pre className="text-[11px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-96">
              {doc.content.trim()}
            </pre>
          </div>
        </details>
      ))}
    </div>
  );
}

// ── Consent tab ───────────────────────────────────────────────────────────────

function ConsentTab({ records }: { records: ConsentRecord[] }) {
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? records.filter(r =>
        r.consent_type.includes(filter) ||
        r.action.includes(filter) ||
        (r.email ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : records;

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Filter by type, action, or email…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
      />

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600 font-mono">No consent records found</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden sm:table-cell">Version</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden md:table-cell">User</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden lg:table-cell">IP</th>
                <th className="text-right px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(r => (
                <tr key={r.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-300">
                      {r.consent_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                      r.action === 'granted'  ? 'bg-emerald-500/10 text-emerald-400' :
                      r.action === 'revoked'  ? 'bg-red-500/10 text-red-400' :
                      r.action === 'updated'  ? 'bg-blue-500/10 text-blue-400' :
                                                'bg-slate-800 text-slate-400'
                    }`}>
                      {r.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono hidden sm:table-cell">{r.version ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono hidden md:table-cell truncate max-w-[180px]">
                    {r.email ?? r.user_id.slice(0, 8) + '…'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono hidden lg:table-cell">{r.ip_address ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-right whitespace-nowrap">{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <p className="px-4 py-3 text-[10px] text-slate-600 font-mono border-t border-slate-800">
              Showing 200 of {filtered.length} records
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'templates' | 'broadcast' | 'legal' | 'consent';

export function ContentTabs({ counts, consentRecords, legalDocs }: Props) {
  const [tab, setTab] = useState<Tab>('templates');

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'templates', label: 'Templates', count: EMAIL_TEMPLATES.length },
    { id: 'broadcast', label: 'Broadcast' },
    { id: 'legal',    label: 'Legal Docs', count: legalDocs.length },
    { id: 'consent',  label: 'Consent Log', count: consentRecords.length },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-800 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-mono rounded-t-lg transition-colors flex items-center gap-2 -mb-px border-b-2 ${
              tab === t.id
                ? 'border-indigo-500 text-white bg-slate-800/50'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                tab === t.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'templates' && <TemplatesTab />}
      {tab === 'broadcast' && <BroadcastTab counts={counts} />}
      {tab === 'legal'    && <LegalTab docs={legalDocs} />}
      {tab === 'consent'  && <ConsentTab records={consentRecords} />}
    </div>
  );
}
