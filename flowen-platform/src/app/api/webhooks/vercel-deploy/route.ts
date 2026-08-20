/**
 * POST /api/webhooks/vercel-deploy
 *
 * Receives Vercel deployment webhook events and:
 *   1. Always sends an admin deploy-summary email to hello@flowen.digital
 *   2. For commits containing feat: items, auto-sends a product update to
 *      active subscribers via the existing sendProductUpdate flow.
 *
 * Required env vars:
 *   VERCEL_WEBHOOK_SECRET — set in Vercel dashboard when creating the webhook
 *
 * Register webhook at:
 *   Vercel → Project Settings → Webhooks
 *   URL:    https://www.flowen.digital/api/webhooks/vercel-deploy
 *   Events: deployment.succeeded
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import crypto                         from 'crypto';
import { adminDb }                    from '@/lib/supabase/admin';
import {
  sendEmail, FROM, ADMIN_INBOX,
  sendProductUpdate,
  type ChangelogItem, type ChangelogRelease,
} from '@/lib/email';

// ── Vercel webhook signature verification ──────────────────────────────────────

function verifySignature(secret: string, rawBody: string, sig: string): boolean {
  try {
    const expected = crypto
      .createHmac('sha1', secret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(sig,      'hex'),
    );
  } catch {
    return false;
  }
}

// ── Conventional-commit parser ─────────────────────────────────────────────────
// Parses lines like: feat: title, feat(scope): title, fix!: title
// Returns null for types we don't surface (chore, temp, ci, docs, refactor).

const TYPE_MAP: Record<string, ChangelogItem['type'] | null> = {
  feat:     'new',
  feature:  'new',
  fix:      'fixed',
  bugfix:   'fixed',
  perf:     'improved',
  improve:  'improved',
  improved: 'improved',
  security: 'security',
  sec:      'security',
  policy:   'policy',
  // Internal — admin email only, no user broadcast
  chore:    null,
  temp:     null,
  ci:       null,
  docs:     null,
  refactor: null,
  revert:   null,
  test:     null,
  build:    null,
  style:    null,
};

const CC_RE = /^(\w+)(?:\([^)]*\))?!?:\s+(.+)$/;

interface ParsedCommit {
  type:     ChangelogItem['type'] | null; // null = internal only
  rawType:  string;
  title:    string;
  body:     string;
  breaking: boolean;
}

function parseCommitMessage(msg: string): ParsedCommit[] {
  const lines   = msg.trim().split('\n');
  const subject = lines[0].trim();
  const body    = lines.slice(2).join('\n').trim(); // skip blank line after subject

  // Handle multi-feat commits (squash merges list multiple conventional lines)
  const results: ParsedCommit[] = [];
  const toCheck = [subject, ...lines.slice(1).filter(l => CC_RE.test(l.trim()))];

  for (const line of toCheck) {
    const m = CC_RE.exec(line.trim());
    if (!m) {
      // First line with no CC prefix → treat whole message as a 'feat' if it
      // looks like a feature description, else 'chore'
      if (line === subject) {
        results.push({ type: null, rawType: 'chore', title: subject, body, breaking: false });
      }
      continue;
    }
    const rawType = m[1].toLowerCase();
    const title   = m[2].trim();
    const type    = TYPE_MAP[rawType] ?? null;
    const breaking = line.includes('!');
    results.push({ type, rawType, title, body, breaking });
  }

  return results.length > 0 ? results : [{ type: null, rawType: 'chore', title: subject, body, breaking: false }];
}

// ── Admin deploy email ─────────────────────────────────────────────────────────

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;

function buildAdminDeployHtml(opts: {
  deploymentId: string;
  url:          string;
  commitSha:    string;
  commitMsg:    string;
  branch:       string;
  author:       string;
  buildSecs:    number;
  region:       string;
  parsed:       ParsedCommit[];
}): string {
  const sha7 = opts.commitSha.slice(0, 7);
  const now  = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short',
  }) + ' (London)';

  const typeIcon: Record<string, string> = {
    new: '✨', fixed: '🐛', improved: '⚡', security: '🔒', policy: '📋',
  };

  const changeList = opts.parsed
    .filter(p => p.type !== null)
    .map(p => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #141c28;vertical-align:top;width:28px;">
          <span style="font-size:13px;">${typeIcon[p.type!] ?? '·'}</span>
        </td>
        <td style="padding:10px 0 10px 12px;border-bottom:1px solid #141c28;vertical-align:top;">
          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#c8d4e3;font-family:${FONT};">${escHtml(p.title)}</p>
          ${p.rawType ? `<span style="font-size:10px;color:#475d7a;font-family:${FONT};text-transform:uppercase;letter-spacing:0.8px;">${p.rawType}</span>` : ''}
        </td>
      </tr>`)
    .join('');

  const internalOnly = opts.parsed.every(p => p.type === null);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="color-scheme" content="dark"><title>Deploy: ${sha7}</title></head>
<body style="margin:0;padding:0;background:#070a0f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#070a0f" style="background:#070a0f;">
  <tr><td align="center" style="padding:40px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;">

      <!-- Logo line -->
      <tr><td style="padding:0 0 20px;">
        <span style="font-size:18px;font-weight:900;color:#f0f4f8;letter-spacing:-0.7px;font-family:${FONT};">FLOWEN</span>
        <span style="font-size:11px;color:#475d7a;font-family:${FONT};margin-left:10px;">Deploy</span>
      </td></tr>

      <!-- Card -->
      <tr><td bgcolor="#0c1018" style="background:#0c1018;border-radius:10px;border:1px solid #141c28;">

        <!-- Accent line (green = success) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td height="3" bgcolor="#10b981" style="background:#10b981;border-radius:9px 9px 0 0;font-size:3px;line-height:3px;">&nbsp;</td></tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:32px 40px 40px;">

            <!-- Eyebrow -->
            <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#10b981;letter-spacing:1.6px;text-transform:uppercase;font-family:${FONT};">
              ${internalOnly ? 'Internal' : 'Production'} Deploy · ${sha7}
            </p>

            <!-- Subject -->
            <h1 style="margin:0 0 24px;font-size:20px;font-weight:800;color:#edf1f7;letter-spacing:-0.4px;line-height:1.3;font-family:${FONT};">
              ${escHtml(opts.parsed[0]?.title ?? opts.commitMsg.split('\n')[0])}
            </h1>

            <!-- Meta table -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-collapse:collapse;">
              ${[
                ['Branch',     opts.branch],
                ['Commit',     sha7],
                ['Author',     opts.author],
                ['Build time', `${opts.buildSecs}s`],
                ['Region',     opts.region],
                ['Deployed',   now],
              ].map(([k, v], i, arr) => `
                <tr>
                  <td style="padding:10px 0;font-size:11px;font-weight:700;color:#475d7a;text-transform:uppercase;letter-spacing:0.9px;white-space:nowrap;padding-right:24px;border-bottom:${i < arr.length - 1 ? '1px solid #141c28' : 'none'};font-family:${FONT};">${k}</td>
                  <td style="padding:10px 0;font-size:13px;color:#c8d4e3;border-bottom:${i < arr.length - 1 ? '1px solid #141c28' : 'none'};font-family:${FONT};">${escHtml(String(v))}</td>
                </tr>`).join('')}
            </table>

            ${changeList ? `
              <!-- Changes -->
              <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#475d7a;text-transform:uppercase;letter-spacing:0.9px;font-family:${FONT};">Changes</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-collapse:collapse;">
                ${changeList}
              </table>` : ''}

            <!-- Full commit message (collapsed) -->
            <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#475d7a;text-transform:uppercase;letter-spacing:0.9px;font-family:${FONT};">Full commit</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
              <tr><td bgcolor="#070a0f" style="background:#070a0f;border-radius:6px;border:1px solid #141c28;padding:14px 18px;">
                <pre style="margin:0;font-size:12px;color:#475d7a;line-height:1.7;font-family:'SFMono-Regular',Consolas,monospace;white-space:pre-wrap;word-break:break-word;">${escHtml(opts.commitMsg.slice(0, 800))}</pre>
              </td></tr>
            </table>

            <!-- Button -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td bgcolor="#10b981" style="background:#10b981;border-radius:7px;">
                <a href="https://vercel.com/flowen-technologies-speech/flowen-app/${opts.deploymentId}" style="display:inline-block;padding:12px 26px;font-size:13px;font-weight:700;color:#07090f;text-decoration:none;font-family:${FONT};">View in Vercel →</a>
              </td></tr>
            </table>

          </td></tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:18px 4px 0;">
        <p style="margin:0;font-size:11px;color:#263548;font-family:${FONT};">
          Flowen Speech Technology Ltd · automated deploy alert · <a href="https://www.flowen.digital/admin" style="color:#263548;text-decoration:none;">Admin</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Webhook handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Read raw body for signature verification
  const rawBody = await req.text();

  // 2. Verify Vercel webhook signature
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[vercel-webhook] VERCEL_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const sig = req.headers.get('x-vercel-signature') ?? '';
  if (!verifySignature(secret, rawBody, sig)) {
    console.warn('[vercel-webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 3. Parse event
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 4. Only handle deployment.succeeded on production
  if (event.type !== 'deployment.succeeded') {
    return NextResponse.json({ skipped: true, reason: 'not deployment.succeeded' });
  }

  const payload    = event.payload as Record<string, unknown> | undefined;
  const deployment = payload?.deployment as Record<string, unknown> | undefined;
  const target     = (payload?.target as string | undefined) ??
                     (deployment?.target as string | undefined);

  if (target !== 'production') {
    return NextResponse.json({ skipped: true, reason: 'not production target' });
  }

  // 5. Extract deployment details
  const deploymentId = String(deployment?.id ?? '');
  const meta = (deployment?.meta ?? {}) as Record<string, string>;
  const commitMsg    = meta.githubCommitMessage ?? '';
  const commitSha    = meta.githubCommitSha     ?? '';
  const branch       = meta.githubCommitRef     ?? 'main';
  const author       = meta.githubCommitAuthorName ?? 'unknown';
  const deployUrl    = String(deployment?.url ?? '');

  const buildingAt   = Number(deployment?.buildingAt ?? 0);
  const readyAt      = Number(deployment?.readyAt    ?? Date.now());
  const buildSecs    = buildingAt ? Math.round((readyAt - buildingAt) / 1000) : 0;
  const region       = Array.isArray(deployment?.regions)
    ? (deployment!.regions as string[]).join(', ')
    : 'lhr1';

  if (!deploymentId) {
    return NextResponse.json({ error: 'Missing deployment ID' }, { status: 400 });
  }

  // 6. Idempotency — skip if already processed (uses deploy_log, not notification_log)
  const db = adminDb();
  const { data: existing } = await db
    .from('deploy_log')
    .select('id')
    .eq('deployment_id', deploymentId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ skipped: true, reason: 'already processed', deploymentId });
  }

  // 7. Parse commit message
  const parsed = parseCommitMessage(commitMsg);

  // 8. Send admin deploy email
  const html = buildAdminDeployHtml({
    deploymentId, url: deployUrl, commitSha, commitMsg, branch,
    author, buildSecs, region, parsed,
  });

  const sha7 = commitSha.slice(0, 7);
  const subject = `[Deploy] ${parsed[0]?.title ?? commitMsg.split('\n')[0]} · ${sha7}`;

  await sendEmail({
    from:    FROM.alerts,
    to:      ADMIN_INBOX,
    subject,
    html,
    text: `Production deploy succeeded.\n\nCommit: ${sha7}\nBranch: ${branch}\nAuthor: ${author}\nBuild:  ${buildSecs}s\n\n${commitMsg}\n\nhttps://vercel.com/flowen-technologies-speech/flowen-app/${deploymentId}`,
    tags: [{ name: 'type', value: 'deploy_alert' }],
  });

  // 10. Auto-send product update to subscribers if there are user-facing feat: items
  const featItems = parsed.filter(p => p.type !== null);

  // 9. Record in deploy_log (idempotency + history; no user_id required)
  await db.from('deploy_log').insert({
    deployment_id: deploymentId,
    commit_sha:    commitSha,
    branch,
    build_secs:    buildSecs,
    feat_items:    featItems.length,
    // users_emailed updated below after sending
  });
  let updateSent = false;

  if (featItems.length > 0) {
    const today = new Date().toISOString().slice(0, 10);

    const release: ChangelogRelease = {
      version: sha7,
      date:    today,
      summary: parsed[0]?.title ?? commitMsg.split('\n')[0],
      items:   featItems.map(p => ({
        type:        p.type!,
        title:       p.title,
        description: p.body.split('\n').filter(Boolean)[0] ?? p.title,
      })),
    };

    // Send to active subscribers in batches of 20
    const { data: subs } = await db
      .from('subscriptions')
      .select('user_id')
      .in('status', ['active', 'trialing']);

    const subIds = (subs ?? []).map((s: { user_id: string }) => s.user_id);

    if (subIds.length > 0) {
      const { data: profiles } = await db
        .from('profiles')
        .select('id, email')
        .in('id', subIds)
        .not('email', 'is', null);

      const recipients = (profiles ?? []) as Array<{ id: string; email: string }>;
      const BATCH = 20;

      for (let i = 0; i < recipients.length; i += BATCH) {
        const batch  = recipients.slice(i, i + BATCH);
        const emails = batch.map(p => p.email);
        const ok     = await sendProductUpdate({ to: emails, release });

        if (ok) {
          await db.from('notification_log').insert(
            batch.map(p => ({
              user_id:  p.id,
              type:     'product_update',
              metadata: { version: sha7, audience: 'subscribers', deployment_id: deploymentId },
            })),
          );
        }
      }
      updateSent = recipients.length > 0;

      // Update deploy_log with how many users were emailed
      if (recipients.length > 0) {
        await db.from('deploy_log')
          .update({ users_emailed: recipients.length })
          .eq('deployment_id', deploymentId);
      }
    }
  }

  return NextResponse.json({
    ok:           true,
    deploymentId,
    commitSha:    sha7,
    adminAlerted: true,
    updateSent,
    featItems:    featItems.length,
  });
}
