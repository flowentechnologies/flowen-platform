import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin/guard';
import { sendProductUpdate, type ChangelogRelease } from '@/lib/email';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── POST /api/admin/changelog ─────────────────────────────────────────────────
//
// Body: { release: ChangelogRelease, audience: 'all' | 'subscribers' | 'test', testEmail?: string }
//
// - test      → sends only to testEmail (for preview before broadcast)
// - subscribers → users with an active subscription
// - all       → every profile with a confirmed email

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { release: ChangelogRelease; audience: string; testEmail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { release, audience, testEmail } = body;

  if (!release?.version || !release?.items?.length) {
    return NextResponse.json({ error: 'release.version and release.items are required' }, { status: 400 });
  }

  if (!['all', 'subscribers', 'test'].includes(audience)) {
    return NextResponse.json({ error: 'audience must be "all", "subscribers", or "test"' }, { status: 400 });
  }

  if (audience === 'test') {
    if (!testEmail) return NextResponse.json({ error: 'testEmail is required for test audience' }, { status: 400 });
    const ok = await sendProductUpdate({ to: testEmail, release });
    return NextResponse.json({ sent: ok ? 1 : 0, failed: ok ? 0 : 1, total: 1, audience: 'test' });
  }

  // ── Collect recipient emails ─────────────────────────────────────────────────

  const supabase = db();
  let query = supabase
    .from('profiles')
    .select('id, email')
    .not('email', 'is', null);

  if (audience === 'subscribers') {
    // Only users with an active or trialling subscription
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('user_id')
      .in('status', ['active', 'trialing']);

    const activeIds = (subs ?? []).map((s: { user_id: string }) => s.user_id);
    if (activeIds.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, total: 0, audience: 'subscribers', note: 'No active subscribers found' });
    }
    query = query.in('id', activeIds);
  }

  const { data: profiles, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const recipients = (profiles ?? [])
    .map((p: { id: string; email: string }) => ({ id: p.id, email: p.email }))
    .filter(p => p.email);

  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, audience });
  }

  // ── Send in batches of 20 to stay within Resend rate limits ─────────────────

  const BATCH = 20;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const emails = batch.map(p => p.email);

    const ok = await sendProductUpdate({ to: emails, release });

    if (ok) {
      sent += batch.length;

      // Log to notification_log for each recipient in the batch
      const logs = batch.map(p => ({
        user_id: p.id,
        type: 'product_update',
        metadata: { version: release.version, audience },
      }));
      await supabase.from('notification_log').insert(logs);
    } else {
      failed += batch.length;
    }
  }

  return NextResponse.json({ sent, failed, total: recipients.length, audience, version: release.version });
}

// ── GET /api/admin/changelog?action=history ───────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = new URL(req.url).searchParams.get('action');

  if (action !== 'history') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from('notification_log')
    .select('id, user_id, metadata, created_at')
    .eq('type', 'product_update')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Summarise by version
  const byVersion = new Map<string, { version: string; sent_at: string; count: number }>();
  for (const row of (data ?? [])) {
    const version = (row.metadata as { version?: string })?.version ?? 'unknown';
    if (!byVersion.has(version)) {
      byVersion.set(version, { version, sent_at: row.created_at, count: 0 });
    }
    byVersion.get(version)!.count++;
  }

  return NextResponse.json({ history: [...byVersion.values()].sort((a, b) => b.sent_at.localeCompare(a.sent_at)) });
}
