import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'data-room';
const SIGNED_URL_TTL = 120; // seconds

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── GET — list documents + invites ────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();
  const [docsRes, invitesRes] = await Promise.all([
    supabase.from('data_room_documents').select('*').order('created_at', { ascending: false }),
    supabase.from('data_room_invites').select('*').order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    documents: docsRes.data ?? [],
    invites:   invitesRes.data ?? [],
  });
}

// ── POST — actions ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';
  const supabase = db();

  // ── File upload (multipart) ─────────────────────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try { formData = await req.formData(); }
    catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }); }

    const ALLOWED_MIME_TYPES = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
    ]);

    const ALLOWED_CATEGORIES = new Set([
      'pitch', 'legal', 'financial', 'technical', 'general', 'investor-updates',
    ]);

    const file        = formData.get('file') as File | null;
    const title       = (formData.get('title') as string | null)?.trim();
    const rawCategory = formData.get('category') as string | null;
    const category    = ALLOWED_CATEGORIES.has(rawCategory ?? '') ? rawCategory : null;
    const description = (formData.get('description') as string | null)?.trim() ?? null;
    const version     = (formData.get('version') as string | null)?.trim() ?? 'v1';

    if (!file || !title || !category) {
      return NextResponse.json({ error: 'file, title, and category are required' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
    }

    const ext = file.name.split('.').pop() ?? '';
    const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const storagePath = `${category}/${safeName}-${Date.now()}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data, error: dbError } = await supabase.from('data_room_documents').insert({
      title, description, category, filename: file.name,
      storage_path: storagePath, file_size: file.size,
      mime_type: file.type, version,
    }).select().single();

    if (dbError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  }

  // ── JSON actions ────────────────────────────────────────────────────────────
  let body: { action: string; [key: string]: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action } = body;

  if (action === 'get_signed_url') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data: doc } = await supabase.from('data_room_documents').select('storage_path, title').eq('id', id).single();
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, SIGNED_URL_TTL);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ url: signed.signedUrl, filename: doc.title });
  }

  if (action === 'delete_document') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data: doc } = await supabase.from('data_room_documents').select('storage_path').eq('id', id).single();
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    const { error } = await supabase.from('data_room_documents').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'create_invite') {
    const { investor_name, investor_email, access_level, expires_at } = body as Record<string, string>;
    if (!investor_name || !investor_email || !expires_at) {
      return NextResponse.json({ error: 'investor_name, investor_email, and expires_at are required' }, { status: 400 });
    }
    const { data, error } = await supabase.from('data_room_invites').insert({
      investor_name, investor_email,
      access_level: access_level || 'standard',
      expires_at,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'revoke_invite') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('data_room_invites').update({ revoked: true }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_invite') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('data_room_invites').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
