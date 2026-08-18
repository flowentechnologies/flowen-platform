import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendAdminSupportTicketAlert } from '@/lib/email';
import { adminDb as db } from '@/lib/supabase/admin';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { subject: string; body: string; category: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { subject, body: message, category } = body;
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Subject and message are required.' }, { status: 400 });
  }

  const VALID_CATEGORIES = ['general', 'billing', 'technical', 'clinical', 'account', 'bug'];
  const safeCategory = VALID_CATEGORIES.includes(category) ? category : 'general';

  const slaHours: Record<string, number> = { bug: 4, billing: 8, technical: 24, general: 48, clinical: 24, account: 24 };
  const slaMs = (slaHours[safeCategory] ?? 48) * 3600_000;
  const slaDueAt = new Date(Date.now() + slaMs).toISOString();

  const { data, error } = await db()
    .from('support_tickets')
    .insert({
      subject:     subject.trim().slice(0, 200),
      body:        message.trim().slice(0, 5000),
      category:    safeCategory,
      user_email:  user.email ?? '',
      sla_due_at:  slaDueAt,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void sendAdminSupportTicketAlert({
    userEmail: user.email ?? '',
    subject:   subject.trim().slice(0, 200),
    body:      message.trim().slice(0, 1000),
    category:  safeCategory,
    ticketId:  data.id as string,
    slaDueAt,
  });

  return NextResponse.json({ id: data.id });
}
