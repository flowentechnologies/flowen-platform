import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { findFailingJobs, flagStalePRs, type CronRunRow, type GithubPullRequest } from '@/lib/admin/todo';
import { TodoClient, type ActionItem } from './TodoClient';

// ── GitHub (public repo, no token needed) ───────────────────────────────────

async function getOpenPRs(): Promise<GithubPullRequest[] | null> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/flowentechnologies/flowen-platform/pulls?state=open&per_page=30',
      { headers: { Accept: 'application/vnd.github+json' }, next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = await res.json() as Array<{ number: number; title: string; html_url: string; draft: boolean; created_at: string }>;
    return data.map(pr => ({
      number: pr.number, title: pr.title, html_url: pr.html_url, draft: pr.draft, created_at: pr.created_at,
    }));
  } catch {
    return null;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TodoPage() {
  await assertAdmin();

  const db = adminDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [cronRunsRes, itemsRes, openPRs] = await Promise.all([
    db
      .from('cron_runs')
      .select('job_id,status,error,started_at')
      .gte('started_at', sevenDaysAgo)
      .order('started_at', { ascending: false })
      .limit(2000),
    db
      .from('admin_action_items')
      .select('id,title,description,category,status,created_at,resolved_at,resolved_by')
      .order('created_at', { ascending: false }), // open-vs-done grouping is done client-side
    getOpenPRs(),
  ]);

  const failingJobs = findFailingJobs((cronRunsRes.data ?? []) as CronRunRow[]);
  const flaggedPRs  = openPRs ? flagStalePRs(openPRs) : null;
  const actionItems = (itemsRes.data ?? []) as ActionItem[];

  const generatedAt = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">To-Do</h1>
          <p className="text-slate-400 text-sm mt-1">Auto-detected from cron runs &amp; open PRs, plus anything only a human can resolve</p>
        </div>
        <span className="text-[10px] text-slate-500 font-mono hidden sm:block">{generatedAt} (London)</span>
      </div>

      <TodoClient
        failingJobs={failingJobs}
        flaggedPRs={flaggedPRs}
        initialItems={actionItems}
      />
    </div>
  );
}
