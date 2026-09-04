import type { ReactNode } from 'react';
import Link from 'next/link';
import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import PrintButton from '@/components/PrintButton';

export interface TocEntry {
  id: string;
  label: string;
  sub?: { id: string; label: string }[];
}

interface DocPageLayoutProps {
  tag: string;
  tagColor: 'emerald' | 'cyan' | 'violet' | 'amber' | 'rose';
  title: string;
  subtitle: string;
  date: string;
  readTime: string;
  toc: TocEntry[];
  children: ReactNode;
  /** Override the default "Resources" parent crumb */
  parentLabel?: string;
  parentHref?: string;
}

const TAG_STYLES: Record<string, string> = {
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  cyan:    'bg-cyan-500/10    border-cyan-500/30    text-cyan-400',
  violet:  'bg-violet-500/10  border-violet-500/30  text-violet-400',
  amber:   'bg-amber-500/10   border-amber-500/30   text-amber-400',
  rose:    'bg-rose-500/10    border-rose-500/30    text-rose-400',
};

// Flowen dual-wave SVG — inlined so it survives print (no external fetch)
const FlowenLogoSvg = () => (
  <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
    <defs>
      <linearGradient id="doc-logo-grad" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%"   stopColor="#F59E0B" />
        <stop offset="35%"  stopColor="#10B981" />
        <stop offset="100%" stopColor="#06B6D4" />
      </linearGradient>
    </defs>
    <path d="M 10 25 C 20 25, 25 38, 35 38 C 48 38, 52 12, 65 12 C 78 12, 82 42, 95 42 C 105 42, 108 30, 115 30"
          stroke="url(#doc-logo-grad)" strokeWidth="6" strokeLinecap="round" fill="none" />
    <path d="M 10 33 C 20 33, 25 46, 35 46 C 48 46, 52 20, 65 20 C 78 20, 82 50, 95 50 C 105 50, 108 38, 115 38"
          stroke="url(#doc-logo-grad)" strokeWidth="6" strokeLinecap="round" fill="none" />
  </svg>
);

