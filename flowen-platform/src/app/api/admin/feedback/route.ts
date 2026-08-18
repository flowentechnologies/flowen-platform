import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db()
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ feedback: data ?? [] });
}
