import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecentAuditLogs, logAuditEvent } from '@/lib/audit/auditLogger';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  return profile?.is_admin ? user : null;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const logs = getRecentAuditLogs();
  return NextResponse.json({
    status: 'success',
    total: logs.length,
    complianceStatus: { gdpr: 'PARTIAL', dcb0129: 'IN_PROGRESS' },
    logs,
  });
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const event = await logAuditEvent({
      severity: body.severity || 'INFO',
      category: body.category || 'ADMIN_ACTION',
      actorId: user.id,
      actorRole: body.actorRole || 'ADMIN',
      action: body.action || 'CUSTOM_AUDIT_EVENT',
      resourceId: body.resourceId,
      metadata: body.metadata,
    });
    return NextResponse.json({ status: 'created', event });
  } catch {
    return NextResponse.json({ error: 'Invalid audit payload' }, { status: 400 });
  }
}
