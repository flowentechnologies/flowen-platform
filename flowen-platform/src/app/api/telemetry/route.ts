import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit/auditLogger';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    await logAuditEvent({
      severity: 'INFO',
      category: 'TELEMETRY_INGEST',
      actorId: user.id,
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
