import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

const BUCKET = 'assets';

// ── POST — upload (multipart) or JSON actions ──────────────────────────────────

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

    const ALLOWED_FOLDERS = new Set(['general', 'images', 'audio', 'video', 'documents', 'brand']);

    const file        = formData.get('file') as File | null;
    const name        = (formData.get('name') as string | null)?.trim();
    const rawFolder   = (formData.get('folder') as string | null)?.trim() ?? 'general';
    const folder      = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : 'general';
    const description = (formData.get('description') as string | null)?.trim() ?? null;
    const tagsRaw     = (formData.get('tags') as string | null)?.trim() ?? '';

    if (!file || !name) {
      return NextResponse.json({ error: 'file and name are required' }, { status: 400 });
    }

    const tags = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const ext = file.name.split('.').pop() ?? '';
    const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const storagePath = `${folder}/${safeName}-${Date.now()}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const { data, error: dbError } = await supabase.from('asset_files').insert({
      name,
      description,
      folder,
      filename: file.name,
      storage_path: storagePath,
      public_url: publicUrl,
      file_size: file.size,
      mime_type: file.type,
      tags,
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

  if (action === 'delete_asset') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: asset } = await supabase
      .from('asset_files')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    await supabase.storage.from(BUCKET).remove([asset.storage_path]);

    const { error } = await supabase.from('asset_files').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
