import { adminDb } from '@/lib/supabase/admin';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SECURITY_ALERT';
export type AuditCategory = 'AUTH_EVENT' | 'CLINICAL_ACCESS' | 'TELEMETRY_INGEST' | 'DATA_EXPORT' | 'ADMIN_ACTION' | 'PAYMENT_EVENT';

export interface AuditEvent {
  id?: string;
  timestamp: string;
  severity: AuditSeverity;
  category: AuditCategory;
  actorId: string;
  actorRole: 'PATIENT' | 'CLINICIAN' | 'ADMIN' | 'SYSTEM';
  action: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  hash?: string;
}

async function computeHash(event: Omit<AuditEvent, 'hash'>): Promise<string> {
  const content = `${event.timestamp}|${event.severity}|${event.category}|${event.actorId}|${event.action}|${event.resourceId ?? ''}`;
  if (typeof window === 'undefined' && globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(content);
    const buf  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return `hash_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function logAuditEvent(params: Omit<AuditEvent, 'timestamp' | 'hash'>): Promise<AuditEvent> {
  const timestamp = new Date().toISOString();
  const base = { ...params, timestamp };
  const hash = await computeHash(base);
  const event: AuditEvent = {
    ...base,
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    hash,
  };

  try {
    await adminDb().from('audit_logs').insert({
      id:          event.id,
      timestamp:   event.timestamp,
      severity:    event.severity,
      category:    event.category,
      actor_id:    event.actorId,
      actor_role:  event.actorRole,
      action:      event.action,
      resource_id: event.resourceId,
      ip_address:  event.ipAddress,
      user_agent:  event.userAgent,
      metadata:    event.metadata,
      hash:        event.hash,
    }).then(({ error }) => {
      if (error) console.error('[AUDIT] DB write failed:', error.message);
    });
  } catch (err) {
    console.error('[AUDIT] DB write failed:', (err as Error).message);
  }

  console.log(`[AUDIT][${event.severity}][${event.category}]`, event.actorId, event.action);
  return event;
}

export async function getRecentAuditLogs(limit = 100): Promise<AuditEvent[]> {
  const { data, error } = await adminDb()
    .from('audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[AUDIT] Failed to fetch logs:', error.message);
    return [];
  }

  return (data ?? []).map(row => ({
    id:         row.id,
    timestamp:  row.timestamp,
    severity:   row.severity as AuditSeverity,
    category:   row.category as AuditCategory,
    actorId:    row.actor_id,
    actorRole:  row.actor_role,
    action:     row.action,
    resourceId: row.resource_id,
    ipAddress:  row.ip_address,
    userAgent:  row.user_agent,
    metadata:   row.metadata,
    hash:       row.hash,
  }));
}
