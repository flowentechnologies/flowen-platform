import { sendEmail, FROM } from '@/lib/email';
import { adminDb as db } from '@/lib/supabase/admin';

function sendTrialEmail(to: string, subject: string, html: string): Promise<boolean> {
  return sendEmail({ from: FROM.hello, to, subject, html });
}

// ---------------------------------------------------------------------------
// Shared layout (matches practice-reminders style)
// ---------------------------------------------------------------------------

function emailBase(content: string, ctaHref?: string, ctaLabel?: string): string {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';
  const cta = ctaHref
    ? `<a href="${ctaHref}" style="display:inline-block;margin-top:28px;background:#10b981;color:#0f172a;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;">${ctaLabel ?? 'Open Flowen →'}</a>`
    : '';
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
          ${cta}
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #334155;background:#0f172a;">
          <p style="margin:0;font-size:11px;color:#64748b;">Flowen Speech Technology Ltd &bull; <a href="${SITE}/dashboard/settings" style="color:#64748b;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function welcomeEmail(name: string): string {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';
  return emailBase(`
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f8fafc;">Hi ${name} — you're in.</p>
    <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.65;">
      Your first session takes about 3 minutes and generates your baseline speech data. That number — your block-per-minute rate — is what every session after this works to improve.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:4px;">
      ${[
        ['1', 'Open practice', 'Go to your practice page and pick any stage.'],
        ['2', 'Speak naturally', 'The AI listens in real time — no setup needed.'],
        ['3', 'See your baseline', 'Your first BPM reading appears at the end of the session.'],
      ].map(([num, title, body]) => `
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:36px;">
          <div style="width:28px;height:28px;border-radius:50%;background:#10b981;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#0f172a;text-align:center;line-height:28px;">${num}</div>
        </td>
        <td style="padding:10px 0 10px 12px;vertical-align:top;border-bottom:1px solid #1e3a5f;">
          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#f1f5f9;">${title}</p>
          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.55;">${body}</p>
        </td>
      </tr>`).join('')}
    </table>`,
    `${SITE}/dashboard/practice`,
    'Start your first session →',
  );
}

function day3Email(name: string, sessionCount: number, bpm: number | null, streak: number): string {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';

  if (sessionCount === 0) {
    return emailBase(`
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f8fafc;">Hi ${name},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.65;">
        You signed up 3 days ago but haven't done your first session yet — and that's completely normal. The first one always feels like the biggest step.
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.65;">
        Here's what it actually looks like: you speak for about 3 minutes, the AI tracks your disfluency events in real time, and at the end you see your baseline block-per-minute reading. That's it. No judgement, no grades — just data.
      </p>
      <p style="margin:0;font-size:14px;color:#64748b;">You have ${7 - 3} days left on your free trial. Start today and you'll have real progress data before it ends.</p>`,
      `${SITE}/dashboard/practice`,
      'Do your first session →',
    );
  }

  const streakStr = streak >= 2 ? ` · ${streak}-day streak 🔥` : '';
  return emailBase(`
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f8fafc;">Hi ${name},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.65;">
      3 days in — here's where you stand:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <tr>
        <td style="padding:16px 20px;border-right:1px solid #334155;text-align:center;">
          <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#10b981;">${sessionCount}</p>
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Sessions done</p>
        </td>
        ${bpm !== null ? `<td style="padding:16px 20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#f8fafc;">${bpm.toFixed(1)}</p>
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Latest BPM</p>
        </td>` : ''}
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:#64748b;line-height:1.65;">
      ${sessionCount === 1 ? 'Your baseline is set. Every session from here shows how you\'re improving.' : `You're building the habit${streakStr}. Consistent daily practice is the biggest driver of improvement — you're doing it right.`}
    </p>`,
    `${SITE}/dashboard/practice`,
    'Keep the momentum going →',
  );
}

