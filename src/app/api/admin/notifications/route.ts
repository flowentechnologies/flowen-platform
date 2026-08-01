import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin/guard';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  name: string;
  rule_type:
    | 'grant_deadline'
    | 'gdpr_overdue'
    | 'hazard_open_critical'
    | 'user_retention_drop'
    | 'at_risk_users'
    | 'mrr_drop'
    | 'no_new_signups';
  enabled: boolean;
  threshold_days: number | null;
  threshold_count: number | null;
  threshold_pct: number | null;
  recipient_email: string;
  last_triggered_at: string | null;
  last_checked_at: string | null;
  created_at: string;
  history?: AlertHistoryEntry[];
}

export interface AlertHistoryEntry {
  id: string;
  rule_id: string;
  triggered_at: string;
  message: string;
  sent: boolean;
  error: string | null;
}

// ── DB helper ─────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Email sender ──────────────────────────────────────────────────────────────

async function sendAlertEmail(to: string, ruleName: string, message: string): Promise<boolean> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Fall back to nodemailer (existing email infrastructure)
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.default.createTransport({
        host: process.env.EMAIL_SERVER_HOST ?? 'smtp.outlook.com',
        port: parseInt(process.env.EMAIL_SERVER_PORT ?? '587'),
        secure: false,
        auth: {
          user: process.env.EMAIL_SERVER_USER ?? 'flowenspeech@outlook.com',
          pass: process.env.EMAIL_SERVER_PASSWORD ?? '',
        },
      });
      const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';
      await transport.sendMail({
        from: '"Flowen Admin" <flowenspeech@outlook.com>',
        to,
        subject: `[Flowen Alert] ${ruleName}`,
        text: message,
        html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;max-width:100%;">
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #334155;">
          <span style="display:inline-block;background:#f59e0b;color:#0f172a;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;font-family:monospace;">ALERT</span>
          <h1 style="margin:12px 0 0;font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:-0.5px;">${ruleName}</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.65;">${message}</p>
          <a href="${SITE}/admin/notifications" style="display:inline-block;margin-top:24px;background:#10b981;color:#0f172a;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">View Admin Panel</a>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #334155;background:#0f172a;">
          <p style="margin:0;font-size:12px;color:#64748b;">Flowen Speech Technology Ltd &bull; Automated alert from your admin panel</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      });
      return true;
    }

    // Resend path
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';
    await resend.emails.send({
      from: 'Flowen Admin <alerts@flowen.digital>',
      to,
      subject: `[Flowen Alert] ${ruleName}`,
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;max-width:100%;">
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #334155;">
          <span style="display:inline-block;background:#f59e0b;color:#0f172a;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;font-family:monospace;">ALERT</span>
          <h1 style="margin:12px 0 0;font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:-0.5px;">${ruleName}</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.65;">${message}</p>
          <a href="${SITE}/admin/notifications" style="display:inline-block;margin-top:24px;background:#10b981;color:#0f172a;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">View Admin Panel</a>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #334155;background:#0f172a;">
          <p style="margin:0;font-size:12px;color:#64748b;">Flowen Speech Technology Ltd &bull; Automated alert from your admin panel</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    });
    return true;
  } catch (err) {
    console.error('[alert-email] send error:', err);
    return false;
  }
}

// ── Check logic ───────────────────────────────────────────────────────────────

interface CheckResult {
  rule_name: string;
  triggered: boolean;
  message: string;
}

