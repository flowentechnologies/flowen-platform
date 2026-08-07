import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { getRecentAuditLogs, logAuditEvent } from '@/lib/audit/auditLogger';
import type { AuditCategory, AuditSeverity } from '@/lib/audit/auditLogger';

const VALID_CATEGORIES: AuditCategory[] = [
  'AUTH_EVENT', 'CLINICAL_ACCESS', 'TELEMETRY_INGEST',
  'DATA_EXPORT', 'ADMIN_ACTION', 'PAYMENT_EVENT',
];

const VALID_SEVERITIES: AuditSeverity[] = [
  'INFO', 'WARNING', 'CRITICAL', 'SECURITY_ALERT',
];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const logs = await getRecentAuditLogs();
  return NextResponse.json({ status: 'success', total: logs.length, logs });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    // Validate against the type-union so arbitrary strings can't pollute the log.
    const category: AuditCategory =
      VALID_CATEGORIES.includes(body.category) ? body.category : 'ADMIN_ACTION';
    const severity: AuditSeverity =
      VALID_SEVERITIES.includes(body.severity) ? body.severity : 'INFO';

    const event = await logAuditEvent({
      severity,
      category,
      actorId:    admin.id,
      actorRole:  'ADMIN',
      action:     typeof body.action === 'string' ? body.action : 'CUSTOM_AUDIT_EVENT',
      resourceId: typeof body.resourceId === 'string' ? body.resourceId : undefined,
      metadata:   body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
    });
    return NextResponse.json({ status: 'created', event });
  } catch {
    return NextResponse.json({ error: 'Invalid audit payload' }, { status: 400 });
  }
}
