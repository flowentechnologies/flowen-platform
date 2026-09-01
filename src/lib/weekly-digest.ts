import { sendEmail, FROM } from '@/lib/email';
import { adminDb as db } from '@/lib/supabase/admin';

function sendDigestEmail(to: string, subject: string, html: string): Promise<boolean> {
  return sendEmail({ from: FROM.hello, to, subject, html });
}

function emailBase(content: string): string {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;max-width:100%;">
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #334155;">
          <span style="font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:-0.5px;">flowen</span>
          <span style="margin-left:10px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#475569;font-weight:600;">Weekly digest</span>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          ${content}
          <a href="${SITE}/dashboard/practice" style="display:inline-block;margin-top:28px;background:#10b981;color:#0f172a;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;">Open practice →</a>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #334155;background:#0f172a;">
          <p style="margin:0;font-size:11px;color:#64748b;">Flowen Speech Technology Ltd &bull; <a href="${SITE}/dashboard/settings" style="color:#64748b;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function statCell(value: string, label: string, color: string): string {
  return `<td style="padding:16px 20px;text-align:center;border-right:1px solid #334155;">
    <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:${color};">${value}</p>
    <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${label}</p>
  </td>`;
}

function digestEmail(
  name: string,
  sessionsThisWeek: number,
  sessionsLastWeek: number,
  streak: number,
  bpmThisWeek: number | null,
  bpmLastWeek: number | null,
  weeklyGoal: number | null,
): string {
  const goalHit  = weeklyGoal !== null && sessionsThisWeek >= weeklyGoal;
  const bpmDelta = bpmThisWeek !== null && bpmLastWeek !== null ? bpmLastWeek - bpmThisWeek : null; // positive = improved
  const emoji    = goalHit ? '🎯' : streak >= 7 ? '🔥' : sessionsThisWeek > 0 ? '✅' : '👋';
  const heading  = goalHit
    ? `${emoji} Goal hit — ${sessionsThisWeek} sessions this week`
    : sessionsThisWeek > 0
    ? `${emoji} ${sessionsThisWeek} session${sessionsThisWeek > 1 ? 's' : ''} this week`
    : `${emoji} Time to practise this week`;

  const trendVsLast = sessionsThisWeek > sessionsLastWeek
    ? `↑ ${sessionsThisWeek - sessionsLastWeek} more than last week`
    : sessionsThisWeek < sessionsLastWeek
    ? `↓ ${sessionsLastWeek - sessionsThisWeek} fewer than last week`
    : sessionsLastWeek > 0 ? 'Same as last week' : '';

  const bpmStr = bpmThisWeek !== null ? bpmThisWeek.toFixed(1) : '—';
  const bpmColor = bpmDelta !== null && bpmDelta > 0.1 ? '#10b981'
    : bpmDelta !== null && bpmDelta < -0.1 ? '#f87171' : '#f8fafc';

  return emailBase(`
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f8fafc;">Hi ${name},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.65;">${heading}</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <tr>
        ${statCell(String(sessionsThisWeek), 'Sessions', '#10b981')}
        ${statCell(streak > 0 ? `${streak}🔥` : '—', 'Day streak', '#f59e0b')}
        <td style="padding:16px 20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:${bpmColor};">${bpmStr}</p>
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Avg BPM</p>
        </td>
      </tr>
    </table>

    ${trendVsLast ? `<p style="margin:0 0 12px;font-size:13px;color:#64748b;">${trendVsLast}${bpmDelta !== null && bpmDelta > 0.1 ? ` · BPM down ${bpmDelta.toFixed(1)} — improving ↓` : ''}</p>` : ''}

    <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.65;">
      ${sessionsThisWeek === 0
        ? 'No sessions yet this week. Even one 5-minute session keeps your technique fresh — and your streak alive.'
        : goalHit
        ? `You hit your weekly target. Keep practising to build on this week\'s momentum.`
        : `You\'re building it. Consistent practice — even short sessions — is what drives lasting improvement.`}
    </p>`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStreak(sessions: { created_at: string }[]): number {
  if (!sessions.length) return 0;
  const days = [...new Set(sessions.map(s => s.created_at.slice(0, 10)))].sort().reverse();
  let streak = 0;
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  for (const day of days) {
    const d = new Date(day);
    if (Math.round((cursor.getTime() - d.getTime()) / 86400_000) > 1) break;
    streak++; cursor = d;
  }
  return streak;
}

function avgBpm(sessions: { total_blocks_detected: number; duration_seconds: number }[]): number | null {
  const valid = sessions.filter(s => s.duration_seconds > 0);
  if (!valid.length) return null;
  const total = valid.reduce((sum, s) => sum + s.total_blocks_detected / (s.duration_seconds / 60), 0);
  return Math.round((total / valid.length) * 10) / 10;
}

async function wasRecentlySent(
  admin: ReturnType<typeof db>,
  userId: string,
  type: string,
  withinDays: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinDays * 86400_000).toISOString();
  const { data } = await admin.from('notification_log').select('id')
    .eq('user_id', userId).eq('type', type).gte('sent_at', cutoff).limit(1);
  return (data?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function sendWeeklyDigests(): Promise<{ sent: number; skipped: number }> {
  const admin = db();
  const now   = new Date();

  const thisWeekStart = new Date(now.getTime() - 7  * 86400_000).toISOString();
  const lastWeekStart = new Date(now.getTime() - 14 * 86400_000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000).toISOString();

  // All onboarded users with email reminders on who have practised in the last 30 days
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name, email, email_reminders')
    .eq('onboarding_complete', true)
    .eq('email_reminders', true)
    .not('email', 'is', null);

  if (!profiles?.length) return { sent: 0, skipped: 0 };

  const userIds = profiles.map(p => p.id);

  const [sessionsRes, plansRes] = await Promise.all([
    admin.from('practice_sessions')
      .select('user_id, created_at, total_blocks_detected, duration_seconds')
      .in('user_id', userIds)
      .gte('created_at', lastWeekStart)
      .order('created_at', { ascending: false }),
    admin.from('treatment_plans')
      .select('patient_user_id, sessions_per_week')
      .in('patient_user_id', userIds)
      .eq('active', true),
  ]);

  const allSessions = sessionsRes.data ?? [];

  // Check who has practised at all in last 30 days (to avoid emailing ghosts)
  const { data: activeSessions } = await admin.from('practice_sessions')
    .select('user_id')
    .in('user_id', userIds)
    .gte('created_at', thirtyDaysAgo)
    .limit(1000);
  const activeUserIds = new Set((activeSessions ?? []).map(s => s.user_id));

  const sessionsByUser = new Map<string, typeof allSessions>();
  for (const s of allSessions) {
    if (!sessionsByUser.has(s.user_id)) sessionsByUser.set(s.user_id, []);
    sessionsByUser.get(s.user_id)!.push(s);
  }
  const planByUser = new Map((plansRes.data ?? []).map(p => [p.patient_user_id, p.sessions_per_week as number]));

  let sent = 0; let skipped = 0;

  for (const profile of profiles) {
    // Only send to users who have practised at least once in the last 30 days
    if (!activeUserIds.has(profile.id)) { skipped++; continue; }

    const alreadySent = await wasRecentlySent(admin, profile.id, 'weekly_digest', 5);
    if (alreadySent) { skipped++; continue; }

    const name    = profile.display_name ?? profile.email!.split('@')[0];
    const email   = profile.email!;
    const sessions = sessionsByUser.get(profile.id) ?? [];

    const thisWeek = sessions.filter(s => s.created_at >= thisWeekStart);
    const lastWeek = sessions.filter(s => s.created_at >= lastWeekStart && s.created_at < thisWeekStart);

    const sessionsThisWeek = thisWeek.length;
    const sessionsLastWeek = lastWeek.length;
    const streak           = computeStreak(sessions);
    const bpmThisWeek      = avgBpm(thisWeek);
    const bpmLastWeek      = avgBpm(lastWeek);
    const weeklyGoal       = planByUser.get(profile.id) ?? null;

    const subjectSessions  = sessionsThisWeek > 0
      ? `${sessionsThisWeek} session${sessionsThisWeek > 1 ? 's' : ''} this week`
      : 'Your Flowen week';
    const goalPrefix = weeklyGoal !== null && sessionsThisWeek >= weeklyGoal ? '🎯 Goal hit · ' : '';
    const subject    = `${goalPrefix}${subjectSessions} — Flowen weekly digest`;

    const ok = await sendDigestEmail(
      email,
      subject,
      digestEmail(name, sessionsThisWeek, sessionsLastWeek, streak, bpmThisWeek, bpmLastWeek, weeklyGoal),
    );

    if (ok) {
      sent++;
      await admin.from('notification_log').insert({
        user_id:  profile.id,
        type:     'weekly_digest',
        metadata: { sessions_this_week: sessionsThisWeek, streak },
      });
    }
  }

  return { sent, skipped };
}
