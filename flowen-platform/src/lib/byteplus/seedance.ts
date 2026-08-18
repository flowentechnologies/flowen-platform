/**
 * BytePlus Seedance 2.0 — server-side REST client.
 *
 * Documentation: https://docs.byteplus.com
 * Console:       https://console.byteplus.com
 *
 * Required env vars:
 *   BYTEPLUS_API_KEY   — API key from BytePlus console (never NEXT_PUBLIC_)
 *
 * Optional env vars:
 *   BYTEPLUS_API_BASE  — override the base URL if BytePlus changes it
 *                        default: https://api.byteplus.com/seedance/v1
 */

import 'server-only';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SeedanceModel =
  | 'seedance-2.0'
  | 'seedance-2.0-pro'
  | 'seedance-2.0-fast';

export type SeedanceRatio =
  | '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';

export type SeedanceResolution = '480p' | '720p' | '1080p' | '2k';

export type SeedanceStyle =
  | 'cinematic' | 'anime' | 'realistic' | '3d_render' | '';

export interface SeedanceTaskParams {
  prompt:           string;
  model?:           SeedanceModel;
  aspect_ratio?:    SeedanceRatio;
  resolution?:      SeedanceResolution;
  duration?:        number;          // 4–15 seconds
  audio?:           boolean;
  style?:           SeedanceStyle;
  negative_prompt?: string;
  seed?:            number;
}

export type SeedanceStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

export interface SeedanceTaskResult {
  status:     SeedanceStatus;
  video_url?: string;
  error?:     string;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

const BASE =
  (process.env.BYTEPLUS_API_BASE ?? 'https://api.byteplus.com/seedance/v1')
    .replace(/\/$/, '');

function key(): string {
  const k = process.env.BYTEPLUS_API_KEY;
  if (!k) {
    throw new Error(
      '[seedance] BYTEPLUS_API_KEY is not set — add it to Vercel env vars',
    );
  }
  return k;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization:  `Bearer ${key()}`,
    'Content-Type': 'application/json',
  };
}

/** Normalise the status string across BytePlus API variants. */
function normaliseStatus(raw: string): SeedanceStatus {
  const s = raw.toLowerCase();
  if (s === 'completed' || s === 'succeeded' || s === 'success') return 'succeeded';
  if (s === 'failed'    || s === 'error')                        return 'failed';
  if (s === 'running'   || s === 'processing' || s === 'in_progress') return 'processing';
  return 'pending';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Submit a text-to-video generation task.
 * Returns the job ID to poll with `getVideoTask`.
 */
export async function createVideoTask(
  params: SeedanceTaskParams,
): Promise<string> {
  const body = {
    model:        params.model       ?? 'seedance-2.0',
    prompt:       params.prompt.slice(0, 2000),
    resolution:   params.resolution  ?? '720p',
    duration:     Math.min(15, Math.max(4, params.duration ?? 8)),
    aspect_ratio: params.aspect_ratio ?? '16:9',
    audio:        params.audio !== false,
    ...(params.style           && { style:           params.style }),
    ...(params.negative_prompt && { negative_prompt: params.negative_prompt }),
    ...(params.seed !== undefined && { seed:          params.seed }),
  };

  const res = await fetch(`${BASE}/videos`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`[seedance] submit failed (HTTP ${res.status}): ${err}`);
  }

  const data = await res.json() as Record<string, unknown>;

  // Accept several possible field names for the job ID.
  const id =
    data?.id       ??
    data?.job_id   ??
    data?.task_id  ??
    data?.request_id;

  if (!id) {
    throw new Error(
      `[seedance] API did not return a job ID. Response: ${JSON.stringify(data)}`,
    );
  }

  return String(id);
}

/**
 * Check the status of a video generation task.
 * Call every 5–10 s until status is `succeeded` or `failed`.
 */
export async function getVideoTask(
  jobId: string,
): Promise<SeedanceTaskResult> {
  const res = await fetch(`${BASE}/videos/${encodeURIComponent(jobId)}`, {
    headers: { Authorization: `Bearer ${key()}` },
    cache:   'no-store',
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`[seedance] poll failed (HTTP ${res.status}): ${err}`);
  }

  const data = await res.json() as Record<string, unknown>;

  const rawStatus = String(
    (data?.status as string) ??
    (data?.task_status as string) ??
    'pending',
  );

  // Accommodate nested output shapes from different API variants.
  const output  = (data?.output ?? data?.result ?? {}) as Record<string, unknown>;
  const videoUrl: string | undefined =
    (output?.video_url as string | undefined) ??
    (data?.video_url   as string | undefined);

  return {
    status:    normaliseStatus(rawStatus),
    video_url: videoUrl,
    error:
      (data?.error         as string | undefined) ??
      (data?.error_message as string | undefined),
  };
}
