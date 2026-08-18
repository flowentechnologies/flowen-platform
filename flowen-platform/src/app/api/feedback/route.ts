import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { adminDb as db } from '@/lib/supabase/admin';

// POST /api/feedback — submit in-app feedback (auth optional but preferred)
export async function POST(req: Request) {
  let body: { type?: string; rating?: number; comment?: string; page?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type = 'general', rating, comment, page } = body;

  if (!comment?.trim() && !rating) {
    return NextResponse.json({ error: 'comment or rating required' }, { status: 400 });
  }

  // Try to resolve the user — feedback is valid even unauthenticated
  let userId: string | null = null;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* unauthenticated */ }

  const { error } = await db().from('feedback').insert({
    user_id: userId,
    type,
    rating:  rating ?? null,
    comment: comment?.trim() || null,
    page:    page ?? null,
  });

  if (error) {
    console.error('[feedback POST]', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
