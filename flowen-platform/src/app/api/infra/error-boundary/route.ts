// Error gateway — receives runtime exceptions from client components and the
// Next.js error boundary, persists them to system_error_logs for ops visibility.
//
// Client usage:
//   fetch('/api/infra/error-boundary', {
//     method: 'POST',
//     body: JSON.stringify({ message, stack, file, digest })
//   })
//
// Note: the self-heal agent (scripts/infra/self-heal-agent.js) watches a local
// filesystem queue that is NOT available on Vercel (read-only function root).
// To re-enable self-healing in production, replace the filesystem queue with a
// DB-backed queue table and poll via cron.

import { createClient } from '@supabase/supabase-js';
import { checkErrorBoundaryRateLimit } from '@/lib/rate-limit';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ErrorReport {
  message:         string;
  stack?:          string;
  componentStack?: string;
  file?:           string;
  line?:           number;
  column?:         number;
  digest?:         string;
  environment?:    string;
  userAgent?:      string;
  url?:            string;
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

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // Rate-limit: 20 reports / IP / minute prevents unauthenticated callers from
  // flooding system_error_logs.  Legitimate error boundaries fire once per crash,
  // so this threshold is generous for real users and tight for abusers.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const allowed = await checkErrorBoundaryRateLimit(ip);
  if (!allowed) {
    return Response.json({ error: 'Too Many Requests' }, { status: 429 });
  }

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

  // Persist to Supabase for ops visibility.
  try {
    const admin = createAdminClient();
    await admin.from('system_error_logs').insert({
      source:      body.file ?? 'client/unknown',
      error_code:  body.digest ?? 'CLIENT_RUNTIME_ERROR',
      message:     body.message.slice(0, 2000),
      stack_trace: body.stack?.slice(0, 8000),
      metadata: {
        id,
        receivedAt,
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

  return Response.json({ received: true, id });
}
