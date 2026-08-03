import { createClient } from '@supabase/supabase-js';
import { sendEmail, FROM } from '@/lib/email';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function sendReminderEmail(to: string, subject: string, html: string): Promise<boolean> {
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
        </td></tr>
        <tr><td style="padding:32px 40px;">
          ${content}
          <a href="${SITE}/dashboard/practice" style="display:inline-block;margin-top:28px;background:#10b981;color:#0f172a;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;">Start practising →</a>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #334155;background:#0f172a;">
          <p style="margin:0;font-size:11px;color:#64748b;">Flowen Speech Technology Ltd &bull; <a href="${SITE}/dashboard/settings" style="color:#64748b;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function inactiveEmail(name: string, daysSince: number): string {
  return emailBase(`
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f8fafc;">Hi ${name},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.65;">
      It's been <strong style="color:#f8fafc;">${daysSince} days</strong> since your last practice session.
      Even a short 5-minute session keeps your fluency techniques fresh.
    </p>
    <p style="margin:0;font-size:14px;color:#64748b;line-height:1.65;">
      Your progress is saved — pick up exactly where you left off.
    </p>`);
}

function streakEmail(name: string, streak: number): string {
  const medal = streak >= 30 ? '🏆' : streak >= 14 ? '🥇' : streak >= 7 ? '🌟' : '🔥';
  return emailBase(`
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f8fafc;">Hi ${name},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.65;">
      ${medal} You've practised for <strong style="color:#10b981;">${streak} days in a row.</strong>
      Consistent daily practice is the single most effective way to build fluency — you're doing it right.
    </p>
    <p style="margin:0;font-size:14px;color:#64748b;">Keep the streak alive today.</p>`);
}

function goalEmail(name: string, sessionsPerWeek: number): string {
  return emailBase(`
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f8fafc;">Hi ${name},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.65;">
      ✅ You've hit your weekly goal of <strong style="color:#10b981;">${sessionsPerWeek} sessions</strong> — great work.
      Your clinician set this target to build the consistency that leads to lasting improvement.
    </p>
    <p style="margin:0;font-size:14px;color:#64748b;">Keep practising to build on this week's momentum.</p>`);
}

function computeStreak(sessions: { created_at: string }[]): number {
  if (!sessions.length) return 0;
  const days = [...new Set(sessions.map(s => s.created_at.slice(0, 10)))].sort().reverse();
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const day of days) {
    const d = new Date(day);
    const diff = Math.round((cursor.getTime() - d.getTime()) / 86400_000);
    if (diff > 1) break;
    streak++;
    cursor = d;
  }
  return streak;
}

async function wasRecentlySent(admin: ReturnType<typeof db>, userId: string, type: string, withinDays: number): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinDays * 86400_000).toISOString();
  const { data } = await admin.from('notification_log').select('id').eq('user_id', userId).eq('type', type).gte('sent_at', cutoff).limit(1);
  return (data?.length ?? 0) > 0;
}

export async function sendPracticeReminders(): Promise<{ sent: number; skipped: number }> {
  const admin = db();
  const now = new Date();
  const sevenDaysAgo   = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const thirtyDaysAgo  = new Date(now.getTime() - 30 * 86400_000).toISOString();
  const weekStart      = new Date(now.getTime() - 7 * 86400_000).toISOString();

  const currentHour = now.getUTCHours();
  const DEFAULT_REMINDER_HOUR = 9;

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name, email, email_reminders, streak_notifications, reminder_hour')
    .eq('onboarding_complete', true)
    .not('email', 'is', null)
    .or(
      currentHour === DEFAULT_REMINDER_HOUR
        ? `reminder_hour.eq.${currentHour},reminder_hour.is.null`
        : `reminder_hour.eq.${currentHour}`,
    );

  if (!profiles?.length) return { sent: 0, skipped: 0 };

  const userIds = profiles.map(p => p.id);

  const [sessionsRes, plansRes] = await Promise.all([
    admin.from('practice_sessions')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false }),
    admin.from('treatment_plans')
      .select('patient_user_id, sessions_per_week')
      .in('patient_user_id', userIds)
      .eq('active', true),
  ]);

  const sessionsByUser = new Map<string, { created_at: string }[]>();
  for (const s of (sessionsRes.data ?? [])) {
    if (!sessionsByUser.has(s.user_id)) sessionsByUser.set(s.user_id, []);
    sessionsByUser.get(s.user_id)!.push({ created_at: s.created_at });
  }
  const planByUser = new Map((plansRes.data ?? []).map(p => [p.patient_user_id, p.sessions_per_week as number]));

  let sent = 0; let skipped = 0;

  for (const profile of profiles) {
    const name     = profile.display_name ?? profile.email!.split('@')[0];
    const email    = profile.email!;
    const sessions = sessionsByUser.get(profile.id) ?? [];
    const lastSession = sessions[0];

    // ── Inactive reminder ─────────────────────────────────────────────────────
    if (profile.email_reminders === false) { skipped++; continue; }
    if (!lastSession || new Date(lastSession.created_at) < new Date(now.getTime() - 3 * 86400_000)) {
      const daysSince = lastSession
        ? Math.floor((now.getTime() - new Date(lastSession.created_at).getTime()) / 86400_000)
        : 999;
      if (daysSince >= 3) {
        const alreadySent = await wasRecentlySent(admin, profile.id, 'practice_inactive', 3);
        if (!alreadySent) {
          const ok = await sendReminderEmail(email, 'Time to practise your speech', inactiveEmail(name, daysSince));
          if (ok) {
            sent++;
            await admin.from('notification_log').insert({ user_id: profile.id, type: 'practice_inactive', metadata: { days_since: daysSince } });
          }
          continue;
        }
      }
      skipped++;
      continue;
    }

    // ── Streak milestone ──────────────────────────────────────────────────────
    const streak = computeStreak(sessions);
    if ([3, 7, 14, 30].includes(streak) && profile.streak_notifications !== false) {
      const alreadySent = await wasRecentlySent(admin, profile.id, `streak_${streak}`, 2);
      if (!alreadySent) {
        const ok = await sendReminderEmail(email, `${streak}-day streak — keep it up!`, streakEmail(name, streak));
        if (ok) {
          sent++;
          await admin.from('notification_log').insert({ user_id: profile.id, type: `streak_${streak}`, metadata: { streak } });
        }
        continue;
      }
    }

    // ── Weekly goal achievement ───────────────────────────────────────────────
    const sessionsPerWeek = planByUser.get(profile.id);
    if (sessionsPerWeek) {
      const sessionsThisWeek = sessions.filter(s => s.created_at >= weekStart).length;
      if (sessionsThisWeek === sessionsPerWeek) {
        const alreadySent = await wasRecentlySent(admin, profile.id, 'weekly_goal', 7);
        if (!alreadySent) {
          const ok = await sendReminderEmail(email, 'Weekly practice goal achieved! 🎯', goalEmail(name, sessionsPerWeek));
          if (ok) {
            sent++;
            await admin.from('notification_log').insert({ user_id: profile.id, type: 'weekly_goal', metadata: { sessions_per_week: sessionsPerWeek } });
          }
          continue;
        }
      }
    }

    skipped++;
  }

  return { sent, skipped };
}