async function runChecks(): Promise<{ checked: number; triggered: number; results: CheckResult[] }> {
  const supabase = db();
  const now = new Date();

  const { data: rules, error } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('enabled', true);

  if (error || !rules) return { checked: 0, triggered: 0, results: [] };

  const results: CheckResult[] = [];
  let triggeredCount = 0;

  for (const rule of rules as AlertRule[]) {
    let triggered = false;
    let message = '';

    try {
      switch (rule.rule_type) {
        case 'grant_deadline': {
          const days = rule.threshold_days ?? 7;
          const cutoff = new Date(now.getTime() + days * 86400_000).toISOString();
          const { data: grants } = await supabase
            .from('grants')
            .select('name, deadline')
            .lte('deadline', cutoff)
            .gte('deadline', now.toISOString().slice(0, 10))
            .in('status', ['researching', 'drafting']);

          if (grants && grants.length > 0) {
            triggered = true;
            const names = grants.map((g: { name: string; deadline: string }) => `${g.name} (${g.deadline})`).join(', ');
            message = `${grants.length} grant(s) have deadlines within ${days} days: ${names}`;
          } else {
            message = `No grant deadlines approaching within ${days} days.`;
          }
          break;
        }

        case 'gdpr_overdue': {
          const days = rule.threshold_days ?? 25;
          const cutoff = new Date(now.getTime() - days * 86400_000).toISOString();
          const { data: requests } = await supabase
            .from('gdpr_requests')
            .select('id, user_email, request_type, created_at')
            .lt('created_at', cutoff)
            .neq('status', 'completed');

          if (requests && requests.length > 0) {
            triggered = true;
            message = `${requests.length} GDPR request(s) have been open for more than ${days} days without resolution. UK GDPR requires response within 30 days.`;
          } else {
            message = `All GDPR requests are within the ${days}-day threshold.`;
          }
          break;
        }

        case 'hazard_open_critical': {
          const { data: hazards } = await supabase
            .from('hazard_log')
            .select('id, hazard_ref, hazard_description, risk_level')
            .eq('status', 'open')
            .in('risk_level', ['critical', 'high']);

          if (hazards && hazards.length > 0) {
            triggered = true;
            const refs = hazards.map((h: { hazard_ref: string; risk_level: string }) => `${h.hazard_ref} (${h.risk_level})`).join(', ');
            message = `${hazards.length} critical/high hazard(s) remain open and unmitigated: ${refs}`;
          } else {
            message = 'No critical or high hazards are currently open.';
          }
          break;
        }

        case 'at_risk_users': {
          const threshold = rule.threshold_count ?? 5;
          const cutoff14 = new Date(now.getTime() - 14 * 86400_000).toISOString();
          // Users who have practised at least once but not in the last 14 days
          const { data: historicalUsers } = await supabase
            .from('practice_sessions')
            .select('user_id');

          const { data: recentSessions } = await supabase
            .from('practice_sessions')
            .select('user_id')
            .gte('created_at', cutoff14);

          if (historicalUsers) {
            const everActive = new Set(historicalUsers.map((s: { user_id: string }) => s.user_id));
            const recentSet = new Set((recentSessions ?? []).map((s: { user_id: string }) => s.user_id));
            const atRisk = [...everActive].filter(id => !recentSet.has(id));
            if (atRisk.length > threshold) {
              triggered = true;
              message = `${atRisk.length} previously-active users haven't practised in 14+ days (threshold: ${threshold}).`;
            } else {
              message = `At-risk user count (${atRisk.length}) is within the acceptable threshold of ${threshold}.`;
            }
          } else {
            message = 'Could not retrieve session data.';
          }
          break;
        }

        case 'no_new_signups': {
          const days = rule.threshold_days ?? 7;
          const cutoff = new Date(now.getTime() - days * 86400_000).toISOString();
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', cutoff);

          if ((count ?? 0) === 0) {
            triggered = true;
            message = `No new user signups in the last ${days} days. Review acquisition channels.`;
          } else {
            message = `${count} new signup(s) in the last ${days} days.`;
          }
          break;
        }

        case 'mrr_drop':
        case 'user_retention_drop': {
          message = 'Insufficient historical data — this check requires at least 2 months of MRR data.';
          break;
        }

        default:
          message = 'Unknown rule type — skipped.';
      }
    } catch (err) {
      message = `Check failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    // Record history
    let sent = false;
    let emailError: string | null = null;

    if (triggered) {
      triggeredCount++;
      sent = await sendAlertEmail(rule.recipient_email, rule.name, message);
      if (!sent) emailError = 'Email delivery failed';
    }

    try {
      await supabase.from('alert_history').insert({
        rule_id: rule.id,
        message,
        sent,
        error: emailError,
        triggered_at: now.toISOString(),
      });
    } catch { /* non-fatal */ }

    // Update rule timestamps
    const updatePayload: Record<string, string> = { last_checked_at: now.toISOString() };
    if (triggered) updatePayload.last_triggered_at = now.toISOString();

    try {
      await supabase.from('alert_rules').update(updatePayload).eq('id', rule.id);
    } catch { /* non-fatal */ }

    results.push({ rule_name: rule.name, triggered, message });
  }

  return { checked: rules.length, triggered: triggeredCount, results };
}

// ── Seed defaults ─────────────────────────────────────────────────────────────

const DEFAULT_RECIPIENT = 'flowenspeech@outlook.com';

const DEFAULT_RULES = [
  {
    name: 'Grant Deadline Warning (7 days)',
    rule_type: 'grant_deadline',
    threshold_days: 7,
    recipient_email: DEFAULT_RECIPIENT,
  },
  {
    name: 'GDPR Request Approaching Limit',
    rule_type: 'gdpr_overdue',
    threshold_days: 25,
    recipient_email: DEFAULT_RECIPIENT,
  },
  {
    name: 'Critical Hazard Unmitigated',
    rule_type: 'hazard_open_critical',
    recipient_email: DEFAULT_RECIPIENT,
  },
  {
    name: 'At-Risk Users Spike',
    rule_type: 'at_risk_users',
    threshold_count: 5,
    recipient_email: DEFAULT_RECIPIENT,
  },
  {
    name: 'No New Signups (7 days)',
    rule_type: 'no_new_signups',
    threshold_days: 7,
    recipient_email: DEFAULT_RECIPIENT,
  },
];

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();

  const [rulesRes, historyRes] = await Promise.all([
    supabase.from('alert_rules').select('*').order('created_at', { ascending: true }),
    supabase
      .from('alert_history')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(20),
  ]);

  const rules = (rulesRes.data ?? []) as AlertRule[];
  const allHistory = (historyRes.data ?? []) as AlertHistoryEntry[];

  // Attach last 3 history entries per rule
  const historyByRule: Record<string, AlertHistoryEntry[]> = {};
  for (const h of allHistory) {
    if (!historyByRule[h.rule_id]) historyByRule[h.rule_id] = [];
    if (historyByRule[h.rule_id].length < 3) historyByRule[h.rule_id].push(h);
  }

  const enriched = rules.map((r) => ({ ...r, history: historyByRule[r.id] ?? [] }));

  return NextResponse.json({ rules: enriched, history: allHistory });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action: string; [k: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = db();
  const { action } = body;

  // ── add ──────────────────────────────────────────────────────────────────────
  if (action === 'add') {
    const { name, rule_type, recipient_email, threshold_days, threshold_count, threshold_pct } = body as Record<string, unknown>;
    if (!name || !rule_type || !recipient_email) {
      return NextResponse.json({ error: 'name, rule_type, and recipient_email are required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('alert_rules')
      .insert({
        name,
        rule_type,
        recipient_email,
        threshold_days: threshold_days ?? null,
        threshold_count: threshold_count ?? null,
        threshold_pct: threshold_pct ?? null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rule: data });
  }

  // ── update ───────────────────────────────────────────────────────────────────
  if (action === 'update') {
    const { id, name, rule_type, recipient_email, threshold_days, threshold_count, threshold_pct, enabled } = body as Record<string, unknown>;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { data, error } = await supabase
      .from('alert_rules')
      .update({ name, rule_type, recipient_email, threshold_days, threshold_count, threshold_pct, enabled })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rule: data });
  }

  // ── delete ───────────────────────────────────────────────────────────────────
  if (action === 'delete') {
    const { id } = body as unknown as { id: string };
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabase.from('alert_rules').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── toggle ───────────────────────────────────────────────────────────────────
  if (action === 'toggle') {
    const { id } = body as unknown as { id: string };
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { data: existing } = await supabase
      .from('alert_rules')
      .select('enabled')
      .eq('id', id)
      .single();
    if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    const { data, error } = await supabase
      .from('alert_rules')
      .update({ enabled: !existing.enabled })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rule: data });
  }

  // ── check_now ────────────────────────────────────────────────────────────────
  if (action === 'check_now') {
    const results = await runChecks();
    return NextResponse.json(results);
  }

  // ── seed ─────────────────────────────────────────────────────────────────────
  if (action === 'seed') {
    const { count } = await supabase
      .from('alert_rules')
      .select('*', { count: 'exact', head: true });
    if ((count ?? 0) < 2) {
      const { data, error } = await supabase.from('alert_rules').insert(DEFAULT_RULES).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ seeded: data?.length ?? 0 });
    }
    return NextResponse.json({ seeded: 0, message: 'Already has rules' });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

// Export runChecks for the cron route
export { runChecks };
