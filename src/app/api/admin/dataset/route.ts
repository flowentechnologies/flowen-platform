import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { datasetPage } from '@/lib/asr/dataset';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const page = datasetPage(new URL(req.url).searchParams.get('page'));
  if (page === null) return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  const db = adminDb();
  const [result, consent] = await Promise.all([
    db.from('training_samples').select('id,user_id,duration_seconds,stage_id,transcript,disfluency_events,consent_version,created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).order('id').range(page * 20, page * 20 + 19),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('consent_data_collection', true),
  ]);
  if (result.error || consent.error) return NextResponse.json({ error: 'Dataset could not be loaded' }, { status: 503 });
  const rows = result.data ?? [];
  const ids = [...new Set(rows.map(r => r.user_id))];
  const profiles = ids.length ? await db.from('profiles').select('id,consent_data_collection').in('id', ids) : { data: [], error: null };
  if (profiles.error) return NextResponse.json({ error: 'Consent could not be verified' }, { status: 503 });
  const allowed = new Set((profiles.data ?? []).filter(p => p.consent_data_collection).map(p => p.id));
  const samples = rows.map(({ user_id, ...r }) => {
    const eligible = allowed.has(user_id) && Boolean(r.consent_version);
    // No identities, storage paths, signed URLs or withdrawn speech in the listing.
    return { ...r, transcript: eligible ? r.transcript : null, disfluency_events: eligible ? r.disfluency_events : null, eligible };
  });
  return NextResponse.json({ samples, page, page_size: 20, has_more: (result.count ?? 0) > (page + 1) * 20,
    stats: { total_samples: result.count ?? 0, consented_users: consent.count ?? 0 } }, { headers: { 'Cache-Control': 'private, no-store' } });
}
