/**
 * POST /api/admin/compliance/upload
 *
 * Receives an evidence file for a compliance item, stores it in the
 * data-room bucket under dtac-evidence/{framework}/{item_code}/{filename},
 * and returns a long-lived signed URL (10-year TTL) ready to be saved
 * directly as compliance_items.evidence_url.
 *
 * Body: multipart/form-data
 *   file       File   — PDF, DOCX, XLSX, PNG, JPG (max 20 MB)
 *   framework  string — e.g. "dcb0129"
 *   item_code  string — e.g. "dcb0129_01"
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

const BUCKET   = 'data-room';
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
// ~10 years in seconds — effectively permanent for a compliance dashboard
const URL_TTL  = 315_360_000;

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
]);

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 }); }

  const file      = formData.get('file')      as File   | null;
  const framework = formData.get('framework') as string | null;
  const itemCode  = formData.get('item_code') as string | null;

  if (!file)      return NextResponse.json({ error: 'No file provided' },       { status: 400 });
  if (!framework) return NextResponse.json({ error: 'framework is required' },  { status: 400 });
  if (!itemCode)  return NextResponse.json({ error: 'item_code is required' },  { status: 400 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large — maximum 20 MB' }, { status: 413 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'File type not allowed. Accepted: PDF, Word, Excel, PNG, JPG, TXT' },
      { status: 415 },
    );
  }

  // Sanitise filename — strip path components, collapse whitespace
  const safeName = file.name
    .replace(/[/\\]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120)
    || 'evidence';

  const storagePath = `dtac-evidence/${framework}/${itemCode}/${safeName}`;

  const supabase = db();
  const buffer   = await file.arrayBuffer();

  // Upsert so re-uploads of the same filename replace rather than error
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadErr) {
    console.error('[compliance/upload] storage error:', uploadErr.message);
    return NextResponse.json({ error: 'Upload failed: ' + uploadErr.message }, { status: 500 });
  }

  // Generate a long-lived signed URL (~10 years)
  const { data: signedData, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, URL_TTL);

  if (urlErr || !signedData?.signedUrl) {
    console.error('[compliance/upload] signed URL error:', urlErr?.message);
    return NextResponse.json({ error: 'Upload succeeded but could not generate URL' }, { status: 500 });
  }

  await logAuditEvent({
    actor_id:      admin.id,
    action:        'evidence_uploaded',
    resource_type: 'compliance_item',
    resource_id:   itemCode,
    metadata:      { framework, filename: safeName, size: file.size },
  });

  return NextResponse.json({ url: signedData.signedUrl, path: storagePath });
}
