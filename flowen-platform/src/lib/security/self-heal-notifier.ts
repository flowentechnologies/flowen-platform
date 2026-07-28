// Slack Block Kit notification dispatcher for autonomous self-healing events
// and Kubernetes autoscaler threshold alerts.
//
// All functions are fire-and-forget async — callers should not await them on
// the hot path. Errors are swallowed with a console.warn so a Slack outage
// never propagates into the repair loop.

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SlackBlock {
  type:    string;
  text?:   { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text: { type: string; text: string } }>;
}

interface SlackPayload {
  text:        string;
  attachments: Array<{
    color:   string;
    blocks:  SlackBlock[];
    footer:  string;
    ts:      number;
  }>;
}

// ── Core dispatcher ───────────────────────────────────────────────────────────

async function send(payload: SlackPayload): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[self-heal-notifier] Slack send failed:', err instanceof Error ? err.message : err);
  }
}

function footer(): string {
  return `flowen-platform · ${new Date().toUTCString()}`;
}

function ts(): number {
  return Math.floor(Date.now() / 1000);
}

// ── Event: fix attempt initiated ──────────────────────────────────────────────

export function notifyFixAttempted(
  errorId:  string,
  message:  string,
  filePath: string,
): void {
  send({
    text: `🔧 Self-heal agent attempting fix for \`${filePath}\``,
    attachments: [{
      color: '#f0a500',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '⚙️ Self-Heal: Fix Attempted', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Error ID:*\n\`${errorId}\`` },
            { type: 'mrkdwn', text: `*File:*\n\`${filePath}\`` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Error:*\n\`\`\`${message.slice(0, 300)}\`\`\`` },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: { type: 'mrkdwn', text: 'Claude Sonnet is analysing the stack trace and generating a patch…' } }],
        },
      ],
      footer: footer(),
      ts:     ts(),
    }],
  }).catch(() => null);
}

// ── Event: fix applied and committed ─────────────────────────────────────────

export function notifyFixApplied(
  errorId:    string,
  filePath:   string,
  commitHash: string,
  summary:    string,
): void {
  send({
    text: `✅ Self-heal patch committed for \`${filePath}\``,
    attachments: [{
      color: '#36a64f',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '✅ Self-Heal: Patch Committed', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Error ID:*\n\`${errorId}\`` },
            { type: 'mrkdwn', text: `*File:*\n\`${filePath}\`` },
            { type: 'mrkdwn', text: `*Commit:*\n\`${commitHash.slice(0, 8)}\`` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Patch summary:*\n${summary.slice(0, 500)}` },
        },
      ],
      footer: footer(),
      ts:     ts(),
    }],
  }).catch(() => null);
}

// ── Event: fix attempted but failed verification ──────────────────────────────

export function notifyFixFailed(
  errorId:       string,
  filePath:      string,
  reason:        string,
  typeErrors?:   string,
): void {
  send({
    text: `❌ Self-heal verification failed for \`${filePath}\` — manual review required`,
    attachments: [{
      color: '#cc0000',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '❌ Self-Heal: Verification Failed', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Error ID:*\n\`${errorId}\`` },
            { type: 'mrkdwn', text: `*File:*\n\`${filePath}\`` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Failure reason:*\n${reason}` },
        },
        ...(typeErrors ? [{
          type: 'section',
          text: { type: 'mrkdwn', text: `*TypeScript errors:*\n\`\`\`${typeErrors.slice(0, 600)}\`\`\`` },
        }] : []),
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: { type: 'mrkdwn', text: '⚠️ Original file restored. Manual intervention required.' } }],
        },
      ],
      footer: footer(),
      ts:     ts(),
    }],
  }).catch(() => null);
}

// ── Event: Kubernetes HPA scaling alert ───────────────────────────────────────

export function notifyScalingAlert(opts: {
  namespace:       string;
  hpaName:         string;
  currentReplicas: number;
  maxReplicas:     number;
  cpuPercent:      number;
  targetCpuPercent: number;
  severity:        'WARNING' | 'CRITICAL';
}): void {
  const colour   = opts.severity === 'CRITICAL' ? '#cc0000' : '#f0a500';
  const emoji    = opts.severity === 'CRITICAL' ? '🚨' : '⚠️';
  const fillPct  = Math.round((opts.currentReplicas / opts.maxReplicas) * 100);

  send({
    text: `${emoji} K8s HPA ${opts.severity}: \`${opts.hpaName}\` at ${fillPct}% replica capacity`,
    attachments: [{
      color: colour,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${emoji} Autoscaler ${opts.severity}: ${opts.hpaName}`, emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Namespace:*\n\`${opts.namespace}\`` },
            { type: 'mrkdwn', text: `*HPA:*\n\`${opts.hpaName}\`` },
            { type: 'mrkdwn', text: `*Replicas:*\n${opts.currentReplicas} / ${opts.maxReplicas} (${fillPct}%)` },
            { type: 'mrkdwn', text: `*CPU:*\n${opts.cpuPercent}% (target: ${opts.targetCpuPercent}%)` },
          ],
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: { type: 'mrkdwn', text: opts.severity === 'CRITICAL'
            ? '🚨 HPA is at maximum. Additional load will not be absorbed. Review deployment limits.'
            : '⚠️ HPA approaching maximum. Prepare to scale deployment or increase limits.'
          } }],
        },
      ],
      footer: footer(),
      ts:     ts(),
    }],
  }).catch(() => null);
}