function day6Email(
  name: string,
  sessionCount: number,
  streak: number,
  bpmImprovement: number | null,
): string {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';
  const improved = bpmImprovement !== null && bpmImprovement > 0.1;

  return emailBase(`
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f8fafc;">Hi ${name},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.65;">
      Your trial ends <strong style="color:#f59e0b;">tomorrow</strong>. Here's what you've built in a week:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <tr>
        <td style="padding:16px 20px;border-right:1px solid #334155;text-align:center;">
          <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#10b981;">${sessionCount}</p>
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Sessions</p>
        </td>
        <td style="padding:16px 20px;${improved ? 'border-right:1px solid #334155;' : ''}text-align:center;">
          <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#f59e0b;">${streak > 0 ? `${streak}🔥` : '—'}</p>
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Day streak</p>
        </td>
        ${improved ? `<td style="padding:16px 20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#10b981;">↓${bpmImprovement!.toFixed(1)}</p>
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Fewer BPM</p>
        </td>` : ''}
      </tr>
    </table>
    <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.65;">
      ${sessionCount === 0
        ? "You haven't started yet — but you still have time. One session gives you your baseline. It takes 3 minutes."
        : `This is 6 days of practice. Imagine where you'll be in 6 weeks. Your progress is saved — it doesn't disappear if you don't continue, but it also doesn't grow.`}
    </p>
    <p style="margin:0;font-size:13px;color:#64748b;">Founding member rate: <strong style="color:#f1f5f9;">from £19.96/mo</strong> · Price locked for life · Cancel any time</p>`,
    `${SITE}/pricing`,
    'Continue with full access →',
  );
}

// ---------------------------------------------------------------------------
// Dedup helper
// ---------------------------------------------------------------------------

