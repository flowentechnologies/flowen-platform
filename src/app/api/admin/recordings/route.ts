/**
 * GET /api/admin/recordings
 *   Admin-only browsing of practice_sessions audio recordings (the
 *   session-recordings bucket — Supabase Storage or R2, whichever
 *   audio_storage_provider says), categorised by brand + programme stage.
 *
 *   Query params:
 *     brand=flowen     — filter to one brand (omit for all)
 *     stage_id=3        — filter to one stage (omit for all)
 *     id=<uuid>         — filter to one exact session (ignores paging/brand/stage)
 *     page=0            — list page (20 per page)
 *     export=1          — attach a 1-hour signed URL to each row in the page
 *
 * NOT a training-data endpoint — see the consent-boundary note in
 * src/lib/recording-storage.ts. This bucket has no ML-consent gate, so it
 * must never be wired into anything that trains a model. It exists purely
 * so admin/support can find and play back a specific session's recording.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { getR2SignedUrl } from '@/lib/r2';

const BUCKET    = 'session-recordings';
const PAGE_SIZE = 20;
const URL_TTL   = 3600;

export const dynamic = 'force-dynamic';

interface RecordingRow {
  id: string;
  user_id: string;
  brand: string | null;
  stage_id: number | null;
  created_at: string;
  duration_seconds: number | null;
  total_blocks_detected: number | null;
  total_repetitions_detected: number | null;
  total_prolongations_detected: number | null;
  audio_storage_path: string;
  audio_storage_provider: string;
}

export async function GET(req: Request) {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const brandFilter = searchParams.get('brand');
  const stageFilter = searchParams.get('stage_id');
  const idFilter     = searchParams.get('id');
  const page         = Math.max(0, Number(searchParams.get('page') ?? 0));
  const wantUrls     = searchParams.get('export') === '1';

  const admin = adminDb();

  // ── Category breakdown (brand x stage) — every recorded session, unfiltered ──
  const { data: allRows } = await admin
    .from('practice_sessions')
    .select('brand, stage_id, duration_seconds')
    .not('audio_storage_path', 'is', null);

  const byCategory = ((allRows ?? []) as Pick<RecordingRow, 'brand' | 'stage_id' | 'duration_seconds'>[]).reduce(
    (acc, r) => {
      const key = `${r.brand ?? 'unbranded'} / stage ${r.stage_id ?? 'unknown'}`;
      if (!acc[key]) acc[key] = { count: 0, seconds: 0 };
      acc[key].count++;
      acc[key].seconds += r.duration_seconds ?? 0;
      return acc;
    },
    {} as Record<string, { count: number; seconds: number }>,
  );

  // ── Filtered, paginated list ──────────────────────────────────────────────────
  let query = admin
    .from('practice_sessions')
    .select(`
      id, user_id, brand, stage_id, created_at, duration_seconds,
      total_blocks_detected, total_repetitions_detected, total_prolongations_detected,
      audio_storage_path, audio_storage_provider
    `)
    .not('audio_storage_path', 'is', null)
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (idFilter) {
    query = query.eq('id', idFilter);
  } else {
    if (brandFilter) query = query.eq('brand', brandFilter);
    if (stageFilter) query = query.eq('stage_id', Number(stageFilter));
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error('[admin/recordings]', error.message);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const recordings = await Promise.all(
    ((rows ?? []) as RecordingRow[]).map(async (r) => {
      let signedUrl: string | null = null;
      if (wantUrls) {
        try {
          signedUrl = r.audio_storage_provider === 'r2'
            ? await getR2SignedUrl(r.audio_storage_path, URL_TTL)
            : (await admin.storage.from(BUCKET).createSignedUrl(r.audio_storage_path, URL_TTL)).data?.signedUrl ?? null;
        } catch (err) {
          console.error('[admin/recordings] signed url error:', err);
        }
      }
      return { ...r, signedUrl };
    }),
  );

  return NextResponse.json({
    by_category: byCategory,
    recordings,
    page,
    page_size: PAGE_SIZE,
    has_more: recordings.length === PAGE_SIZE,
  });
}
