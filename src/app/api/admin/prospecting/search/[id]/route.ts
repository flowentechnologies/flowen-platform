/**
 * GET /api/admin/prospecting/search/{id}
 *
 * Polls one search's progress/results. While still pending in our DB, this
 * polls Explee live and persists the result the moment it completes or
 * fails; once completed/failed, further calls just read back what's
 * already stored instead of re-hitting Explee for a job that's done.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

const EXPLEE_BASE = 'https://api.explee.com';

function expleeHeaders(): HeadersInit {
  const key = process.env.EXPLEE_API_KEY;
  if (!key) throw new Error('EXPLEE_API_KEY not configured');
  return { 'X-API-Key': key };
}

interface FindEnrichContact {
  first_name: string | null; last_name: string | null; title: string | null;
  linkedin_url: string | null; company_name: string | null; company_domain: string | null;
  email: string | null; email_status: string | null;
}
interface FindAndEnrichResponse {
  contacts: FindEnrichContact[] | null;
  meta: {
    status: 'pending' | 'completed' | 'failed';
    progress: { attempted: number; found: number; target: number; progress_pct: number; eta_seconds: number | null } | null;
    error: string | null;
    credits_charged: number | null;
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { id } = await params;
  const supabase = db();
  const { data: search, error: searchError } = await supabase.from('explee_searches').select('*').eq('id', id).maybeSingle();
  if (searchError) return NextResponse.json({ error: searchError.message }, { status: 500 });
  if (!search) return NextResponse.json({ error: 'Search not found' }, { status: 404 });

  if (search.status !== 'pending') {
    const { data: prospects } = await supabase.from('explee_prospects').select('*').eq('search_id', id).order('created_at');
    return NextResponse.json({ search, prospects: prospects ?? [], progress: null });
  }

  let res: Response;
  try {
    res = await fetch(`${EXPLEE_BASE}/public/api/v1/find-and-enrich/${search.task_id}`, { headers: expleeHeaders() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({})) as FindAndEnrichResponse & { error?: string };
  if (!res.ok) return NextResponse.json({ error: data.error ?? `Explee error (HTTP ${res.status})` }, { status: res.status });

  if (data.meta.status === 'pending') {
    return NextResponse.json({ search, prospects: [], progress: data.meta.progress });
  }

  const now = new Date().toISOString();
  if (data.meta.status === 'failed') {
    await supabase.from('explee_searches').update({ status: 'failed', error: data.meta.error, completed_at: now }).eq('id', id);
    return NextResponse.json({ search: { ...search, status: 'failed', error: data.meta.error }, prospects: [], progress: null });
  }

  // completed — only contacts with a found email are ever returned, per Explee's own contract.
  const contacts = data.contacts ?? [];
  if (contacts.length > 0) {
    await supabase.from('explee_prospects').insert(contacts.map(c => ({
      search_id: id, first_name: c.first_name, last_name: c.last_name, title: c.title,
      linkedin_url: c.linkedin_url, company_name: c.company_name, company_domain: c.company_domain,
      email: c.email, email_status: c.email_status,
    })));
  }
  await supabase.from('explee_searches').update({
    status: 'completed', credits_charged: data.meta.credits_charged, completed_at: now,
  }).eq('id', id);

  const { data: prospects } = await supabase.from('explee_prospects').select('*').eq('search_id', id).order('created_at');
  return NextResponse.json({
    search: { ...search, status: 'completed', credits_charged: data.meta.credits_charged },
    prospects: prospects ?? [], progress: null,
  });
}
