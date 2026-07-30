import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';

export interface CCData {
  generatedAt: string;
  // Revenue
  mrrPence: number;
  arrPence: number;
  activeSubs: number;
  trialingSubs: number;
  stripeOk: boolean;
  supabaseOk: boolean;
  emailConfigured: boolean;
  // Users
  totalUsers: number;
  onboarded: number;
  foundingCount: number;
  newUsersWeek: number;
  dau: number;
  waitlistTotal: number;
  // Tickets
  openTickets: number;
  inProgressTickets: number;
  slaBreaches: number;
  // GDPR
  pendingGdpr: number;
  overdueGdpr: number;
  // Workflows
  activeWorkflows: number;
  failedRunsWeek: number;
  // Sessions
  sessionsToday: number;
  // Feeds
  recentErrors: { id: string; source: string; message: string; created_at: string }[];
  recentAudit:  { id: string; timestamp: string; severity: string; category: string; action: string }[];
  recentWaitlist: { id: string; email: string; source: string | null; created_at: string }[];
  // Extras
  tierCounts: Record<string, number>;
  foundingGoal: number;
  signupsByDay: Record<string, number>;
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now           = new Date();
  const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo  = new Date(now.getTime() - 7 * 86400_000).toISOString();

  const client = db();

  const [
    totalUsersRes, onboardedRes, foundingRes, newUsersRes,
    waitlistTotalRes, recentWaitlistRes,
    ticketsRes, gdprRes,
    workflowsRes, workflowRunsRes,
    sessionsTodayRes,
    auditRes, errorsRes,
    tiersRes, signupsWeekRes,
  ] = await Promise.all([
    client.from('profiles').select('*', { count: 'exact', head: true }),
    client.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true),
    client.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'founding'),
    client.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    client.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    client.from('waitlist_signups').select('id,email,source,created_at').order('created_at', { ascending: false }).limit(5),
    client.from('support_tickets').select('status,sla_due_at'),
    client.from('gdpr_requests').select('status,sla_due_at').not('status', 'in', '("completed","rejected")'),
    client.from('workflow_definitions').select('status'),
    client.from('workflow_runs').select('status,started_at').gte('started_at', sevenDaysAgo),
    client.from('practice_sessions').select('user_id,created_at').gte('created_at', todayStart),
    client.from('audit_logs').select('id,timestamp,severity,category,action').order('timestamp', { ascending: false }).limit(20),
    client.from('system_error_logs').select('id,source,message,created_at').order('created_at', { ascending: false }).limit(5),
    client.from('profiles').select('tier'),
    client.from('profiles').select('created_at').gte('created_at', sevenDaysAgo),
  ]);

  // Revenue from Stripe
  let mrrPence = 0; let activeSubs = 0; let trialingSubs = 0; let stripeOk = false;
  try {
    const [active, trialing] = await Promise.all([
      stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.items.data.price'] }),
      stripe.subscriptions.list({ status: 'trialing', limit: 100 }),
    ]);
    activeSubs = active.data.length;
    trialingSubs = trialing.data.length;
    for (const sub of active.data) {
      const price = sub.items.data[0]?.price as { unit_amount: number | null; recurring: { interval: string; interval_count: number } | null } | undefined;
      if (!price) continue;
      const amount = price.unit_amount ?? 0;
      const interval = price.recurring?.interval ?? 'month';
      const cnt      = price.recurring?.interval_count ?? 1;
      mrrPence += interval === 'year' ? Math.round(amount / (cnt * 12)) : Math.round(amount / cnt);
    }
    stripeOk = true;
  } catch { /* stripe unavailable */ }

  // Tickets
  const tickets = ticketsRes.data ?? [];
  const openTickets      = tickets.filter(t => t.status === 'open').length;
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
  const slaBreaches      = tickets.filter(t => !['resolved','closed'].includes(t.status) && new Date(t.sla_due_at) < now).length;

  // GDPR
  const gdpr = gdprRes.data ?? [];
  const pendingGdpr  = gdpr.filter(r => r.status === 'pending').length;
  const overdueGdpr  = gdpr.filter(r => new Date(r.sla_due_at) < now).length;

  // Workflows
  const wfs = workflowsRes.data ?? [];
  const activeWorkflows = wfs.filter(w => w.status === 'active').length;
  const failedRunsWeek  = (workflowRunsRes.data ?? []).filter(r => r.status === 'failed').length;

  // Sessions today
  const sessionRows = sessionsTodayRes.data ?? [];
  const sessionsToday = sessionRows.length;
  const dau = new Set(sessionRows.map((s: { user_id: string }) => s.user_id)).size;

  // Tier distribution
  const tierCounts: Record<string, number> = {};
  for (const p of (tiersRes.data ?? []) as { tier: string | null }[]) {
    const t = p.tier ?? 'standard';
    tierCounts[t] = (tierCounts[t] ?? 0) + 1;
  }

  // Signup sparkline (last 7 days)
  const signupsByDay: Record<string, number> = {};
  for (const p of (signupsWeekRes.data ?? []) as { created_at: string }[]) {
    const day = p.created_at.slice(0, 10);
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
  }

  const data: CCData = {
    generatedAt: now.toISOString(),
    mrrPence, arrPence: mrrPence * 12,
    activeSubs, trialingSubs, stripeOk,
    supabaseOk: !totalUsersRes.error,
    emailConfigured: !!process.env.RESEND_API_KEY,
    totalUsers: totalUsersRes.count ?? 0,
    onboarded: onboardedRes.count ?? 0,
    foundingCount: foundingRes.count ?? 0,
    newUsersWeek: newUsersRes.count ?? 0,
    dau,
    waitlistTotal: waitlistTotalRes.count ?? 0,
    recentWaitlist: recentWaitlistRes.data ?? [],
    openTickets, inProgressTickets, slaBreaches,
    pendingGdpr, overdueGdpr,
    activeWorkflows, failedRunsWeek,
    sessionsToday,
    recentErrors: errorsRes.data ?? [],
    recentAudit:  auditRes.data  ?? [],
    tierCounts, foundingGoal: 500, signupsByDay,
  };

  return NextResponse.json(data);
}
