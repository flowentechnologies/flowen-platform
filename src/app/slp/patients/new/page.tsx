import type { Metadata } from 'next';
import Link from 'next/link';
import { assertSlp } from '@/lib/slp/guard';
import EnrolForm from './EnrolForm';

export const metadata: Metadata = { title: 'Enrol Patient — Flowen SLT Portal' };

export default async function EnrolPage() {
  const slp = await assertSlp();

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6">
        <Link href="/slp/caseload" className="hover:text-slate-300 transition-colors">Caseload</Link>
        <span>/</span>
        <span className="text-slate-400">Enrol Patient</span>
      </nav>

      <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">Enrol a Patient</h1>
      <p className="text-sm text-slate-400 mb-8">
        Add an existing Flowen user to your caseload and set their initial treatment plan. The patient will appear in your caseload immediately.
      </p>

      <EnrolForm slpId={slp.id} />
    </div>
  );
}