export default function DocPageLayout({
  tag, tagColor, title, subtitle, date, readTime, toc, children,
  parentLabel = 'Resources', parentHref = '/resources',
}: DocPageLayoutProps) {
  return (
    <>
      {/* ── Print CSS ── */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: #fff !important; color: #111 !important; font-family: Georgia, serif; }
          .doc-print-header { display: flex !important; }
          .doc-content h2 { color: #111 !important; border-color: #ddd !important; }
          .doc-content h3 { color: #222 !important; }
          .doc-content p, .doc-content li { color: #333 !important; }
          .doc-content strong { color: #111 !important; }
          .doc-callout { border-color: #10B981 !important; background: #f0fdf4 !important; color: #111 !important; }
          .doc-callout p, .doc-callout ul { color: #222 !important; }
          .doc-table th { background: #f5f5f5 !important; color: #111 !important; }
          .doc-table td { color: #333 !important; border-color: #e5e5e5 !important; }
          .doc-hero { background: #fff !important; border-bottom: 2px solid #10B981 !important; padding-top: 0 !important; }
          .doc-tag { background: #f0fdf4 !important; color: #059669 !important; border: 1px solid #6ee7b7 !important; }
          .doc-title { color: #111 !important; }
          .doc-subtitle { color: #555 !important; }
          .doc-meta { color: #777 !important; }
          @page { margin: 15mm 18mm; }
        }
        @media screen {
          .doc-print-header { display: none; }
        }
      `}</style>

      <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
        {/* Screen-only nav */}
        <div className="print:hidden">
          <MarketingNavbar />
        </div>

        {/* Print-only header */}
        <div className="doc-print-header items-center justify-between px-6 py-4 border-b-2 border-emerald-500 mb-6">
          <div className="flex items-center gap-3">
            <FlowenLogoSvg />
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px', color: '#111' }}>FLOWEN</span>
          </div>
          <div style={{ fontSize: 11, color: '#777' }}>flowen.digital · {date}</div>
        </div>

        {/* Breadcrumb */}
        <div className="max-w-6xl mx-auto px-6 pt-6 pb-0 print:hidden">
          <nav className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/" className="hover:text-slate-300 transition-colors">Home</Link>
            <span>/</span>
            <Link href={parentHref} className="hover:text-slate-300 transition-colors">{parentLabel}</Link>
            <span>/</span>
            <span className="text-slate-400">{title}</span>
          </nav>
        </div>

        {/* Doc hero */}
        <header className="doc-hero max-w-6xl mx-auto px-6 py-10 print:py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className={`doc-tag inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-widest border mb-4 ${TAG_STYLES[tagColor]}`}>
                {tag}
              </span>
              <h1 className="doc-title text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
                {title}
              </h1>
              <p className="doc-subtitle text-slate-400 text-base leading-relaxed max-w-2xl mb-4">{subtitle}</p>
              <p className="doc-meta text-xs text-slate-400">
                Published {date} &nbsp;·&nbsp; {readTime} read &nbsp;·&nbsp; Flowen Speech Technology Ltd
              </p>
            </div>
            <div className="flex items-center gap-3 print:hidden">
              <PrintButton title={title} />
            </div>
          </div>
        </header>

        {/* Body: sidebar TOC + content */}
        <div className="max-w-6xl mx-auto px-6 pb-20 flex gap-10 items-start w-full">
          {/* Sidebar TOC — hidden on mobile, hidden in print */}
          <aside className="hidden lg:block w-56 shrink-0 print:hidden">
            <div className="sticky top-24">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Contents</p>
              <nav className="space-y-1">
                {toc.map(entry => (
                  <div key={entry.id}>
                    <a
                      href={`#${entry.id}`}
                      className="block text-xs text-slate-400 hover:text-emerald-400 transition-colors py-0.5"
                    >
                      {entry.label}
                    </a>
                    {entry.sub?.map(s => (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        className="block text-xs text-slate-400 hover:text-slate-400 transition-colors py-0.5 pl-3"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                ))}
              </nav>
              <div className="mt-8 pt-6 border-t border-slate-800">
                <PrintButton title={title} />
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main id="main-content" className="doc-content flex-1 min-w-0 max-w-3xl">
            <div className="border-t border-slate-800 pt-10 print:border-0 print:pt-0">
              {children}
            </div>
          </main>
        </div>

        {/* Related */}
        <div className="border-t border-slate-800/60 print:hidden">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">More Resources</p>
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              ← Back to all resources
            </Link>
          </div>
        </div>

        <div className="print:hidden">
          <MarketingFooter />
        </div>
      </div>
    </>
  );
}

// ── Shared content primitives ─────────────────────────────────────────────────

export function DocH2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-bold text-white mt-12 mb-4 pb-3 border-b border-slate-800 scroll-mt-24">
      {children}
    </h2>
  );
}

export function DocH3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-base font-bold text-slate-200 mt-8 mb-3 scroll-mt-24">
      {children}
    </h3>
  );
}

export function DocP({ children }: { children: ReactNode }) {
  return <p className="text-slate-400 text-sm leading-relaxed mb-4">{children}</p>;
}

export function DocUL({ children }: { children: ReactNode }) {
  return <ul className="space-y-2 mb-6 pl-0">{children}</ul>;
}

export function DocLI({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-slate-400">
      <svg className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

export function DocCallout({ variant = 'info', children }: { variant?: 'info' | 'warning' | 'tip'; children: ReactNode }) {
  const styles = {
    info:    'border-emerald-500/40 bg-emerald-500/5',
    warning: 'border-amber-500/40 bg-amber-500/5',
    tip:     'border-cyan-500/40 bg-cyan-500/5',
  };
  return (
    <div className={`doc-callout border-l-2 rounded-r-xl px-5 py-4 mb-6 ${styles[variant]}`}>
      {children}
    </div>
  );
}

export function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="doc-table overflow-x-auto mb-8 rounded-xl border border-slate-800">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-800">
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/60">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i < rows.length - 1 ? 'border-b border-slate-800/60' : ''}>
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-3 text-sm text-slate-400 ${j === 0 ? 'font-medium text-slate-300' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
