import { assertAdmin } from '@/lib/admin/guard';
import { getDoc, STATUS_BADGE, TYPE_LABEL } from '@/lib/ip-docs/registry';
import { CONTENT } from '@/lib/ip-docs/content';
import { getIpDocLiveData } from '@/lib/ip-docs/live-data';
import { adminDb } from '@/lib/supabase/admin';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PrintButton from '@/components/PrintButton';

const AUDIT_STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete:    'Complete',
  blocked:     'Blocked',
  waived:      'Waived',
};
const AUDIT_STATUS_BADGE: Record<string, string> = {
  not_started: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
  in_progress: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  complete:    'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  blocked:     'bg-rose-500/10 border-rose-500/30 text-rose-400',
  waived:      'bg-slate-500/10 border-slate-500/30 text-slate-400',
};

// Force dynamic — page is auth-gated (assertAdmin uses cookies) and
// all content is in-memory, so static pre-rendering has no benefit.
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return { title: 'Document not found' };
  return { title: `${doc.title} — Flowen IP Docs` };
}

const STATUS_LABEL: Record<string, string> = {
  'draft':                 'Draft',
  'internal-approved':     'Internally Approved',
  'requires-legal-review': 'Requires Legal Review',
};

const CATEGORY_LABEL: Record<string, string> = {
  regulatory:    'Regulatory & Clinical Safety',
  contracts:     'Contracts',
  ai_models:     'AI Models',
  software:      'Software',
  trade_secrets: 'Trade Secrets',
  data_datasets: 'Data & Datasets',
  patents:       'Patents',
  trademarks:    'Trademarks',
};

export default async function IpDocPage({ params }: Props) {
  await assertAdmin();
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  // Some documents (currently just the SEIS letter) are a function of live
  // data tracked elsewhere in the admin system, rather than static prose —
  // only fetch that data when a document actually needs it.
  const entry = CONTENT[slug];
  const content = typeof entry === 'function' ? entry(await getIpDocLiveData()) : entry;

  // doc.auditSlug names a row in ip_audit_items by title — the registry has
  // carried this field, correctly kept in sync, since the ip-readiness
  // tracker was built, but nothing actually read it: this document page
  // never showed whether the real-world action it describes has been done.
  // A legal template like the Founder IP Assignment Deed could sit here
  // marked "requires-legal-review" indefinitely with no visible link to
  // the audit item that says whether it's actually been signed.
  const auditItem = doc.auditSlug
    ? (await adminDb().from('ip_audit_items').select('status, risk_level, evidence_url, notes, updated_at').eq('title', doc.auditSlug).maybeSingle()).data
    : null;

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 mb-8 flex-wrap">
          <Link href="/admin" className="hover:text-slate-300 transition-colors">Admin</Link>
          <span>/</span>
          <Link href="/admin/ip-readiness" className="hover:text-slate-300 transition-colors">IP Readiness</Link>
          <span>/</span>
          <Link href="/admin/ip-docs" className="hover:text-slate-300 transition-colors">Documents</Link>
          <span>/</span>
          <span className="text-slate-400 truncate">{doc.title}</span>
        </nav>

        {/* Header */}
        <div className="mb-8 pb-8 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs text-slate-500">{CATEGORY_LABEL[doc.category] ?? doc.category}</span>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-500">{TYPE_LABEL[doc.type]}</span>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-500">v{doc.version}</span>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-500">{doc.date}</span>
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight mb-3">{doc.title}</h1>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_BADGE[doc.status]}`}>
                {STATUS_LABEL[doc.status]}
              </span>
            </div>
            <PrintButton title={doc.title} contentSelector=".prose-sm" />
          </div>
        </div>

        {/* Live audit status — this is the doc's real-world completion
            status, tracked in ip_audit_items, not the "draft/requires
            review" status above (which is about the template text itself). */}
        {doc.auditSlug && (
          <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
            {auditItem ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">
                    Real-world status — <Link href="/admin/ip-readiness" className="underline hover:text-slate-300">IP Readiness tracker</Link>
                  </p>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${AUDIT_STATUS_BADGE[auditItem.status] ?? AUDIT_STATUS_BADGE.not_started}`}>
                    {AUDIT_STATUS_LABEL[auditItem.status] ?? auditItem.status}
                  </span>
                  {auditItem.notes && <p className="text-xs text-slate-500 mt-2 max-w-xl">{auditItem.notes}</p>}
                </div>
                {auditItem.evidence_url && (
                  <a href={auditItem.evidence_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300 underline shrink-0">
                    View evidence →
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No matching row found in <Link href="/admin/ip-readiness" className="underline hover:text-slate-300">IP Readiness</Link> for &quot;{doc.auditSlug}&quot; — the link in this document&apos;s registry entry has gone stale.
              </p>
            )}
          </div>
        )}

        {/* Document body */}
        <div className="prose-sm max-w-none">
          {content ?? (
            <div className="text-slate-500 text-sm italic">Document content not yet available.</div>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Link href="/admin/ip-docs" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-2">
            ← All Documents
          </Link>
          <Link href="/admin/ip-readiness" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            IP Readiness Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
