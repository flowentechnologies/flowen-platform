/**
 * GET/POST/DELETE /api/admin/outreach/suppress-list
 *
 * Organization-wide suppress lists (people by email, companies by domain)
 * — applies to every AutoGTM campaign, running or not, checked right
 * before each send. Same lists the app's own Suppress list page shows.
 *
 * GET             — both people and company lists, newest first.
 * POST            — add a batch to a named list. body: { kind: 'people' | 'companies', list?, entries }
 *                    'people' entries are email strings; 'companies' entries are domain strings.
 * DELETE          — remove a whole list. query: ?kind=people|companies&list=<name>
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';

const EXPLEE_BASE = 'https://api.explee.com';

function expleeHeaders(): HeadersInit {
  const key = process.env.EXPLEE_API_KEY;
  if (!key) throw new Error('EXPLEE_API_KEY not configured');
  return { 'X-API-Key': key, 'Content-Type': 'application/json' };
}

interface SuppressListSummary { list: string; count: number; created_at: string }

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  let peopleRes: Response, companiesRes: Response;
  try {
    [peopleRes, companiesRes] = await Promise.all([
      fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/suppress-list/people`, { headers: expleeHeaders() }),
      fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/suppress-list/companies`, { headers: expleeHeaders() }),
    ]);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const people = await peopleRes.json().catch(() => ({})) as { lists?: SuppressListSummary[]; error?: string };
  const companies = await companiesRes.json().catch(() => ({})) as { lists?: SuppressListSummary[]; error?: string };
  if (!peopleRes.ok) return NextResponse.json({ error: people.error ?? `Explee error (HTTP ${peopleRes.status})` }, { status: peopleRes.status });
  if (!companiesRes.ok) return NextResponse.json({ error: companies.error ?? `Explee error (HTTP ${companiesRes.status})` }, { status: companiesRes.status });

  return NextResponse.json({ people: people.lists ?? [], companies: companies.lists ?? [] });
}

interface PostBody { kind?: 'people' | 'companies'; list?: string; entries?: string[] }

export async function POST(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as PostBody;
  const entries = (body.entries ?? []).map(e => e.trim()).filter(Boolean);
  if (!body.kind || (body.kind !== 'people' && body.kind !== 'companies')) {
    return NextResponse.json({ error: 'kind must be "people" or "companies"' }, { status: 422 });
  }
  if (entries.length === 0) return NextResponse.json({ error: 'At least one entry is required' }, { status: 422 });

  const path = body.kind === 'people' ? 'people' : 'companies';
  const payload = body.kind === 'people'
    ? { people: entries.map(email => ({ email })), list: body.list || undefined }
    : { domains: entries, list: body.list || undefined };

  let res: Response;
  try {
    res = await fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/suppress-list/${path}`, {
      method: 'POST', headers: expleeHeaders(), body: JSON.stringify(payload),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({})) as { list?: string; added?: number; skipped?: number; error?: string };
  if (!res.ok) return NextResponse.json({ error: data.error ?? `Explee error (HTTP ${res.status})` }, { status: res.status });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');
  const list = searchParams.get('list');
  if ((kind !== 'people' && kind !== 'companies') || !list) {
    return NextResponse.json({ error: 'kind (people|companies) and list are required' }, { status: 422 });
  }

  let res: Response;
  try {
    res = await fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/suppress-list/${kind}/${encodeURIComponent(list)}`, {
      method: 'DELETE', headers: expleeHeaders(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({})) as { list?: string; deleted?: number; error?: string };
  if (!res.ok) return NextResponse.json({ error: data.error ?? `Explee error (HTTP ${res.status})` }, { status: res.status });
  return NextResponse.json(data);
}
