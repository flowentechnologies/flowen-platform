import { assertAdmin } from '@/lib/admin/guard';
import { getDoc, IP_DOCS, STATUS_BADGE, TYPE_LABEL } from '@/lib/ip-docs/registry';
import { CONTENT } from '@/lib/ip-docs/content';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PrintButton from '@/components/PrintButton';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return IP_DOCS.map(d => ({ slug: d.slug }));
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

  const content = CONTENT[slug];

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
        <div className="mb-8 pb-8 border-b border-slate-800">
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
            <PrintButton />
          </div>
        </div>

        {/* Document body */}
        <div className="prose-sm max-w-none">
          {content ?? (
            <div className="text-slate-500 text-sm italic">Document content not yet available.</div>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-slate-800 flex items-center justify-between">
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
