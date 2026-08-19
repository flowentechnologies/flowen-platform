/**
 * GET /api/admin/seedance-region
 *
 * Probes both BytePlus regional endpoints with the configured API key
 * and reports which one authenticates correctly.
 *
 * This is used to diagnose "ModelNotOpen" errors caused by a region mismatch:
 *   International  → ark.ap-southeast.bytepluses.com  (console.byteplus.com)
 *   China          → ark.cn-beijing.volces.com         (console.volcengine.com)
 *
 * After running this, set BYTEPLUS_API_BASE in Vercel to the working endpoint.
 */

import { NextResponse } from 'next/server';
import { requireAdmin }  from '@/lib/admin/guard';

// The two candidate base URLs
const CANDIDATES = [
  {
    region: 'International (BytePlus)',
    base:   'https://ark.ap-southeast.bytepluses.com/api/v3',
    console: 'https://console.byteplus.com/ark',
    envValue: 'https://ark.ap-southeast.bytepluses.com/api/v3',
  },
  {
    region: 'China (VolcEngine)',
    base:   'https://ark.cn-beijing.volces.com/api/v3',
    console: 'https://console.volcengine.com/ark',
    envValue: 'https://ark.cn-beijing.volces.com/api/v3',
  },
] as const;

// Lightweight probe: GET /contents/generations/tasks
// Returns 200 (empty list) or a pagination error if auth + routing works.
// Returns 401/403 if auth fails.
// ENOTFOUND / connection errors if the endpoint is wrong for this account type.
const PROBE_PATH = '/contents/generations/tasks';

async function probe(base: string, apiKey: string): Promise<{
  ok:           boolean;
  httpStatus:   number | null;
  body:         string;
  latencyMs:    number;
  error:        string | null;
}> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}${PROBE_PATH}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      // Short timeout — we just need the HTTP handshake + response header
      signal: AbortSignal.timeout(10_000),
    });
    const body      = await res.text().catch(() => '');
    const latencyMs = Date.now() - t0;
    // 200 or 4xx that isn't 401/403 = we reached the right region
    const ok = res.status !== 401 && res.status !== 403;
    return { ok, httpStatus: res.status, body: body.slice(0, 400), latencyMs, error: null };
  } catch (e) {
    return {
      ok:         false,
      httpStatus: null,
      body:       '',
      latencyMs:  Date.now() - t0,
      error:      e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const apiKey = process.env.BYTEPLUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'BYTEPLUS_API_KEY is not set — add it to Vercel env vars.' },
      { status: 400 },
    );
  }

  const currentBase =
    (process.env.BYTEPLUS_API_BASE ?? '').replace(/\/$/, '') ||
    'https://ark.ap-southeast.bytepluses.com/api/v3';

  // Probe both endpoints in parallel
  const [intlResult, cnResult] = await Promise.all([
    probe(CANDIDATES[0].base, apiKey),
    probe(CANDIDATES[1].base, apiKey),
  ]);

  const results = [
    { ...CANDIDATES[0], ...intlResult },
    { ...CANDIDATES[1], ...cnResult },
  ];

  const workingRegion = results.find(r => r.ok) ?? null;
  const currentMatch  = results.find(r => r.base === currentBase);

  const diagnosis = (() => {
    if (!workingRegion) {
      return 'Neither endpoint authenticated. Check that BYTEPLUS_API_KEY is correct and not expired.';
    }
    if (currentMatch?.ok) {
      return `✅ BYTEPLUS_API_BASE is already set to the correct region (${workingRegion.region}).`;
    }
    return (
      `⚠️  BYTEPLUS_API_BASE is set to the wrong region. ` +
      `Your API key works with the ${workingRegion.region} endpoint. ` +
      `Set BYTEPLUS_API_BASE=${workingRegion.envValue} in Vercel and redeploy.`
    );
  })();

  return NextResponse.json({
    diagnosis,
    currentBase,
    apiKeyPrefix: apiKey.slice(0, 12) + '…',
    results: results.map(r => ({
      region:     r.region,
      base:       r.base,
      console:    r.console,
      envValue:   r.envValue,
      ok:         r.ok,
      httpStatus: r.httpStatus,
      latencyMs:  r.latencyMs,
      error:      r.error,
      bodyPreview: r.body,
    })),
  });
}
