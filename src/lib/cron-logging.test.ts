import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock the DB layer entirely — this test is about withCronLogging's own
// gating/status logic, not a real Supabase round-trip.
const insertMock = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
vi.mock('@/lib/supabase/admin', () => ({
  adminDb: () => ({ from: () => ({ insert: insertMock }) }),
}));

const { withCronLogging } = await import('./cron-logging');

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  insertMock.mockClear();
  process.env.CRON_SECRET = 'test-secret-value';
});
afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/cron/test', { headers });
}

describe('withCronLogging — logging gate', () => {
  it('logs a genuinely scheduled invocation (Authorization: Bearer, no x-triggered-by)', async () => {
    const handler = withCronLogging('test-job', async () => NextResponse.json({ ok: true }));
    await handler(req({ authorization: 'Bearer test-secret-value' }));
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toMatchObject({ job_id: 'test-job', status: 'success', triggered_by: 'schedule' });
  });

  it('logs a manual x-cron-secret call the same way (e.g. a raw curl using the secret)', async () => {
    const handler = withCronLogging('test-job', async () => NextResponse.json({ ok: true }));
    await handler(req({ 'x-cron-secret': 'test-secret-value' }));
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT double-log when routed through the /api/admin/cron manual-trigger wrapper', async () => {
    // The wrapper sends both a valid cron secret AND x-triggered-by — it
    // manages its own cron_runs record around the call, so this route's own
    // logging must stay silent for exactly this combination.
    const handler = withCronLogging('test-job', async () => NextResponse.json({ ok: true }));
    await handler(req({ 'x-cron-secret': 'test-secret-value', 'x-triggered-by': 'manual:admin@flowen.digital' }));
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('does NOT log a plain admin-browser-session call with no cron secret at all', async () => {
    // Regression test for the actual bug found while wiring this up: routes
    // like the marketing syncs also accept a plain admin session as a
    // second, independent auth path (e.g. a "Sync now" button) — that
    // request carries neither header. Gating on x-triggered-by alone would
    // have mislabeled it as a "scheduled" run in cron_runs.
    const handler = withCronLogging('test-job', async () => NextResponse.json({ ok: true }));
    await handler(req()); // no auth headers at all
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('does NOT log a request with an invalid cron secret', async () => {
    const handler = withCronLogging('test-job', async () => NextResponse.json({ ok: true }));
    await handler(req({ 'x-cron-secret': 'wrong-secret' }));
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe('withCronLogging — status/result capture', () => {
  it('records success for a 2xx JSON response with no error field', async () => {
    const handler = withCronLogging('test-job', async () => NextResponse.json({ ok: true, synced: 5 }));
    await handler(req({ authorization: 'Bearer test-secret-value' }));
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      status: 'success',
      result: { ok: true, synced: 5 },
      error: null,
    });
  });

  it('records failed for a JSON body containing an error field, even with a 200 status', async () => {
    const handler = withCronLogging('test-job', async () => NextResponse.json({ error: 'no data returned' }));
    await handler(req({ authorization: 'Bearer test-secret-value' }));
    expect(insertMock.mock.calls[0][0]).toMatchObject({ status: 'failed', error: 'no data returned' });
  });

  it('records failed and still returns a real response when the handler throws', async () => {
    const handler = withCronLogging('test-job', async () => { throw new Error('boom'); });
    const res = await handler(req({ authorization: 'Bearer test-secret-value' }));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('boom');
    expect(insertMock.mock.calls[0][0]).toMatchObject({ status: 'failed', error: 'boom' });
  });

  it('does not crash on a non-JSON response body', async () => {
    const handler = withCronLogging('test-job', async () => new NextResponse('plain text', { status: 200 }));
    const res = await handler(req({ authorization: 'Bearer test-secret-value' }));
    expect(res.status).toBe(200);
    expect(insertMock.mock.calls[0][0]).toMatchObject({ status: 'success', result: null });
  });

  it('records failed for a non-2xx status even without an error field', async () => {
    const handler = withCronLogging('test-job', async () => NextResponse.json({ skipped: true }, { status: 503 }));
    await handler(req({ authorization: 'Bearer test-secret-value' }));
    expect(insertMock.mock.calls[0][0]).toMatchObject({ status: 'failed' });
  });
});
