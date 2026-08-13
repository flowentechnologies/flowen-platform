import { assertAdmin } from '@/lib/admin/guard';
import Link from 'next/link';
import { IP_DOCS, STATUS_BADGE, TYPE_LABEL } from '@/lib/ip-docs/registry';

const CATEGORY_LABELS: Record<string, { emoji: string; label: string }> = {
  contracts:     { emoji: '📋', label: 'Contracts' },
  ai_models:     { emoji: '🧠', label: 'AI Models' },
  software:      { emoji: '💻', label: 'Software' },
  trade_secrets: { emoji: '🔒', label: 'Trade Secrets' },
  data_datasets: { emoji: '📊', label: 'Data & Datasets' },
  patents:       { emoji: '⚡', label: 'Patents' },
  trademarks:    { emoji: '™', label: 'Trademarks' },
};

const STATUS_LABEL: Record<string, string> = {
  'draft':                 'Draft',
  'internal-approved':     'Approved',
  'requires-legal-review': 'Needs Legal Review',
};

export default async function IpDocsHubPage() {
  await assertAdmin();

  const grouped = IP_DOCS.reduce<Record<string, typeof IP_DOCS>>((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {});

  const total = IP_DOCS.length;
  const approved = IP_DOCS.filter(d => d.status === 'internal-approved').length;
  const needsLegal = IP_DOCS.filter(d => d.status === 'requires-legal-review').length;

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 mb-8">
          <Link href="/admin" className="hover:text-slate-300 transition-colors">Admin</Link>
          <span>/</span>
          <Link href="/admin/ip-readiness" className="hover:text-slate-300 transition-colors">IP Readiness</Link>
          <span>/</span>
          <span className="text-slate-400">Documents</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">IP Document Library</h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Internal IP documents, legal templates, audit reports, and policies. All documents
            are confidential and admin-access only. Legal templates must be reviewed by a
            qualified UK solicitor before signing.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Total Documents', value: total, color: 'text-slate-200' },
            { label: 'Internally Approved', value: approved, color: 'text-emerald-400' },
            { label: 'Needs Legal Review', value: needsLegal, color: 'text-rose-400' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-800/40 bg-slate-900/40 px-5 py-4">
              <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Documents by category */}
        {Object.entries(grouped).map(([cat, docs]) => {
          const meta = CATEGORY_LABELS[cat] ?? { emoji: '📄', label: cat };
          return (
            <div key={cat} className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
              </h2>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {docs.map((doc, i) => (
                  <Link
                    key={doc.slug}
                    href={`/admin/ip-docs/${doc.slug}`}
                    className={`flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/60 transition-colors group ${i < docs.length - 1 ? 'border-b border-slate-200 dark:border-slate-800/60' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-xs text-slate-500 shrink-0">{TYPE_LABEL[doc.type]}</div>
                      <div className="font-medium text-sm text-slate-200 group-hover:text-white transition-colors truncate">{doc.title}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[doc.status]}`}>
                        {STATUS_LABEL[doc.status]}
                      </span>
                      <span className="text-xs text-slate-600">v{doc.version}</span>
                      <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        {/* Back link */}
        <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
          <Link href="/admin/ip-readiness" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-2">
            ← Back to IP Readiness Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
