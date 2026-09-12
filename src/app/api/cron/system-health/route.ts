import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { verifyCronRequest } from '@/lib/cron-auth';
import { adminDb as db } from '@/lib/supabase/admin';
import { isMetaConfigured } from '@/lib/social/meta-publish';
import { getConvoAIHeaders } from '@/lib/agora/convoai-auth';
import { DEFAULT_CONVOAI_BASE_URL, buildConvoAIListAgentsUrl } from '@/lib/agora/convoai-urls';

const GRAPH_VERSION = 'v21.0';
const EXPLEE_BASE = 'https://api.explee.com';
const EXPLEE_PROJECT_ID = 33901;

// ── DB client ─────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceCheck {
  name:   string;
  ok:     boolean;
  latencyMs: number | null;
  detail: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

// Vercel Cron always invokes via GET (with Authorization: Bearer CRON_SECRET);
// /admin/cron's manual trigger uses POST (with x-cron-secret) — verifyCronRequest
// accepts either, so both methods need to route to the same handler.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}

async function handle(req: NextRequest): Promise<NextResponse> {
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

  // ── Meta Graph API token ─────────────────────────────────────────────────
  // Added after a real incident where META_PAGE_ACCESS_TOKEN silently expired
  // and the first sign of it was social-stats-sync failing hours later — this
  // catches an expired/revoked token within the hour instead.
  {
    const t0 = Date.now();
    if (isMetaConfigured()) {
      try {
        const url = `https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id&access_token=${process.env.META_PAGE_ACCESS_TOKEN}`;
        const res = await fetch(url);
        const body = await res.json() as { id?: string; error?: { message?: string } };
        results.push({
          name:      'meta-graph-api',
          ok:        res.ok && !body.error,
          latencyMs: Date.now() - t0,
          detail:    body.error ? body.error.message ?? 'Graph API error' : 'Token valid',
        });
      } catch (err) {
        results.push({
          name:      'meta-graph-api',
          ok:        false,
          latencyMs: Date.now() - t0,
          detail:    err instanceof Error ? err.message : 'Unknown error',
        });
      }
    } else {
      results.push({ name: 'meta-graph-api', ok: false, latencyMs: null, detail: 'META_PAGE_ACCESS_TOKEN/META_PAGE_ID/META_IG_USER_ID not configured' });
    }
  }

  // ── Agora ConvoAI reachability ───────────────────────────────────────────
  // Added after a long-standing bug where join/leave were hitting a URL that
  // no longer existed (see convoai-urls.ts) — every agent start had been
  // 404ing silently from the user's point of view. A cheap list-agents call
  // confirms both the base URL and the customer credentials are still good.
  {
    const t0 = Date.now();
    const appId = process.env.AGORA_APP_ID;
    const configured = Boolean(appId && process.env.AGORA_CUSTOMER_ID && process.env.AGORA_CUSTOMER_SECRET);
    if (configured) {
      try {
        const baseUrl = process.env.AGORA_CONVOAI_BASE_URL ?? DEFAULT_CONVOAI_BASE_URL;
        const res = await fetch(buildConvoAIListAgentsUrl(baseUrl, appId!), { headers: getConvoAIHeaders() });
        results.push({
          name:      'agora-convoai',
          ok:        res.ok,
          latencyMs: Date.now() - t0,
          detail:    res.ok ? 'List agents succeeded' : `${res.status}: ${await res.text()}`,
        });
      } catch (err) {
        results.push({
          name:      'agora-convoai',
          ok:        false,
          latencyMs: Date.now() - t0,
          detail:    err instanceof Error ? err.message : 'Unknown error',
        });
      }
    } else {
      results.push({ name: 'agora-convoai', ok: false, latencyMs: null, detail: 'AGORA_APP_ID/AGORA_CUSTOMER_ID/AGORA_CUSTOMER_SECRET not configured' });
    }
  }

  // ── Explee API key ───────────────────────────────────────────────────────
  // Both Explee crons (explee-hot-leads, explee-outreach-sync) run every 10
  // minutes and would otherwise be the only place a revoked/expired
  // EXPLEE_API_KEY ever surfaces — buried in a job that already runs 144
  // times a day, easy to miss amongst routine "no changes" runs.
  {
    const t0 = Date.now();
    const key = process.env.EXPLEE_API_KEY;
    if (key) {
      try {
        const res = await fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/campaigns?project_id=${EXPLEE_PROJECT_ID}`, {
          headers: { 'X-API-Key': key },
        });
        results.push({
          name:      'explee',
          ok:        res.ok,
          latencyMs: Date.now() - t0,
          detail:    res.ok ? 'Campaigns fetch succeeded' : `${res.status}: ${await res.text()}`,
        });
      } catch (err) {
        results.push({
          name:      'explee',
          ok:        false,
          latencyMs: Date.now() - t0,
          detail:    err instanceof Error ? err.message : 'Unknown error',
        });
      }
    } else {
      results.push({ name: 'explee', ok: false, latencyMs: null, detail: 'EXPLEE_API_KEY not configured' });
    }
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