async function wasRecentlySent(
  admin: ReturnType<typeof db>,
  userId: string,
  type: string,
  withinDays: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinDays * 86400_000).toISOString();
  const { data } = await admin
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('sent_at', cutoff)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function sendTrialEmails(): Promise<{ sent: number; skipped: number }> {
  const admin = db();
  const now = new Date();

  // Window bounds (in ms from now) — wide enough that hourly cron never misses a window
  const h48  = 48  * 3600_000;
  const h72  = 72  * 3600_000;
  const h120 = 120 * 3600_000;
  const h144 = 144 * 3600_000;
  const h192 = 192 * 3600_000;

  // Fetch all recently-onboarded, non-founding users who opted into email
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name, email, email_reminders, tier, created_at')
    .eq('onboarding_complete', true)
    .neq('tier', 'founding')
    .eq('email_reminders', true)
    .not('email', 'is', null)
    // Only consider users who signed up in the last 10 days (day-6 window + safety margin)
    .gte('created_at', new Date(now.getTime() - 10 * 86400_000).toISOString());

  if (!profiles?.length) return { sent: 0, skipped: 0 };

  const userIds = profiles.map(p => p.id);

  // Batch-fetch sessions (last 10 days) and active subscriptions
  const [sessionsRes, subsRes] = await Promise.all([
    admin
      .from('practice_sessions')
      .select('user_id, created_at, total_blocks_detected, duration_seconds')
      .in('user_id', userIds)
      .gte('created_at', new Date(now.getTime() - 10 * 86400_000).toISOString())
      .order('created_at', { ascending: true }),
    admin
      .from('subscriptions')
      .select('user_id, status')
      .in('user_id', userIds)
      .in('status', ['active', 'trialing']),
  ]);

  // Index sessions by user
  const sessionsByUser = new Map<string, { created_at: string; total_blocks_detected: number; duration_seconds: number }[]>();
  for (const s of (sessionsRes.data ?? [])) {
    if (!sessionsByUser.has(s.user_id)) sessionsByUser.set(s.user_id, []);
    sessionsByUser.get(s.user_id)!.push(s);
  }

  // Users with an active/trialing subscription
  const activeSubs = new Set((subsRes.data ?? []).map(s => s.user_id));

  let sent = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const email    = profile.email!;
    const name     = profile.display_name ?? email.split('@')[0];
    const ageMs    = now.getTime() - new Date(profile.created_at).getTime();
    const sessions = sessionsByUser.get(profile.id) ?? [];

    // ── Welcome (0–48h after signup) ────────────────────────────────────────
    if (ageMs < h48) {
      const alreadySent = await wasRecentlySent(admin, profile.id, 'trial_welcome', 10);
      if (!alreadySent) {
        const ok = await sendTrialEmail(email, `You're in — here's where to start, ${name}`, welcomeEmail(name));
        if (ok) {
          sent++;
          await admin.from('notification_log').insert({ user_id: profile.id, type: 'trial_welcome', metadata: {} });
        }
      } else { skipped++; }
      continue;
    }

    // ── Day 3 check-in (72–120h after signup) ───────────────────────────────
    if (ageMs >= h72 && ageMs < h120) {
      const alreadySent = await wasRecentlySent(admin, profile.id, 'trial_day3', 10);
      if (!alreadySent) {
        const sessionCount = sessions.length;
        const lastSession  = sessions[sessions.length - 1] ?? null;
        const latestBpm    = lastSession && lastSession.duration_seconds > 0
          ? lastSession.total_blocks_detected / (lastSession.duration_seconds / 60)
          : null;
        // Streak
        const uniqueDays = [...new Set(sessions.map(s => s.created_at.slice(0, 10)))].sort().reverse();
        let streak = 0;
        let cur = new Date(); cur.setHours(0, 0, 0, 0);
        for (const day of uniqueDays) {
          const d = new Date(day);
          if (Math.round((cur.getTime() - d.getTime()) / 86400_000) > 1) break;
          streak++; cur = d;
        }
        const subject = sessionCount === 0
          ? `Still haven't started, ${name}? Here's why the first 3 minutes matter`
          : `3 days in — here's how you're doing, ${name}`;
        const ok = await sendTrialEmail(email, subject, day3Email(name, sessionCount, latestBpm, streak));
        if (ok) {
          sent++;
          await admin.from('notification_log').insert({ user_id: profile.id, type: 'trial_day3', metadata: { session_count: sessionCount } });
        }
      } else { skipped++; }
      continue;
    }

    // ── Day 6 / trial end (144–192h after signup, skip already-active subs) ─
    if (ageMs >= h144 && ageMs < h192 && !activeSubs.has(profile.id)) {
      const alreadySent = await wasRecentlySent(admin, profile.id, 'trial_day6', 10);
      if (!alreadySent) {
        const sessionCount = sessions.length;
        const firstSession = sessions[0] ?? null;
        const lastSession  = sessions[sessions.length - 1] ?? null;
        // BPM improvement
        let bpmImprovement: number | null = null;
        if (firstSession && lastSession && firstSession.created_at !== lastSession.created_at) {
          const firstBpm = firstSession.duration_seconds > 0
            ? firstSession.total_blocks_detected / (firstSession.duration_seconds / 60) : null;
          const lastBpm  = lastSession.duration_seconds > 0
            ? lastSession.total_blocks_detected  / (lastSession.duration_seconds  / 60) : null;
          if (firstBpm !== null && lastBpm !== null) bpmImprovement = firstBpm - lastBpm;
        }
        // Streak
        const uniqueDays = [...new Set(sessions.map(s => s.created_at.slice(0, 10)))].sort().reverse();
        let streak = 0;
        let cur = new Date(); cur.setHours(0, 0, 0, 0);
        for (const day of uniqueDays) {
          const d = new Date(day);
          if (Math.round((cur.getTime() - d.getTime()) / 86400_000) > 1) break;
          streak++; cur = d;
        }
        const ok = await sendTrialEmail(
          email,
          `Your Flowen trial ends tomorrow — here's what you've built`,
          day6Email(name, sessionCount, streak, bpmImprovement),
        );
        if (ok) {
          sent++;
          await admin.from('notification_log').insert({ user_id: profile.id, type: 'trial_day6', metadata: { session_count: sessionCount } });
        }
      } else { skipped++; }
      continue;
    }

    skipped++;
  }

  return { sent, skipped };
}
