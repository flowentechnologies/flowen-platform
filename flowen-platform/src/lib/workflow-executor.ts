import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  sendWelcomeEmail,
  sendCheckIn3d,
  sendMilestone7d,
  sendReEngagement,
  sendFoundingOffer,
  sendUpgradeNudge,
  sendPaymentFailedUser,
  sendAdminWorkflowAlert,
} from './email';
import { stripe } from './stripe';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface WorkflowStep {
  step: number;
  action: string;
  template?: string;
  delay_hours?: number;
  threshold_days?: number;
  limit?: number;
  channel?: string;
  priority?: string;
  category?: string;
}

export interface WorkflowUser {
  userId: string;
  email: string;
  displayName: string;
}

export interface ExecuteOptions {
  userId?: string;
  email?: string;
  displayName?: string;
  triggeredBy?: string;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

async function wasNotificationSent(admin: SupabaseClient, userId: string, type: string): Promise<boolean> {
  const { data } = await admin
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function logNotification(admin: SupabaseClient, userId: string, type: string) {
  await admin.from('notification_log').insert({ user_id: userId, type });
}

// ── User resolution ───────────────────────────────────────────────────────────

async function resolveUser(admin: SupabaseClient, userId: string): Promise<WorkflowUser | null> {
  const [authRes, profileRes] = await Promise.all([
    admin.schema('auth').from('users').select('email').eq('id', userId).maybeSingle(),
    admin.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
  ]);
  const email = (authRes.data as { email?: string } | null)?.email;
  if (!email) return null;
  return {
    userId,
    email,
    displayName: (profileRes.data as { display_name?: string } | null)?.display_name ?? email.split('@')[0],
  };
}

// ── Email template dispatch ───────────────────────────────────────────────────

async function dispatchTemplate(template: string, user: WorkflowUser): Promise<boolean> {
  switch (template) {
    case 'sendWelcomeEmail':      await sendWelcomeEmail(user.email, user.displayName);      return true;
    case 'check_in_3d':           await sendCheckIn3d(user.email, user.displayName);         return true;
    case 'milestone_7d':          await sendMilestone7d(user.email, user.displayName);       return true;
    case 're_engagement':         await sendReEngagement(user.email, user.displayName);      return true;
    case 'founding_offer':        await sendFoundingOffer(user.email, user.displayName);     return true;
    case 'upgrade_nudge':         await sendUpgradeNudge(user.email, user.displayName);      return true;
    case 'sendPaymentFailedUser': await sendPaymentFailedUser(user.email, user.displayName); return true;
    default:
      console.warn(`[workflow-executor] unknown template: ${template}`);
      return false;
  }
}

// ── Identify helpers (for schedule-triggered aggregate workflows) ──────────────

async function identifyInactiveUsers(admin: SupabaseClient, thresholdDays: number): Promise<WorkflowUser[]> {
  const cutoff = new Date(Date.now() - thresholdDays * 86400_000).toISOString();

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, display_name')
    .eq('onboarding_complete', true)
    .not('email', 'is', null);

  if (!profiles?.length) return [];

  const { data: recentSessions } = await admin
    .from('practice_sessions')
    .select('user_id')
    .in('user_id', profiles.map(p => p.id))
    .gte('created_at', cutoff);

  const activeIds = new Set((recentSessions ?? []).map(s => s.user_id as string));
  return profiles
    .filter(p => !activeIds.has(p.id))
    .map(p => ({
      userId: p.id as string,
      email: p.email as string,
      displayName: (p.display_name as string | null) ?? (p.email as string).split('@')[0],
    }));
}

async function identifyTrialEndingUsers(admin: SupabaseClient, daysAhead = 3): Promise<WorkflowUser[]> {
  const windowEnd = new Date(Date.now() + daysAhead * 86400_000).toISOString();
  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('status', 'trialing')
    .lte('current_period_end', windowEnd);

  if (!subs?.length) return [];
  const resolved = await Promise.all((subs as { user_id: string }[]).map(s => resolveUser(admin, s.user_id)));
  return resolved.filter(Boolean) as WorkflowUser[];
}

async function queryWaitlistBatch(admin: SupabaseClient, limit: number): Promise<WorkflowUser[]> {
  const { data } = await admin
    .from('waitlist_signups')
    .select('id, email, metadata')
    .is('invited_at', null)
    .limit(limit);

  return (data ?? []).map(w => ({
    userId: w.id as string,
    email: w.email as string,
    displayName: ((w.metadata as Record<string, string> | null)?.full_name) ?? (w.email as string).split('@')[0],
  }));
}

// ── Step execution (user-scoped) ──────────────────────────────────────────────

// Returns { nextStep, nextStepAt } when a wait step is encountered, or null/null when done.
async function executeUserSteps(
  admin: SupabaseClient,
  steps: WorkflowStep[],
  user: WorkflowUser,
  workflowId: string,
  workflowName: string,
  fromStep: number,
): Promise<{ nextStep: number | null; nextStepAt: Date | null; count: number }> {
  const sorted = steps.slice().sort((a, b) => a.step - b.step);
  let count = 0;

  for (const step of sorted) {
    if (step.step < fromStep) continue;

    switch (step.action) {
      case 'wait': {
        const delayHours = step.delay_hours ?? 24;
        const nextStepAt = new Date(Date.now() + delayHours * 3600_000);
        const nextIdx = sorted.findIndex(s => s.step > step.step);
        const nextStep = nextIdx >= 0 ? sorted[nextIdx].step : null;
        return { nextStep, nextStepAt, count };
      }

      case 'send_email': {
        const notifKey = `wf_${workflowId}_step${step.step}`;
        const already = await wasNotificationSent(admin, user.userId, notifKey);
        if (!already && step.template) {
          const sent = await dispatchTemplate(step.template, user).catch(() => false);
          if (sent) {
            await logNotification(admin, user.userId, notifKey);
            count++;
          }
        }
        break;
      }

      case 'send_admin_alert': {
        await sendAdminWorkflowAlert({
          workflowName,
          userEmail: user.email,
          userName: user.displayName,
        }).catch(err => console.error('[workflow-executor] admin alert error:', err));
        count++;
        break;
      }

      case 'create_ticket': {
        await admin.from('support_tickets').insert({
          subject: `Clinical escalation: ${user.displayName}`,
          body: `Automated clinical escalation for ${user.displayName} (${user.email}).`,
          category: (step.category ?? 'clinical') as string,
          priority: (step.priority ?? 'high') as string,
          user_email: user.email,
          user_name: user.displayName,
          sla_due_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
        });
        count++;
        break;
      }

      case 'retry_payment': {
        const { data: customer } = await admin
          .from('customers')
          .select('stripe_customer_id')
          .eq('id', user.userId)
          .maybeSingle();

        if (customer?.stripe_customer_id) {
          try {
            const invoices = await stripe.invoices.list({
              customer: customer.stripe_customer_id as string,
              status: 'open',
              limit: 1,
            });
            if (invoices.data.length > 0) {
              await stripe.invoices.pay(invoices.data[0].id);
              count++;
            }
          } catch (err) {
            console.error('[workflow-executor] retry_payment error:', err);
          }
        }
        break;
      }

      default:
        break;
    }
  }

  return { nextStep: null, nextStepAt: null, count };
}

// ── Step execution (aggregate / schedule-triggered) ───────────────────────────

async function executeAggregateSteps(
  admin: SupabaseClient,
  steps: WorkflowStep[],
  workflowId: string,
): Promise<number> {
  const sorted = steps.slice().sort((a, b) => a.step - b.step);
  let users: WorkflowUser[] = [];
  let count = 0;

  for (const step of sorted) {
    switch (step.action) {
      case 'identify_inactive_users':
        users = await identifyInactiveUsers(admin, step.threshold_days ?? 7);
        break;

      case 'identify_trial_ending':
        users = await identifyTrialEndingUsers(admin, 3);
        break;

      case 'query_waitlist':
        users = await queryWaitlistBatch(admin, step.limit ?? 10);
        break;

      case 'send_email': {
        if (!users.length) break;
        const notifKey = `wf_${workflowId}_step${step.step}`;
        const userIds = users.map(u => u.userId);

        if (step.template === 'founding_offer') {
          // Batch-check which waitlist entries already have invited_at set
          const { data: existing } = await admin
            .from('waitlist_signups')
            .select('id, invited_at')
            .in('id', userIds);
          const alreadyInvited = new Set(
            (existing ?? [])
              .filter((e: { invited_at?: string | null }) => e.invited_at)
              .map((e: { id: string }) => e.id),
          );

          for (const user of users) {
            if (alreadyInvited.has(user.userId)) continue;
            // Mark invited_at first so a send failure doesn't cause a re-send on the next run
            await admin
              .from('waitlist_signups')
              .update({ invited_at: new Date().toISOString() })
              .eq('id', user.userId);
            await dispatchTemplate(step.template, user).catch(() => false);
            count++;
          }
        } else {
          // Batch-check which users already received this notification
          const { data: logs } = await admin
            .from('notification_log')
            .select('user_id')
            .eq('type', notifKey)
            .in('user_id', userIds);
          const alreadySent = new Set((logs ?? []).map((l: { user_id: string }) => l.user_id));

          for (const user of users) {
            if (alreadySent.has(user.userId) || !step.template) continue;
            const sent = await dispatchTemplate(step.template, user).catch(() => false);
            if (sent) {
              await logNotification(admin, user.userId, notifKey);
              count++;
            }
          }
        }
        break;
      }

      case 'wait':
        // Schedule workflows run on a fixed cadence; wait steps are no-ops
        break;

      default:
        break;
    }
  }

  return count;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function executeWorkflow(
  workflowId: string,
  options: ExecuteOptions = {},
): Promise<{ runId: string; status: 'success' | 'failed'; count: number; error?: string }> {
  const admin = adminDb();
  const startedAt = new Date().toISOString();
  const triggeredBy = options.triggeredBy ?? 'manual';

  const { data: wf } = await admin
    .from('workflow_definitions')
    .select('id, name, trigger_type, steps')
    .eq('id', workflowId)
    .single();

  if (!wf) return { runId: '', status: 'failed', count: 0, error: 'Workflow not found' };

  const steps = wf.steps as WorkflowStep[];
  const workflowName = (wf as { name: string }).name ?? workflowId;

  const { data: runRow } = await admin
    .from('workflow_runs')
    .insert({
      workflow_id: workflowId,
      status: 'running',
      triggered_by: triggeredBy,
      user_id: options.userId ?? null,
      current_step: 1,
      started_at: startedAt,
      context: { userId: options.userId, email: options.email, triggeredBy },
    })
    .select('id')
    .single();

  const runId = (runRow as { id: string } | null)?.id ?? '';

  try {
    let count = 0;

    if (options.userId || options.email) {
      let user: WorkflowUser;
      if (options.userId && (!options.email || !options.displayName)) {
        const resolved = await resolveUser(admin, options.userId);
        if (!resolved) throw new Error(`Cannot resolve user ${options.userId}`);
        user = resolved;
      } else {
        user = {
          userId: options.userId ?? '',
          email: options.email ?? '',
          displayName: options.displayName ?? (options.email?.split('@')[0] ?? 'User'),
        };
      }

      const { nextStep, nextStepAt, count: stepCount } = await executeUserSteps(
        admin, steps, user, workflowId, workflowName, 1,
      );
      count = stepCount;

      if (nextStep !== null && nextStepAt !== null) {
        // Create a pending run to continue after the wait delay
        await admin.from('workflow_runs').insert({
          workflow_id: workflowId,
          status: 'pending',
          triggered_by: triggeredBy,
          user_id: options.userId ?? null,
          current_step: nextStep,
          next_step_at: nextStepAt.toISOString(),
          started_at: startedAt,
          context: { userId: options.userId, email: user.email, triggeredBy },
        });
      }
    } else {
      count = await executeAggregateSteps(admin, steps, workflowId);
    }

    const finishedAt = new Date().toISOString();
    await admin.from('workflow_runs').update({
      status: 'success',
      result: { actions_count: count },
      duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
      finished_at: finishedAt,
    }).eq('id', runId);

    await admin.rpc('increment_workflow_run_count', { wf_id: workflowId, ran_at: startedAt });

    return { runId, status: 'success', count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from('workflow_runs').update({
      status: 'failed',
      error: msg,
      finished_at: new Date().toISOString(),
    }).eq('id', runId);
    return { runId, status: 'failed', count: 0, error: msg };
  }
}

// Fire all active workflows registered for a named event
export async function fireEventWorkflows(event: string, options: ExecuteOptions): Promise<void> {
  const admin = adminDb();
  const { data: workflows } = await admin
    .from('workflow_definitions')
    .select('id')
    .eq('status', 'active')
    .eq('trigger_config->>event', event);

  if (!workflows?.length) return;
  await Promise.all(
    (workflows as { id: string }[]).map(wf =>
      executeWorkflow(wf.id, options).catch(err =>
        console.error(`[workflow-executor] fireEventWorkflows error wf=${wf.id}:`, err),
      ),
    ),
  );
}

// Run all active schedule-triggered workflows (called by cron)
export async function runScheduleWorkflows(): Promise<{ total: number; count: number }> {
  const admin = adminDb();
  const { data: workflows } = await admin
    .from('workflow_definitions')
    .select('id')
    .eq('status', 'active')
    .eq('trigger_type', 'schedule');

  if (!workflows?.length) return { total: 0, count: 0 };

  const results = await Promise.all(
    (workflows as { id: string }[]).map(wf => executeWorkflow(wf.id, { triggeredBy: 'cron' })),
  );
  return { total: results.length, count: results.reduce((sum, r) => sum + r.count, 0) };
}

// Advance pending runs whose wait delay has elapsed (called by cron)
export async function advancePendingRuns(): Promise<{ advanced: number; errors: number }> {
  const admin = adminDb();
  const now = new Date().toISOString();

  const { data: pendingRuns } = await admin
    .from('workflow_runs')
    .select('id, workflow_id, user_id, current_step, context')
    .eq('status', 'pending')
    .lte('next_step_at', now)
    .limit(50);

  if (!pendingRuns?.length) return { advanced: 0, errors: 0 };

  // Batch-fetch all unique workflow definitions upfront
  const workflowIds = [...new Set((pendingRuns as { workflow_id: string }[]).map(r => r.workflow_id))];
  const { data: wfRows } = await admin
    .from('workflow_definitions')
    .select('id, name, steps, status')
    .in('id', workflowIds);
  const wfMap = new Map(
    (wfRows ?? []).map((w: { id: string; name: string; steps: WorkflowStep[]; status: string }) => [w.id, w]),
  );

  let advanced = 0;
  let errors = 0;

  for (const run of pendingRuns as {
    id: string;
    workflow_id: string;
    user_id: string | null;
    current_step: number;
    context: Record<string, string>;
  }[]) {
    try {
      const wf = wfMap.get(run.workflow_id);

      if (!wf || wf.status !== 'active') {
        await admin.from('workflow_runs').update({ status: 'skipped', finished_at: now }).eq('id', run.id);
        continue;
      }

      const steps = wf.steps;
      const workflowName = wf.name ?? run.workflow_id;

      let user: WorkflowUser | null = null;
      if (run.user_id) {
        user = await resolveUser(admin, run.user_id);
      } else if (run.context.email) {
        user = {
          userId: run.user_id ?? '',
          email: run.context.email,
          displayName: run.context.email.split('@')[0],
        };
      }

      if (!user) {
        await admin.from('workflow_runs').update({ status: 'skipped', finished_at: now }).eq('id', run.id);
        continue;
      }

      // Mark running only after validation passes
      await admin.from('workflow_runs').update({ status: 'running' }).eq('id', run.id);

      const { nextStep, nextStepAt, count } = await executeUserSteps(
        admin, steps, user, run.workflow_id, workflowName, run.current_step,
      );

      if (nextStep !== null && nextStepAt !== null) {
        await admin.from('workflow_runs').update({
          status: 'pending',
          current_step: nextStep,
          next_step_at: nextStepAt.toISOString(),
        }).eq('id', run.id);
      } else {
        await admin.from('workflow_runs').update({
          status: 'success',
          result: { actions_count: count },
          finished_at: new Date().toISOString(),
        }).eq('id', run.id);
        await admin.rpc('increment_workflow_run_count', { wf_id: run.workflow_id, ran_at: now });
      }
      advanced++;
    } catch (err) {
      console.error('[workflow-executor] advance error for run', run.id, err);
      await admin.from('workflow_runs').update({
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        finished_at: new Date().toISOString(),
      }).eq('id', run.id);
      errors++;
    }
  }

  return { advanced, errors };
}
