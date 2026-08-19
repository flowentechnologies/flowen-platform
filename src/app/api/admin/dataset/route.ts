/**
 * GET /api/admin/dataset
 *   Returns dataset statistics and optionally a page of sample metadata.
 *   Query params:
 *     page=0       — sample listing page (20 per page)
 *     export=1     — attach signed download URLs to each sample
 *
 * Admin only (assertAdmin guard).
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';

const BUCKET   = 'training-data';
const PAGE_SIZE = 20;

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page      = Math.max(0, Number(searchParams.get('page') ?? 0));
  const wantUrls  = searchParams.get('export') === '1';

  const admin = adminDb();

  // ── Aggregate stats ────────────────────────────────────────────────────────
  const [statsRes, consentRes, stageRes, recentRes] = await Promise.all([
    // Total samples + total duration
    admin.from('training_samples')
      .select('duration_seconds', { count: 'exact' }),

    // Consented users count
    admin.from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('consent_data_collection', true),

    // Breakdown by stage
    admin.from('training_samples')
      .select('stage_id, duration_seconds'),

    // Recent samples page
    admin.from('training_samples')
      .select('id, session_id, user_id, storage_path, format, duration_seconds, stage_id, transcript, created_at')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
  ]);

  const samples     = statsRes.data ?? [];
  const totalCount  = statsRes.count ?? 0;
  const totalSecs   = samples.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
  const consentedUsers = consentRes.count ?? 0;

  // Stage breakdown
  const byStage = ((stageRes.data ?? []) as { stage_id: number | null; duration_seconds: number | null }[]).reduce(
    (acc, r) => {
      const k = String(r.stage_id ?? 'unknown');
      if (!acc[k]) acc[k] = { count: 0, seconds: 0 };
      acc[k].count++;
      acc[k].seconds += r.duration_seconds ?? 0;
      return acc;
    },
    {} as Record<string, { count: number; seconds: number }>,
  );

  // ── Attach signed URLs if requested ────────────────────────────────────────
  const recentSamples = await Promise.all(
    (recentRes.data ?? []).map(async (s) => {
      let signedUrl: string | null = null;
      if (wantUrls) {
        const { data } = await admin.storage
          .from(BUCKET)
          .createSignedUrl(s.storage_path, 3600); // 1-hour expiry
        signedUrl = data?.signedUrl ?? null;
      }
      return { ...s, signedUrl };
    }),
  );

  return NextResponse.json({
    stats: {
      total_samples:    totalCount,
      total_hours:      Math.round((totalSecs / 3600) * 100) / 100,
      total_minutes:    Math.round(totalSecs / 60),
      consented_users:  consentedUsers,
      by_stage:         byStage,
    },
    samples:   recentSamples,
    page,
    page_size: PAGE_SIZE,
    has_more:  recentSamples.length === PAGE_SIZE,
  });
}
