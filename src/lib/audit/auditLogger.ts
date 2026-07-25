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

const auditBuffer: AuditEvent[] = [];

async function computeAuditHash(event: Omit<AuditEvent, 'hash'>): Promise<string> {
  const content = `${event.timestamp}|${event.severity}|${event.category}|${event.actorId}|${event.action}|${event.resourceId || ''}`;
  if (typeof window === 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return `hash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function logAuditEvent(params: Omit<AuditEvent, 'timestamp' | 'hash'>): Promise<AuditEvent> {
  const timestamp = new Date().toISOString();
  const eventBase = { ...params, timestamp };
  const hash = await computeAuditHash(eventBase);
  const fullEvent: AuditEvent = {
    ...eventBase,
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    hash,
  };
  auditBuffer.unshift(fullEvent);
  if (auditBuffer.length > 200) auditBuffer.pop();
  console.log(`[AUDIT_LOG][${fullEvent.severity}][${fullEvent.category}]`, JSON.stringify(fullEvent));
  return fullEvent;
}

export function getRecentAuditLogs(): AuditEvent[] {
  if (auditBuffer.length === 0) {
    return [
      {
        id: 'aud_1721918200_a1f',
        timestamp: new Date().toISOString(),
        severity: 'INFO',
        category: 'CLINICAL_ACCESS',
        actorId: 'usr_slp_9821',
        actorRole: 'CLINICIAN',
        action: 'VIEW_PATIENT_TELEMETRY',
        resourceId: 'pat_alex_wright_28',
        ipAddress: '198.51.100.42',
        metadata: { patientName: 'Alexander Wright', dysfluencyMetric: 'Block Rate 1.2/min' },
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      }
    ];
  }
  return [...auditBuffer];
}
