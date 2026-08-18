import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

export interface AuditEntry {
  id: string;
  actor_email: string | null;
  actor_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}

// Realistic seed entries covering a range of admin actions
const SEED_ENTRIES: Omit<AuditEntry, 'id' | 'created_at'>[] = [
  {
    actor_email: 'admin@flowen.digital',
    actor_id: null,
    action: 'user.delete',
    resource_type: 'user',
    resource_id: 'usr_8a2f1c',
    metadata: { reason: 'Account closure requested', email: 'jane.doe@example.com' },
    ip_address: '82.45.123.9',
    severity: 'critical',
  },
  {
    actor_email: 'admin@flowen.digital',
    actor_id: null,
    action: 'gdpr.export_requested',
    resource_type: 'user',
    resource_id: 'usr_3b9e44',
    metadata: { format: 'json', email: 'john.smith@nhs.net' },
    ip_address: '82.45.123.9',
    severity: 'warning',
  },
  {
    actor_email: 'admin@flowen.digital',
    actor_id: null,
    action: 'investor.add',
    resource_type: 'investor',
    resource_id: 'inv_f71d2a',
    metadata: { name: 'Meridian Health Ventures', tier: 'Series A' },
    ip_address: '82.45.123.9',
    severity: 'info',
  },
  {
    actor_email: 'ops@flowen.digital',
    actor_id: null,
    action: 'compliance.status_update',
    resource_type: 'compliance_item',
    resource_id: 'dcb0129_03',
    metadata: { old_status: 'in_progress', new_status: 'complete', framework: 'dcb0129' },
    ip_address: '31.22.87.14',
    severity: 'info',
  },
  {
    actor_email: 'admin@flowen.digital',
    actor_id: null,
    action: 'hazard.add',
    resource_type: 'hazard',
    resource_id: 'haz_012',
    metadata: { title: 'Incorrect dosage suggestion', severity_rating: 'major', likelihood: 'unlikely' },
    ip_address: '82.45.123.9',
    severity: 'warning',
  },
  {
    actor_email: 'admin@flowen.digital',
    actor_id: null,
    action: 'deck.invite_created',
    resource_type: 'pitch_deck',
    resource_id: 'deck_a4c9',
    metadata: { recipient_email: 'investor@vcfirm.co.uk', expires_in_days: 7 },
    ip_address: '82.45.123.9',
    severity: 'info',
  },
  {
    actor_email: 'ops@flowen.digital',
    actor_id: null,
    action: 'staff.invite_sent',
    resource_type: 'staff',
    resource_id: 'staff_new_007',
    metadata: { invited_email: 'clinician@nhs.net', role: 'clinical_reviewer' },
    ip_address: '31.22.87.14',
    severity: 'info',
  },
  {
    actor_email: 'admin@flowen.digital',
    actor_id: null,
    action: 'billing.refund_issued',
    resource_type: 'subscription',
    resource_id: 'sub_stripe_abc123',
    metadata: { amount_pence: 4999, reason: 'Duplicate charge', stripe_refund_id: 're_3Pxx' },
    ip_address: '82.45.123.9',
    severity: 'warning',
  },
  {
    actor_email: 'admin@flowen.digital',
    actor_id: null,
    action: 'user.toggle_admin',
    resource_type: 'user',
    resource_id: 'usr_9d1f77',
    metadata: { email: 'newadmin@flowen.digital', new_is_admin: true },
    ip_address: '82.45.123.9',
    severity: 'critical',
  },
  {
    actor_email: 'ops@flowen.digital',
    actor_id: null,
    action: 'data_room.document_uploaded',
    resource_type: 'data_room_doc',
    resource_id: 'doc_0055',
    metadata: { filename: 'Clinical_Safety_Case_v2.pdf', category: 'regulatory' },
    ip_address: '31.22.87.14',
    severity: 'info',
  },
  {
    actor_email: 'admin@flowen.digital',
    actor_id: null,
    action: 'workflow.trigger',
    resource_type: 'workflow',
    resource_id: 'wf_onboarding_v3',
    metadata: { triggered_for: 'usr_3b9e44', step: 'send_welcome_email' },
    ip_address: '82.45.123.9',
    severity: 'info',
  },
  {
    actor_email: 'ops@flowen.digital',
    actor_id: null,
    action: 'gdpr.data_deleted',
    resource_type: 'user',
    resource_id: 'usr_b2c5ff',
    metadata: { tables_cleared: ['profiles', 'sessions', 'analytics_events'], requester: 'user_self' },
    ip_address: '31.22.87.14',
    severity: 'critical',
  },
  {
    actor_email: 'admin@flowen.digital',
    actor_id: null,
    action: 'ip.asset_registered',
    resource_type: 'ip_asset',
    resource_id: 'ip_flowen_core_algo',
    metadata: { type: 'copyright', description: 'Speech therapy AI core algorithm' },
    ip_address: '82.45.123.9',
    severity: 'info',
  },
  {
    actor_email: 'ops@flowen.digital',
    actor_id: null,
    action: 'cron.job_failed',
    resource_type: 'cron_job',
    resource_id: 'cron_telemetry_flush',
    metadata: { error: 'Connection timeout', retries: 3 },
    ip_address: null,
    severity: 'warning',
  },
  {
    actor_email: 'admin@flowen.digital',
    actor_id: null,
    action: 'investor.update',
    resource_type: 'investor',
    resource_id: 'inv_f71d2a',
    metadata: { field: 'commitment_amount', old: 250000, new: 500000 },
    ip_address: '82.45.123.9',
    severity: 'info',
  },
];

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const severity = searchParams.get('severity') ?? 'all';
  const action = searchParams.get('action') ?? '';
  const search = searchParams.get('search') ?? '';
  const dateRange = searchParams.get('dateRange') ?? 'all';

  const client = db();

  try {
    let query = client
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (severity !== 'all') {
      query = query.eq('severity', severity);
    }

    if (action) {
      query = query.ilike('action', `%${action}%`);
    }

    if (search) {
      query = query.or(`action.ilike.%${search}%,actor_email.ilike.%${search}%`);
    }

    if (dateRange === '24h') {
      query = query.gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    } else if (dateRange === '7d') {
      query = query.gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    } else if (dateRange === '30d') {
      query = query.gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    }

    const from = page * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        return NextResponse.json({ entries: [], total: 0 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: (data ?? []) as AuditEntry[], total: count ?? 0 });
  } catch {
    return NextResponse.json({ entries: [], total: 0 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const client = db();

  if (body.action === 'seed') {
    try {
      // Only seed if fewer than 5 rows exist
      const { count } = await client
        .from('audit_log')
        .select('id', { count: 'exact', head: true });

      if ((count ?? 0) >= 5) {
        return NextResponse.json({ seeded: false, reason: 'Already has data' });
      }

      // Spread entries across the last 30 days for realistic timestamps
      const now = Date.now();
      const entries = SEED_ENTRIES.map((entry, i) => {
        const offsetMs = (i / SEED_ENTRIES.length) * 30 * 24 * 60 * 60 * 1000;
        return {
          ...entry,
          created_at: new Date(now - offsetMs).toISOString(),
        };
      });

      const { error } = await client.from('audit_log').insert(entries);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ seeded: true, count: entries.length });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
}
