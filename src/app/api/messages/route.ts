import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface OtherUser {
  id: string;
  display_name: string | null;
  email: string | null;
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getUser() {
  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await ssr.auth.getUser();
  return user;
}

async function verifyAssignment(admin: ReturnType<typeof db>, userId1: string, userId2: string): Promise<boolean> {
  const { data } = await admin
    .from('slp_assignments')
    .select('id')
    .or(`and(slp_user_id.eq.${userId1},patient_user_id.eq.${userId2}),and(slp_user_id.eq.${userId2},patient_user_id.eq.${userId1})`)
    .maybeSingle();
  return !!data;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const them = searchParams.get('with');
  if (!them) return NextResponse.json({ error: 'Missing ?with= parameter' }, { status: 400 });

  const admin = db();

  const assigned = await verifyAssignment(admin, user.id, them);
  if (!assigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [messagesRes, otherUserRes] = await Promise.all([
    admin
      .from('slp_messages')
      .select('id, from_user_id, to_user_id, content, read_at, created_at')
      .in('from_user_id', [user.id, them])
      .in('to_user_id', [user.id, them])
      .order('created_at', { ascending: true })
      .limit(100),
    admin
      .from('profiles')
      .select('id, display_name, email')
      .eq('id', them)
      .single(),
  ]);

  // Mark unread messages sent to me as read
  await admin
    .from('slp_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('to_user_id', user.id)
    .eq('from_user_id', them)
    .is('read_at', null);

  const messages: Message[] = (messagesRes.data ?? []) as Message[];
  const otherUser: OtherUser = {
    id: them,
    display_name: otherUserRes.data?.display_name ?? null,
    email: otherUserRes.data?.email ?? null,
  };

  return NextResponse.json({ messages, other_user: otherUser });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { to_user_id?: string; content?: string };
  try {
    body = await request.json() as { to_user_id?: string; content?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { to_user_id, content } = body;
  if (!to_user_id || typeof content !== 'string') {
    return NextResponse.json({ error: 'Missing to_user_id or content' }, { status: 400 });
  }

  const trimmed = content.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) {
    return NextResponse.json({ error: 'Content must be 1–2000 characters' }, { status: 400 });
  }

  const admin = db();

  const assigned = await verifyAssignment(admin, user.id, to_user_id);
  if (!assigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: message, error } = await admin
    .from('slp_messages')
    .insert({ from_user_id: user.id, to_user_id, content: trimmed })
    .select('id, from_user_id, to_user_id, content, read_at, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message }, { status: 201 });
}
