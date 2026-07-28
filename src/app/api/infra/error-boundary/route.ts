// Error gateway endpoint — receives runtime exceptions from client components
// and the Next.js error boundary, persists them to system_error_logs, and
// drops a trigger file for the self-healing agent to pick up.
//
// Client usage:
//   fetch('/api/infra/error-boundary', {
//     method: 'POST',
//     body: JSON.stringify({ message, stack, file, digest })
//   })

import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ErrorReport {
  message:        string;
  stack?:         string;
  componentStack?: string;
  file?:          string;
  line?:          number;
  column?:        number;
  digest?:        string;
  environment?:   string;
  userAgent?:     string;
  url?:           string;
}

interface HealTrigger extends ErrorReport {
  id:         string;
  receivedAt: string;
}

// ── Admin client ──────────────────────────────────────────────────────────────

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials not configured');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Heal queue ────────────────────────────────────────────────────────────────
// The agent watches this directory; each file is a self-contained trigger.

const HEAL_QUEUE_DIR = path.join(process.cwd(), 'diagnostics', 'heal-queue');

async function enqueueForHealing(trigger: HealTrigger): Promise<void> {
  if (process.env.SELF_HEAL_ENABLED !== 'true') return;
  // Only enqueue errors that point to a fixable source file.
  if (!trigger.file?.startsWith('src/')) return;

  await mkdir(HEAL_QUEUE_DIR, { recursive: true });
  const fileName = `${trigger.id}.json`;
  await writeFile(
    path.join(HEAL_QUEUE_DIR, fileName),
    JSON.stringify(trigger, null, 2),
    'utf8',
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  let body: ErrorReport;
  try {
    body = await req.json() as ErrorReport;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.message || typeof body.message !== 'string') {
    return Response.json({ error: 'message is required' }, { status: 400 });
  }

  const id          = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const receivedAt  = new Date().toISOString();
  const environment = body.environment ?? process.env.NODE_ENV ?? 'production';

  // 1. Persist to Supabase for ops visibility.
  try {
    const admin = createAdminClient();
    await admin.from('system_error_logs').insert({
      source:      body.file ?? 'client/unknown',
      error_code:  body.digest ?? 'CLIENT_RUNTIME_ERROR',
      message:     body.message.slice(0, 2000),
      stack_trace: body.stack?.slice(0, 8000),
      metadata: {
        id,
        componentStack: body.componentStack?.slice(0, 4000),
        url:            body.url,
        userAgent:      body.userAgent,
        line:           body.line,
        column:         body.column,
      },
      environment,
      resolved: false,
    });
  } catch (dbErr) {
    // DB failure must not prevent the 200 response — the client error report
    // should not cascade into a second error.
    console.error('[error-boundary] DB write failed:', dbErr instanceof Error ? dbErr.message : dbErr);
  }

  // 2. Drop trigger file for the self-healing agent.
  const trigger: HealTrigger = { ...body, id, receivedAt };
  enqueueForHealing(trigger).catch(e => {
    console.warn('[error-boundary] heal queue write failed:', e instanceof Error ? e.message : e);
  });

  return Response.json({ received: true, id });
}
