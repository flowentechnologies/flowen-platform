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
  recentAudit:  { id: string; created_at: string; severity: string; action: string; actor_email: string | null }[];
  recentWaitlist: { id: string; email: string; source: string | null; created_at: string }[];
  // Extras
  tierCounts: Record<string, number>;
  foundingGoal: number;
  signupsByDay: Record<string, number>;
  // Fundraising
  grantsPipelineValuePence: number;
  grantsSubmitted: number;
  grantsDeadlineSoon: number;
  runwayMonths: number | null;
  runwayZeroDate: string | null;
  // Roadmap
  roadmapInProgress: number;
  nextCriticalMilestone: { title: string; target_date: string | null } | null;
  // NHS & Compliance
  nhsReadinessScore: number;
  icbPipelineCount: number;
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

  const thirtyDaysLater = new Date(now.getTime() + 30 * 86400_000).toISOString().slice(0, 10);

  const [
    totalUsersRes, onboardedRes, foundingRes, newUsersRes,
    waitlistTotalRes, recentWaitlistRes,
    ticketsRes, gdprRes,
    workflowsRes, workflowRunsRes,
    sessionsTodayRes,
    auditRes, errorsRes,
    tiersRes, signupsWeekRes,
    grantsRes,
    roadmapStatusRes, roadmapNextRes,
    ventureRes,
    complianceRes, hazardRes,
    icbCountRes,
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
    client.from('audit_log').select('id,created_at,severity,action,actor_email').order('created_at', { ascending: false }).limit(20),
    client.from('system_error_logs').select('id,source,message,created_at').order('created_at', { ascending: false }).limit(5),
    client.from('profiles').select('tier'),
    client.from('profiles').select('created_at').gte('created_at', sevenDaysAgo),
    client.from('grants').select('amount_pence,status,deadline'),
    client.from('roadmap_milestones').select('status,priority'),
    client.from('roadmap_milestones').select('id,title,target_date').eq('priority', 'critical').not('status', 'in', '("complete","deferred")').order('target_date', { ascending: true, nullsFirst: false }).limit(1),
    client.from('venture_config').select('cash_in_bank_pence,monthly_burn_pence').eq('id', 1).maybeSingle(),
    client.from('compliance_items').select('framework,status'),
    client.from('hazard_log').select('id').eq('risk_level', 'critical').in('status', ['open','accepted']),
    client.from('nhs_icb_contacts').select('*', { count: 'exact', head: true }).in('stage', ['engaged','proposal','pilot','contract']),
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

  // Grants
  const grantRows = (grantsRes.data ?? []) as { amount_pence: number | null; status: string; deadline: string | null }[];
  const grantsPipelineValuePence = grantRows
    .filter(g => !['rejected', 'withdrawn'].includes(g.status))
    .reduce((sum, g) => sum + (g.amount_pence ?? 0), 0);
  const grantsSubmitted = grantRows.filter(g => ['submitted', 'under_review'].includes(g.status)).length;
  const grantsDeadlineSoon = grantRows.filter(g =>
    g.deadline && g.deadline <= thirtyDaysLater && !['awarded', 'rejected', 'withdrawn'].includes(g.status)
  ).length;

  // Roadmap
  const roadmapRows = (roadmapStatusRes.data ?? []) as { status: string; priority: string }[];
  const roadmapInProgress = roadmapRows.filter(r => r.status === 'in_progress').length;
  const nextCriticalMilestone = ((roadmapNextRes.data ?? []) as { id: string; title: string; target_date: string | null }[])[0] ?? null;

  // Runway
  const vc = ventureRes.data as { cash_in_bank_pence: number | null; monthly_burn_pence: number | null } | null;
  let runwayMonths: number | null = null;
  let runwayZeroDate: string | null = null;
  if (vc?.cash_in_bank_pence && vc?.monthly_burn_pence && vc.monthly_burn_pence > 0) {
    runwayMonths = Math.round((vc.cash_in_bank_pence / vc.monthly_burn_pence) * 10) / 10;
    const zeroDate = new Date(now.getTime() + runwayMonths * 30.44 * 86400_000);
    runwayZeroDate = zeroDate.toISOString().slice(0, 10);
  }

  // NHS readiness score
  const complianceRows = (complianceRes.data ?? []) as { framework: string; status: string }[];
  const frameworkWeights: Record<string, number> = { dcb0129: 30, dtac: 25, dspt: 20 };
  let nhsScore = 0;
  for (const [fw, weight] of Object.entries(frameworkWeights)) {
    const items = complianceRows.filter(c => c.framework === fw);
    const applicable = items.filter(c => c.status !== 'not_applicable');
    const complete = applicable.filter(c => c.status === 'complete').length;
    nhsScore += applicable.length > 0 ? (complete / applicable.length) * weight : weight;
  }
  if ((hazardRes.data ?? []).length === 0) nhsScore += 15;
  if ((totalUsersRes.count ?? 0) > 0) nhsScore += 10;
  const nhsReadinessScore = Math.round(nhsScore);

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
    grantsPipelineValuePence, grantsSubmitted, grantsDeadlineSoon,
    runwayMonths, runwayZeroDate,
    roadmapInProgress, nextCriticalMilestone,
    nhsReadinessScore, icbPipelineCount: icbCountRes.count ?? 0,
  };

  return NextResponse.json(data);
}
