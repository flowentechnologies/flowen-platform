import { adminDb as db } from '@/lib/supabase/admin';

export async function logAuditEvent(params: {
  actor_email?: string;
  actor_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  severity?: 'info' | 'warning' | 'critical';
}): Promise<void> {
  try {
    await db().from('audit_log').insert({
      actor_email: params.actor_email ?? null,
      actor_id: params.actor_id ?? null,
      action: params.action,
      resource_type: params.resource_type ?? null,
      resource_id: params.resource_id ?? null,
      metadata: params.metadata ?? null,
      ip_address: params.ip_address ?? null,
      severity: params.severity ?? 'info',
    });
  } catch {
    // Fire-and-forget: never surface errors to callers
  }
}
