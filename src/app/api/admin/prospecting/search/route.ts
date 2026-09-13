/**
 * POST /api/admin/prospecting/search
 * GET  /api/admin/prospecting/search — list past searches (most recent first)
 *
 * Kicks off an Explee find-and-enrich job: search for people matching the
 * given filters and enrich their emails. Billable (1.5-5 credits per found
 * email — search itself is free), so this is always a deliberate admin
 * action from /admin/prospecting, never automatic. Returns immediately
 * with a searchId to poll via GET /api/admin/prospecting/search/{id}.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

const EXPLEE_BASE = 'https://api.explee.com';

function expleeHeaders(): HeadersInit {
  const key = process.env.EXPLEE_API_KEY;
  if (!key) throw new Error('EXPLEE_API_KEY not configured');
  return { 'X-API-Key': key, 'Content-Type': 'application/json' };
}

interface SearchRequestBody {
  companyDefinition?: string;
  companyGeo?: string[];
  peopleJobTitles?: string[];
  peopleGeo?: string[];
  maxContacts?: number;
  preset?: 'basic' | 'premium';
}

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { data, error } = await db()
    .from('explee_searches')
    .select('id, task_id, status, people_filters, company_filters, max_contacts, preset, credits_charged, error, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ searches: data });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as SearchRequestBody;
  const maxContacts = body.maxContacts ?? 50;
  const preset = body.preset ?? 'basic';

  if (!body.companyDefinition?.trim() && !body.peopleJobTitles?.length) {
    return NextResponse.json({ error: 'Provide at least a company definition or a job title to search for' }, { status: 422 });
  }
  if (maxContacts < 1 || maxContacts > 500) {
    return NextResponse.json({ error: 'maxContacts must be between 1 and 500' }, { status: 422 });
  }

  const companyFilters: Record<string, unknown> = {};
  if (body.companyDefinition?.trim()) companyFilters.definition = body.companyDefinition.trim();
  if (body.companyGeo?.length) companyFilters.geo_include = body.companyGeo;

  const peopleFilters: Record<string, unknown> = {};
  if (body.peopleJobTitles?.length) peopleFilters.job_titles = body.peopleJobTitles;
  if (body.peopleGeo?.length) peopleFilters.geo = body.peopleGeo;

  // Auto-exclude anyone already in the CRM, if a dedup list has been built
  // (see /api/admin/prospecting/dedup-list) — matched people are neither
  // returned nor charged, so this costs nothing and just stops the same
  // person being "found" a second time.
  const { data: dedupList } = await db()
    .from('explee_dedup_lists').select('id')
    .eq('kind', 'people').order('created_at', { ascending: false }).limit(1).maybeSingle();

  const payload: Record<string, unknown> = { company_filters: companyFilters, people_filters: peopleFilters, max_contacts: maxContacts, preset };
  if (dedupList?.id) payload.exclude_lists = [dedupList.id];

  let res: Response;
  try {
    res = await fetch(`${EXPLEE_BASE}/public/api/v1/find-and-enrich`, {
      method: 'POST', headers: expleeHeaders(), body: JSON.stringify(payload),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({})) as { task_id?: string; error?: string; detail?: unknown };
  if (!res.ok || !data.task_id) {
    return NextResponse.json({ error: data.error ?? `Explee error (HTTP ${res.status})` }, { status: res.status || 500 });
  }

  const { data: created, error } = await db().from('explee_searches').insert({
    task_id: data.task_id, status: 'pending',
    people_filters: peopleFilters, company_filters: companyFilters,
    max_contacts: maxContacts, preset, created_by: admin.email ?? 'admin',
  }).select('id').single();
  if (error || !created) return NextResponse.json({ error: error?.message ?? 'Failed to record search' }, { status: 500 });

  return NextResponse.json({ searchId: created.id, taskId: data.task_id });
}
