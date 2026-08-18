/**
 * GET /api/admin/seedance/[jobId]
 *
 * Poll a Seedance video generation task.
 *
 * Query params:
 *   name — optional asset name to use when saving (defaults to dated label)
 *
 * Returns one of:
 *   { status: "pending" | "processing" }
 *   { status: "failed", error: string }
 *   { status: "succeeded", asset: AssetFile }   ← video saved to Supabase
 *
 * The save step (download → Supabase Storage → asset_files insert) is
 * idempotent: a second request that arrives while the video is already
 * saved returns the cached row immediately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { getVideoTask } from '@/lib/byteplus/seedance';
import { adminDb } from '@/lib/supabase/admin';

export const maxDuration = 60;

const BUCKET = 'assets';

// Tag used to deduplicate saves for the same BytePlus job.
function jobTag(jobId: string) {
  return `seedance-job:${jobId}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { jobId } = await params;
  const { searchParams } = new URL(req.url);
  const assetName = searchParams.get('name')?.trim() || null;

  // 1. Check BytePlus task status.
  let task;
  try {
    task = await getVideoTask(jobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[seedance/poll] getVideoTask failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Still generating — let the client keep polling.
  if (task.status === 'pending' || task.status === 'processing') {
    return NextResponse.json({ status: task.status });
  }

  if (task.status === 'failed') {
    return NextResponse.json({ status: 'failed', error: task.error ?? 'Generation failed' });
  }

  // 2. Succeeded — check if we already saved this job (idempotency).
  const db = adminDb();
  const { data: existing } = await db
    .from('asset_files')
    .select('*')
    .contains('tags', [jobTag(jobId)])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ status: 'succeeded', asset: existing });
  }

  // 3. Download the generated video from BytePlus.
  if (!task.video_url) {
    return NextResponse.json(
      { error: 'BytePlus returned succeeded but no video_url' },
      { status: 500 },
    );
  }

  let videoBuffer: Buffer;
  try {
    const videoRes = await fetch(task.video_url);
    if (!videoRes.ok) {
      throw new Error(`HTTP ${videoRes.status} fetching video from BytePlus`);
    }
    videoBuffer = Buffer.from(await videoRes.arrayBuffer());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[seedance/poll] video download failed:', msg);
    return NextResponse.json({ error: `Video download failed: ${msg}` }, { status: 500 });
  }

  // 4. Upload to Supabase Storage.
  const storagePath = `video/seedance-${jobId}-${Date.now()}.mp4`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, videoBuffer, {
      contentType: 'video/mp4',
      upsert: false,
    });

  if (uploadError) {
    console.error('[seedance/poll] storage upload failed:', uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(storagePath);

  // 5. Insert into asset_files.
  const displayName =
    assetName ??
    `Seedance Video · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const { data: asset, error: dbError } = await db
    .from('asset_files')
    .insert({
      name:         displayName,
      description:  `AI-generated video via BytePlus Seedance 2.0 · Job ${jobId}`,
      folder:       'video',
      filename:     `seedance-${jobId}.mp4`,
      storage_path: storagePath,
      public_url:   publicUrl,
      file_size:    videoBuffer.byteLength,
      mime_type:    'video/mp4',
      tags:         ['ai-generated', 'seedance', 'ads', jobTag(jobId)],
    })
    .select()
    .single();

  if (dbError) {
    // Roll back the storage upload so we don't leave orphaned files.
    await db.storage.from(BUCKET).remove([storagePath]);
    console.error('[seedance/poll] asset_files insert failed:', dbError.message);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'succeeded', asset });
}
