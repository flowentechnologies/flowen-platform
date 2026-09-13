/**
 * GET/POST /api/admin/prospecting/dedup-list
 *
 * Builds an Explee dedup list from every CRM contact with an email —
 * "people we already own" — so a new prospecting search can pass its id
 * in exclude_lists and never re-find (or get charged for) someone already
 * in the CRM. Explee's dedup lists are immutable once created (its own
 * docs: create a new one per batch, consolidate periodically), so this is
 * a deliberate "Refresh" action, not something recomputed on every search.
 *
 * GET  — the most recent list's metadata, or null if none has been built yet.
 * POST — builds a fresh one from the current CRM contact base.
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

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { data, error } = await db()
    .from('explee_dedup_lists').select('*')
    .eq('kind', 'people').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ list: data ?? null });
}

export async function POST(): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const supabase = db();
  const { data: contacts, error: fetchError } = await supabase
    .from('crm_contacts').select('email, linkedin_url, company_domain').not('email', 'is', null);
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: 'No CRM contacts with an email to dedupe against yet' }, { status: 422 });
  }

  const people = contacts.map(c => ({
    email: c.email,
    linkedin_url: c.linkedin_url ?? undefined,
    company_domain: c.company_domain ?? undefined,
  }));

  let res: Response;
  try {
    res = await fetch(`${EXPLEE_BASE}/public/api/v1/dedup/people`, {
      method: 'POST', headers: expleeHeaders(),
      body: JSON.stringify({ people, name: `crm-${new Date().toISOString().slice(0, 10)}` }),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({})) as {
    id?: string; name?: string; total?: number; invalid_count?: number; error?: string;
  };
  if (!res.ok || !data.id) return NextResponse.json({ error: data.error ?? `Explee error (HTTP ${res.status})` }, { status: res.status || 500 });

  const { error: insertError } = await supabase.from('explee_dedup_lists').insert({
    id: data.id, kind: 'people', source: 'crm_contacts',
    total: data.total ?? people.length, invalid_count: data.invalid_count ?? 0,
    created_by: admin.email ?? 'admin',
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ id: data.id, total: data.total, invalidCount: data.invalid_count });
}
