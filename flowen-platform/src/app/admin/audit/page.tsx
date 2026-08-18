import { assertAdmin } from '@/lib/admin/guard';
import { AuditClient } from './AuditClient';
import type { AuditEntry } from '@/app/api/admin/audit/route';
import { adminDb as db } from '@/lib/supabase/admin';

export default async function AuditPage() {
  await assertAdmin();

  const client = db();

  // Fetch first page directly from Supabase
  const { data, error, count } = await client
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 49);

  let entries: AuditEntry[] = [];
  let total = 0;

  if (!error && data) {
    entries = data as AuditEntry[];
    total = count ?? 0;
  }

  // Auto-seed if table is empty
  if (total === 0) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      await fetch(`${baseUrl}/api/admin/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
        cache: 'no-store',
      });

      // Re-fetch after seeding
      const { data: seeded, count: seededCount } = await client
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(0, 49);

      if (seeded) {
        entries = seeded as AuditEntry[];
        total = seededCount ?? 0;
      }
    } catch {
      // Seeding failed; page still renders with empty state
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Audit Log</h1>
          <p className="text-slate-400 text-sm mt-1">
            Complete record of admin actions for regulatory and compliance review.
          </p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30">
          GDPR &amp; NHS Compliant
        </span>
      </div>

      <AuditClient initialEntries={entries} total={total} />
    </div>
  );
}
