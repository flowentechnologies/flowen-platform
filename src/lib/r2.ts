// ── Cloudflare R2 storage helper ────────────────────────────────────────────────
// R2 is S3-compatible, so this uses the standard AWS SDK v3 S3 client pointed
// at R2's endpoint (https://<account_id>.r2.cloudflarestorage.com) rather than
// a Cloudflare-specific SDK. Region is always 'auto' — R2 buckets aren't
// regional the way S3 buckets are.
//
// First (and currently only) consumer: practice session audio recordings —
// see src/app/api/practice/sessions/[id]/recording/route.ts. Chosen as the
// pilot bucket because it's the highest-volume, highest-egress storage this
// app does; R2 has zero egress fees, unlike Supabase Storage's underlying S3.
// Other buckets (training-data, assets, data-room, backups) stay on Supabase
// Storage for now — see the recommendation captured when this was scoped.
//
// SECURITY: server-only. Never import from a client component — it reads the
// R2 secret access key.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let client: S3Client | null = null;

/** True once all four STORAGE_R2_* env vars are set. Callers should fall
 *  back to the existing Supabase Storage path when this is false, rather
 *  than failing — R2 credentials are added by the user after this code
 *  ships (same rotation pattern as every other integration this session). */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.STORAGE_R2_ACCOUNT_ID &&
    process.env.STORAGE_R2_ACCESS_KEY_ID &&
    process.env.STORAGE_R2_SECRET_ACCESS_KEY &&
    process.env.STORAGE_R2_BUCKET_NAME,
  );
}

function getR2Client(): S3Client {
  if (client) return client;

  const accountId = process.env.STORAGE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.STORAGE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 not configured — check isR2Configured() before calling r2.ts functions.');
  }

  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

function bucketName(): string {
  const bucket = process.env.STORAGE_R2_BUCKET_NAME;
  if (!bucket) throw new Error('STORAGE_R2_BUCKET_NAME not set.');
  return bucket;
}

/** Uploads a buffer to the configured R2 bucket at `key`. */
export async function uploadToR2(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
  await getR2Client().send(new PutObjectCommand({
    Bucket: bucketName(),
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

/** Returns a time-limited signed URL to GET the object at `key`. */
export async function getR2SignedUrl(key: string, ttlSeconds: number): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucketName(), Key: key });
  return getSignedUrl(getR2Client(), command, { expiresIn: ttlSeconds });
}

/** Deletes the object at `key`. Best-effort — callers should log, not throw, on failure. */
export async function deleteFromR2(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
}
