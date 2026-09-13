/**
 * GET/PATCH /api/admin/outreach/autopilot
 *
 * Reads and writes the project's Autopilot / auto-reply settings.
 * Autopilot ON means Explee's own agent manages campaigns and the
 * per-campaign budget split — that's exactly why campaign-control's
 * set_budget action can 409 (Explee's own gate, not this app's); turning
 * it off here is what hands manual budget control back.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';

const EXPLEE_BASE = 'https://api.explee.com';
const EXPLEE_PROJECT_ID = 33901;

function expleeHeaders(): HeadersInit {
  const key = process.env.EXPLEE_API_KEY;
  if (!key) throw new Error('EXPLEE_API_KEY not configured');
  return { 'X-API-Key': key, 'Content-Type': 'application/json' };
}

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  let res: Response;
  try {
    res = await fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/projects/${EXPLEE_PROJECT_ID}/autopilot`, { headers: expleeHeaders() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({})) as Record<string, unknown> & { error?: string };
  if (!res.ok) return NextResponse.json({ error: data.error ?? `Explee error (HTTP ${res.status})` }, { status: res.status });
  return NextResponse.json(data);
}

interface PatchBody {
  autopilotEnabled?: boolean;
  autoReplyEnabled?: boolean;
  autoReplyDelayMinutes?: number;
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as PatchBody;
  const payload: Record<string, unknown> = {};
  if (body.autopilotEnabled !== undefined) payload.autopilot_enabled = body.autopilotEnabled;
  if (body.autoReplyEnabled !== undefined) payload.auto_reply_enabled = body.autoReplyEnabled;
  if (body.autoReplyDelayMinutes !== undefined) payload.auto_reply_delay_minutes = body.autoReplyDelayMinutes;
  if (Object.keys(payload).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 422 });

  let res: Response;
  try {
    res = await fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/projects/${EXPLEE_PROJECT_ID}/autopilot`, {
      method: 'PATCH', headers: expleeHeaders(), body: JSON.stringify(payload),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({})) as Record<string, unknown> & { error?: string };
  if (!res.ok) return NextResponse.json({ error: data.error ?? `Explee error (HTTP ${res.status})` }, { status: res.status });
  return NextResponse.json(data);
}
