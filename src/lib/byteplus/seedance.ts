/**
 * BytePlus / VolcEngine Ark — Seedance video generation server-side client.
 *
 * ── Region selection ─────────────────────────────────────────────────────────
 * Your API key is tied to the console where you created it.  Use the matching
 * endpoint or all requests will return 401 / ModelNotOpen.
 *
 *   International account  →  console.byteplus.com
 *     BYTEPLUS_API_BASE=https://ark.ap-southeast.bytepluses.com/api/v3
 *
 *   China account          →  console.volcengine.com
 *     BYTEPLUS_API_BASE=https://ark.cn-beijing.volces.com/api/v3
 *
 * Run GET /api/admin/seedance-region (admin only) to auto-detect which
 * endpoint your API key authenticates against.
 *
 * ── Required env vars ────────────────────────────────────────────────────────
 *   BYTEPLUS_API_KEY   — Ark API key (server-side only; never NEXT_PUBLIC_)
 *   BYTEPLUS_API_BASE  — regional base URL (see above; defaults to international)
 *
 * ── Model activation ─────────────────────────────────────────────────────────
 * Models must be activated in your console BEFORE use:
 *   International: console.byteplus.com/ark  → Model Square → Seedance
 *   China:         console.volcengine.com/ark → 模型广场 (Model Square) → Seedance
 *
 * "ModelNotOpen" error = the model is not activated, OR you're hitting the
 * wrong regional endpoint.  Fix the endpoint first, then activate the model.
 */

import 'server-only';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Ark model IDs for Dreamina Seedance video generation.
 * Models must be activated in BytePlus Ark Console before use:
 *   https://console.byteplus.com/ark → Model Management → Video Generation
 */
export type SeedanceModel =
  | 'dreamina-seedance-2-5-260628'        // Seedance 2.5 — latest, best quality
  | 'dreamina-seedance-2-0-260128'        // Seedance 2.0 — standard
  | 'dreamina-seedance-2-0-fast-260128'   // Seedance 2.0 Fast — lower cost
  | 'dreamina-seedance-2-0-mini-260615';  // Seedance 2.0 Mini — quick drafts

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
    // Default: international BytePlus endpoint.
    // If your account is on console.volcengine.com (China), set:
    //   BYTEPLUS_API_BASE=https://ark.cn-beijing.volces.com/api/v3
    'https://ark.ap-southeast.bytepluses.com/api/v3')
    .replace(/\/$/, '');

// Correct Ark endpoint paths (from official SDK source):
//   POST /api/v3/contents/generations/tasks   ← create task
//   GET  /api/v3/contents/generations/tasks/{id}  ← poll task
// Note: path is plural "contents/generations", NOT "content_generation"
const TASK_PATH = '/contents/generations/tasks';

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
  // Ark API statuses: "queued" | "running" | "succeeded" | "failed" | "cancelled"
  const s = raw.toLowerCase();
  if (s === 'succeeded' || s === 'success' || s === 'completed') return 'succeeded';
  if (s === 'failed' || s === 'error' || s === 'cancelled')      return 'failed';
  if (s === 'running' || s === 'processing' || s === 'in_progress') return 'processing';
  // 'queued' and anything else → pending
  return 'pending';
}

/** Extract video URL from the Ark API response.
 *  Official shape (from SDK): data.content.video_url
 *  Fallback shapes kept for resilience.
 */
function extractVideoUrl(data: Record<string, unknown>): string | undefined {
  // Primary: data.content.video_url (official Ark response shape)
  const content = data?.content as Record<string, unknown> | undefined;
  if (content && typeof content.video_url === 'string' && content.video_url) {
    return content.video_url;
  }

  // Fallback: content array (older models)
  if (Array.isArray(data?.content)) {
    const first = (data.content as Record<string, unknown>[])[0];
    if (first?.video_url) return String(first.video_url);
  }

  // Fallback: output.video_url / top-level video_url
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
    model:          params.model       ?? 'dreamina-seedance-2-5-260628',
    content:        contentArray,
    ratio:          params.ratio       ?? '16:9',
    duration:       Math.min(15, Math.max(4, params.duration ?? 8)),
    resolution:     params.resolution  ?? '720p',
    generate_audio: params.generate_audio !== false,
    watermark:      params.watermark   ?? false,
  };

  const res = await fetch(`${BASE}${TASK_PATH}`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`[seedance] submit failed (HTTP ${res.status}): ${err}`);
  }

  const data = await res.json() as Record<string, unknown>;

  // Ark create response: { id: string, safety_identifier?: string }
  const id = data?.id ?? data?.task_id ?? data?.job_id ?? data?.request_id;

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
    `${BASE}${TASK_PATH}/${encodeURIComponent(taskId)}`,
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
