import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

// ── Exported types ────────────────────────────────────────────────────────────

export interface FunnelStage {
  label: string;
  count: number;
  pct_of_top: number;   // % of waitlist total
  pct_of_prev: number;  // % conversion from previous stage
}

export interface FunnelData {
  stages: FunnelStage[];                                     // 5 stages in order
  waitlist_sources: { source: string; count: number }[];     // breakdown by source
  top_drop_off_stage: string;                                // stage with worst prev-stage conversion
  week_over_week_signups: number;                            // new waitlist entries in last 7 days
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  // ── Parallel fetches ──────────────────────────────────────────────────────
  const [
    waitlistTotalRes,
    profilesTotalRes,
    onboardedRes,
    firstSessionRes,
    payingRes,
    weekSignupsRes,
    sourcesRes,
  ] = await Promise.all([
    // 1. Waitlist total
    client.from('waitlist_signups').select('*', { count: 'exact', head: true }),

    // 2. Profiles total (signed up)
    client.from('profiles').select('*', { count: 'exact', head: true }),

    // 3. Onboarded
    client.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true),

    // 4. Users with ≥1 practice session (distinct user_ids)
    client.from('practice_sessions').select('user_id'),

    // 5. Paying: profiles where tier is set and not freemium
    client
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('tier', 'is', null)
      .not('tier', 'eq', '')
      .not('tier', 'eq', 'vocali_freemium'),

    // 6. New waitlist signups in last 7 days
    client
      .from('waitlist_signups')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),

    // 7. Waitlist source breakdown (graceful if column missing)
    client.from('waitlist_signups').select('source'),
  ]);

  // ── Counts ────────────────────────────────────────────────────────────────
  const waitlistTotal   = waitlistTotalRes.count   ?? 0;
  const profilesTotal   = profilesTotalRes.count   ?? 0;
  const onboardedCount  = onboardedRes.count        ?? 0;
  const weekSignups     = weekSignupsRes.count       ?? 0;
  const payingCount     = payingRes.count            ?? 0;

  // Distinct user_id count from practice_sessions
  const firstSessionCount = firstSessionRes.error
    ? 0
    : new Set((firstSessionRes.data ?? []).map((r: { user_id: string }) => r.user_id)).size;

  // ── Source breakdown ──────────────────────────────────────────────────────
  let waitlist_sources: { source: string; count: number }[] = [];
  if (!sourcesRes.error && sourcesRes.data) {
    const tally: Record<string, number> = {};
    for (const row of sourcesRes.data as { source: string | null }[]) {
      const src = row.source ?? 'unknown';
      tally[src] = (tally[src] ?? 0) + 1;
    }
    waitlist_sources = Object.entries(tally)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ── Build stages ──────────────────────────────────────────────────────────
  const rawStages: { label: string; count: number }[] = [
    { label: 'Waitlist',      count: waitlistTotal   },
    { label: 'Signed Up',     count: profilesTotal   },
    { label: 'Onboarded',     count: onboardedCount  },
    { label: 'First Session', count: firstSessionCount },
    { label: 'Paying',        count: payingCount      },
  ];

  const stages: FunnelStage[] = rawStages.map((stage, i) => ({
    label:       stage.label,
    count:       stage.count,
    pct_of_top:  safePct(stage.count, waitlistTotal),
    pct_of_prev: i === 0 ? 100 : safePct(stage.count, rawStages[i - 1].count),
  }));

  // ── Top drop-off: stage with lowest pct_of_prev (excluding stage 0) ───────
  const top_drop_off_stage = stages
    .slice(1)
    .reduce((worst, s) => s.pct_of_prev < worst.pct_of_prev ? s : worst, stages[1])
    .label;

  const data: FunnelData = {
    stages,
    waitlist_sources,
    top_drop_off_stage,
    week_over_week_signups: weekSignups,
  };

  return NextResponse.json(data);
}
