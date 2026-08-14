import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import SlpBetaClient, { type Application } from './SlpBetaClient';

export const metadata: Metadata = { title: 'SLT Beta Applications — Flowen Admin' };

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function SlpBetaPage() {
  await assertAdmin();

  const { data, error } = await db()
    .from('slp_beta_applications')
    .select('id, created_at, name, email, organisation, caseload_size, client_group, motivation, status')
    .order('created_at', { ascending: false });

  const applications: Application[] = (data ?? []) as Application[];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          SLT Beta Applications
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review and act on speech and language therapist applications to the Flowen SLT Beta Programme.
          Approving sets the applicant&apos;s role to <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">slp</code> and sends an acceptance email.
        </p>
        {error && (
          <div className="mt-4 px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-sm text-rose-500">
            Failed to load applications: {error.message}
          </div>
        )}
      </div>

      <SlpBetaClient applications={applications} />
    </div>
  );
}
