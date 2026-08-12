import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import IPReadinessClient from './IPReadinessClient';
import type { AuditItem, FundingItem } from '@/app/api/admin/ip-readiness/route';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function IPReadinessPage() {
  await assertAdmin();

  const db = adminDb();

  const [auditRes, fundingRes] = await Promise.all([
    db.from('ip_audit_items').select('*').order('priority').order('created_at'),
    db.from('ip_funding_items').select('*').order('created_at'),
  ]);

  const auditItems:   AuditItem[]   = auditRes.data   ?? [];
  const fundingItems: FundingItem[] = fundingRes.data ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">IP Debt &amp; Venture Readiness</h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xl">
            Structured IP audit (Tier 1) and IP-specific funding &amp; access pipeline (Tier 2) — close IP debt before investor term sheets
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            TIER 1 · AUDIT
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            TIER 2 · FUNDING
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            CONFIDENTIAL
          </span>
        </div>
      </div>

      <IPReadinessClient
        initialAuditItems={auditItems}
        initialFundingItems={fundingItems}
      />
    </div>
  );
}
