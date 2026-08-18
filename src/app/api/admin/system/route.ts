import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action: string; errorId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action, errorId } = body;

  if (action === 'resolve_error') {
    if (!errorId) return NextResponse.json({ error: 'errorId required' }, { status: 400 });
    const { error } = await db().from('system_error_logs').update({ resolved: true }).eq('id', errorId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_error') {
    if (!errorId) return NextResponse.json({ error: 'errorId required' }, { status: 400 });
    const { error } = await db().from('system_error_logs').delete().eq('id', errorId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
