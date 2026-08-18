/**
 * BytePlus Ark — Seedance 2.0 server-side REST client.
 *
 * API platform: BytePlus ModelArk (ark.ap-southeast.bytepluses.com)
 * Console:      https://console.byteplus.com
 * Key format:   ark-*
 *
 * Required env vars:
 *   BYTEPLUS_API_KEY   — Ark API key (starts with "ark-"; never NEXT_PUBLIC_)
 *
 * Optional env vars:
 *   BYTEPLUS_API_BASE  — override base URL for different regions
 *                        default: https://ark.ap-southeast.bytepluses.com/api/v3
 */

import 'server-only';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Ark model IDs for Seedance 2.0 */
export type SeedanceModel =
  | 'dreamina-seedance-2-0-260128'       // standard
  | 'dreamina-seedance-2-0-pro-260128'   // higher quality
  | 'dreamina-seedance-2-0-lite-260128'; // faster / cheaper

export type SeedanceRatio =
  | '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';

export type SeedanceResolution = '480p' | '720p' | '1080p' | '4k';

export type SeedanceStyle =
  | '' | 'cinematic' | 'anime' | 'realistic' | '3d_render';

export interface SeedanceTaskParams {
  prompt:           string;
  model?:           SeedanceModel;
  ratio?:           SeedanceRatio;
  resolution?:      SeedanceResolution;
  duration?:        number;       // 4–15 seconds
  generate_audio?:  boolean;
  watermark?:       boolean;
  style?:           SeedanceStyle;
  negative_prompt?: string;
}

export type SeedanceStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

export interface SeedanceTaskResult {
  status:     SeedanceStatus;
  video_url?: string;
  error?:     string;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

const BASE =
  (process.env.BYTEPLUS_API_BASE ??
    'https://ark.ap-southeast.bytepluses.com/api/v3')
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

function normaliseStatus(raw: string): SeedanceStatus {
  const s = raw.toLowerCase();
  if (s === 'succeeded' || s === 'success' || s === 'completed') return 'succeeded';
  if (s === 'failed' || s === 'error')                            return 'failed';
  if (s === 'running' || s === 'processing' || s === 'in_progress') return 'processing';
  return 'pending';
}

/** Extract video URL from the several shapes the Ark API returns. */
function extractVideoUrl(data: Record<string, unknown>): string | undefined {
  // Shape 1: task_status.content.video_url
  const ts = data?.task_status as Record<string, unknown> | undefined;
  if (ts?.content) {
    const c = ts.content as Record<string, unknown>;
    if (typeof c.video_url === 'string') return c.video_url;
    // Shape 1b: task_status.content[0].video_url
    if (Array.isArray(c) && c[0]?.video_url) return String(c[0].video_url);
  }

  // Shape 2: content[0].video_url
  const content = data?.content;
  if (Array.isArray(content) && content[0]?.video_url) {
    return String(content[0].video_url);
  }

  // Shape 3: output.video_url / video_url (fallback)
  const out = data?.output as Record<string, unknown> | undefined;
  return (out?.video_url ?? data?.video_url) as string | undefined;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Submit a text-to-video generation task to BytePlus Ark.
 * Returns the task ID (poll with `getVideoTask`).
 *
 * Ark request format:
 *   POST /content_generation/tasks
 *   { model, content: [{ type: "text", text }], ratio, duration, resolution,
 *     generate_audio, watermark }
 */
export async function createVideoTask(
  params: SeedanceTaskParams,
): Promise<string> {
  const contentArray: Record<string, unknown>[] = [
    { type: 'text', text: params.prompt.slice(0, 2000) },
  ];

  // Append style as a modifier in the prompt if specified (Ark embeds it as
  // a content instruction rather than a top-level field).
  if (params.style) {
    contentArray[0].text =
      `${contentArray[0].text}\n\nVisual style: ${params.style}`;
  }
  if (params.negative_prompt?.trim()) {
    contentArray.push({
      type: 'text',
      text: `Negative prompt: ${params.negative_prompt.trim()}`,
    });
  }

  const body: Record<string, unknown> = {
    model:          params.model       ?? 'dreamina-seedance-2-0-260128',
    content:        contentArray,
    ratio:          params.ratio       ?? '16:9',
    duration:       Math.min(15, Math.max(4, params.duration ?? 8)),
    resolution:     params.resolution  ?? '720p',
    generate_audio: params.generate_audio !== false,
    watermark:      params.watermark   ?? false,
  };

  const res = await fetch(`${BASE}/content_generation/tasks`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`[seedance] submit failed (HTTP ${res.status}): ${err}`);
  }

  const data = await res.json() as Record<string, unknown>;

  const id =
    data?.id       ??
    data?.task_id  ??
    data?.job_id   ??
    data?.request_id;

  if (!id) {
    throw new Error(
      `[seedance] Ark API did not return a task ID. Response: ${JSON.stringify(data)}`,
    );
  }

  return String(id);
}

/**
 * Poll the status of a Seedance task.
 * Call every 5–10 s until status is `succeeded` or `failed`.
 *
 *   GET /content_generation/tasks/{task_id}
 */
export async function getVideoTask(
  taskId: string,
): Promise<SeedanceTaskResult> {
  const res = await fetch(
    `${BASE}/content_generation/tasks/${encodeURIComponent(taskId)}`,
    {
      headers: { Authorization: `Bearer ${key()}` },
      cache:   'no-store',
    },
  );

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`[seedance] poll failed (HTTP ${res.status}): ${err}`);
  }

  const data = await res.json() as Record<string, unknown>;

  const rawStatus = String(
    (data?.status as string)      ??
    (data?.task_status as string) ??
    'pending',
  );

  return {
    status:    normaliseStatus(rawStatus),
    video_url: extractVideoUrl(data),
    error:
      (data?.error         as string | undefined) ??
      (data?.error_message as string | undefined) ??
      (data?.message       as string | undefined),
  };
}
