import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { verifyCronRequest } from '@/lib/cron-auth';
import { adminDb as db } from '@/lib/supabase/admin';

// ── DB client ─────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceCheck {
  name:   string;
  ok:     boolean;
  latencyMs: number | null;
  detail: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isManual = req.headers.get('x-triggered-by') !== null;
  const started = Date.now();
  const runId   = crypto.randomUUID();
  const results: ServiceCheck[] = [];

  // ── Supabase ping ────────────────────────────────────────────────────────
  {
    const t0 = Date.now();
    try {
      const { error } = await db().from('profiles').select('id').limit(1);
      results.push({
        name:      'supabase',
        ok:        !error,
        latencyMs: Date.now() - t0,
        detail:    error ? error.message : 'Query succeeded',
      });
    } catch (err) {
      results.push({
        name:      'supabase',
        ok:        false,
        latencyMs: Date.now() - t0,
        detail:    err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // ── Stripe ping ──────────────────────────────────────────────────────────
  {
    const hasStripe = Boolean(
      process.env.STRIPE_LIVE_SECRET_KEY ??
      process.env.STRIPE_SECRET_KEY ??
      process.env.STRIPE_TEST_SECRET_KEY,
    );
    const t0 = Date.now();
    if (hasStripe) {
      try {
        await stripe.balance.retrieve();
        results.push({
          name:      'stripe',
          ok:        true,
          latencyMs: Date.now() - t0,
          detail:    'balance.retrieve succeeded',
        });
      } catch (err) {
        results.push({
          name:      'stripe',
          ok:        false,
          latencyMs: Date.now() - t0,
          detail:    err instanceof Error ? err.message : 'Stripe error',
        });
      }
    } else {
      results.push({ name: 'stripe', ok: false, latencyMs: null, detail: 'No secret key configured' });
    }
  }

  // ── Email env check ──────────────────────────────────────────────────────
  {
    const hasHost = Boolean(process.env.EMAIL_SERVER_HOST);
    const hasUser = Boolean(process.env.EMAIL_SERVER_USER);
    results.push({
      name:      'smtp',
      ok:        hasHost && hasUser,
      latencyMs: null,
      detail:    hasHost && hasUser ? 'Env vars present' : `Missing: ${!hasHost ? 'EMAIL_SERVER_HOST ' : ''}${!hasUser ? 'EMAIL_SERVER_USER' : ''}`.trim(),
    });
  }

  const allOk       = results.every(r => r.ok);
  const durationMs  = Date.now() - started;

  // Only self-log when called by the scheduler (not by the admin trigger handler,
  // which manages its own cron_runs record around this call).
  if (!isManual) {
    const now = new Date().toISOString();
    await db().from('cron_runs').insert({
      id:           runId,
      job_id:       'system-health',
      status:       allOk ? 'success' : 'failed',
      triggered_by: 'schedule',
      duration_ms:  durationMs,
      result:       { results },
      error:        allOk ? null : results.filter(r => !r.ok).map(r => `${r.name}: ${r.detail}`).join('; '),
      started_at:   new Date(Date.now() - durationMs).toISOString(),
      finished_at:  now,
    });
  }

  return NextResponse.json({ ok: allOk, results, durationMs });
}
