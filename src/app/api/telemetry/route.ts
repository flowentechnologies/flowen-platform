import { NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/audit/auditLogger';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    await logAuditEvent({
      severity: 'INFO',
      category: 'TELEMETRY_INGEST',
      actorId: data.userId || 'usr_patient_anon',
      actorRole: 'PATIENT',
      action: 'INGEST_ACOUSTIC_TELEMETRY',
      resourceId: data.sessionId || 'sess_live',
      metadata: { pitchSmoothness: data.pitchSmoothness, hesitationCount: data.hesitationCount },
    });
    return NextResponse.json({ status: 'telemetry_processed' });
  } catch {
    return NextResponse.json({ error: 'Telemetry ingest failed' }, { status: 400 });
  }
}
