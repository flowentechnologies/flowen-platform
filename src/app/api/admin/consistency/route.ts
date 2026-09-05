/**
 * GET /api/admin/consistency
 * Returns the most recent result for each check_type, plus a short history.
 * Read-only — running the checks themselves happens via /api/admin/cron
 * (jobId: 'consistency-check', or the marketing-sync jobs first if you want
 * fresh ad-platform data before checking).
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const supabase = db();
  const { data, error } = await supabase
    .from('consistency_checks')
    .select('*')
    .order('checked_at', { ascending: false })
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const latest: Record<string, unknown> = {};
  for (const row of data ?? []) {
    if (!latest[row.check_type]) latest[row.check_type] = row;
  }

  return NextResponse.json({ latest, history: data ?? [] });
}
