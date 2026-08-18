import { assertAdmin } from '@/lib/admin/guard';
import { NotificationsClient } from './NotificationsClient';
import type { AlertRule, AlertHistoryEntry } from '@/app/api/admin/notifications/route';
import { adminDb as db } from '@/lib/supabase/admin';

export default async function NotificationsPage() {
  await assertAdmin();

  const supabase = db();

  // Seed if fewer than 2 rules exist
  try {
    const { count } = await supabase
      .from('alert_rules')
      .select('*', { count: 'exact', head: true });

    if ((count ?? 0) < 2) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
      await fetch(`${baseUrl}/api/admin/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
        cache: 'no-store',
      });
    }
  } catch { /* non-fatal */ }

  let rules: AlertRule[] = [];
  let history: AlertHistoryEntry[] = [];

  try {
    const [rulesRes, historyRes] = await Promise.all([
      supabase.from('alert_rules').select('*').order('created_at', { ascending: true }),
      supabase
        .from('alert_history')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(20),
    ]);

    rules = (rulesRes.data ?? []) as AlertRule[];
    history = (historyRes.data ?? []) as AlertHistoryEntry[];

    // Attach last 3 history entries per rule
    const historyByRule: Record<string, AlertHistoryEntry[]> = {};
    for (const h of history) {
      if (!historyByRule[h.rule_id]) historyByRule[h.rule_id] = [];
      if (historyByRule[h.rule_id].length < 3) historyByRule[h.rule_id].push(h);
    }
    rules = rules.map((r) => ({ ...r, history: historyByRule[r.id] ?? [] }));
  } catch { /* render empty state */ }

  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Alert &amp; Notification Rules</h1>
        <p className="text-slate-400 text-sm mt-1">
          Automated watchdog — grant deadlines, GDPR compliance, hazard monitoring, and user retention.
        </p>
      </div>
      <NotificationsClient initialRules={rules} initialHistory={history} />
    </div>
  );
}
