import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendNpsSurvey } from '@/lib/email';
import { randomUUID } from 'crypto';

// Temporary one-shot route — delete after use
export async function POST(req: Request) {
  const { email, displayName } = await req.json().catch(() => ({}));
  if (!email || !displayName) {
    return NextResponse.json({ error: 'email and displayName required' }, { status: 400 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const token = randomUUID();

  await db.from('nps_responses').insert({
    email,
    survey_token: token,
    source:       'email',
    sent_at:      new Date().toISOString(),
  });

  await sendNpsSurvey({ email, displayName, token });

  return NextResponse.json({ ok: true, token });
}
