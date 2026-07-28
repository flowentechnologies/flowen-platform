import Redis, { Pipeline } from 'ioredis';

// ── Connection ────────────────────────────────────────────────────────────────
// Singleton client. ioredis reconnects automatically with exponential back-off.
// REDIS_URL takes precedence so staging/prod environments can override.

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Lazy singleton — instantiated on first import, not at module evaluation time.
let _client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!_client) {
    _client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck:     true,
      lazyConnect:          false,
      // Keep-alive prevents silent TCP drops on cloud environments.
      keepAlive:            5000,
    });

    _client.on('error', (err) => {
      console.error('[redis] connection error:', err.message);
    });
  }
  return _client;
}

// ── Key schema ────────────────────────────────────────────────────────────────

const KEY = {
  pacerSession: (sessionId: string) => `flowen:pacer:${sessionId}`,
  tensionBuffer: (sessionId: string) => `flowen:tension:${sessionId}`,
  frameBuffer:  (sessionId: string) => `flowen:frames:${sessionId}`,
  userLock:     (userId: string)    => `flowen:lock:${userId}`,
} as const;

// Default TTL values. Sessions expire from Redis after the session ends;
// the authoritative record is flushed to Supabase before expiry.
const TTL = {
  SESSION_ACTIVE_S: 3600,   // 1 hour max session
  FRAME_BUFFER_S:   300,    // 5 min frame ring-buffer
  LOCK_S:           30,     // distributed lock
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PacerState {
  sessionId:            string;
  userId:               string;
  pacerBpm:             number;
  targetBpm:            number;
  pacerPhase:           'inhale' | 'hold' | 'exhale' | 'rest';
  laryngealTensionIndex: number;   // 0.000 – 1.000
  rmsLevel:             number;
  peakRms:              number;
  fundamentalFreqHz:    number;
  isVoiceActive:        boolean;
  blockDetected:        boolean;
  pipelineLatencyMs:    number;
  updatedAtMs:          number;
}

export interface TensionSample {
  tensionIndex: number;
  rms:          number;
  timestampMs:  number;
}

// ── Atomic pipeline writers ───────────────────────────────────────────────────
// All writes use pipelines to batch the HSET + EXPIRE into a single round-trip,
// guaranteeing sub-10ms update cycles on localhost and low-latency cloud Redis.
//
// Note: Redis 4+ deprecated HMSET in favour of HSET with multiple field–value
// pairs. ioredis v5's hset(key, object) is the correct replacement and maps
// directly to the same wire command.

export async function setPacerState(state: PacerState): Promise<void> {
  const redis = getRedisClient();
  const key   = KEY.pacerSession(state.sessionId);

  const payload: Record<string, string | number> = {
    sessionId:            state.sessionId,
    userId:               state.userId,
    pacerBpm:             state.pacerBpm,
    targetBpm:            state.targetBpm,
    pacerPhase:           state.pacerPhase,
    laryngealTensionIndex: state.laryngealTensionIndex,
    rmsLevel:             state.rmsLevel,
    peakRms:              state.peakRms,
    fundamentalFreqHz:    state.fundamentalFreqHz,
    isVoiceActive:        state.isVoiceActive ? 1 : 0,
    blockDetected:        state.blockDetected  ? 1 : 0,
    pipelineLatencyMs:    state.pipelineLatencyMs,
    updatedAtMs:          state.updatedAtMs,
  };

  await (redis.pipeline() as Pipeline)
    .hset(key, payload)
    .expire(key, TTL.SESSION_ACTIVE_S)
    .exec();
}

export async function getPacerState(sessionId: string): Promise<PacerState | null> {
  const redis = getRedisClient();
  const raw   = await redis.hgetall(KEY.pacerSession(sessionId));
  if (!raw || !raw.sessionId) return null;

  return {
    sessionId:            raw.sessionId,
    userId:               raw.userId,
    pacerBpm:             parseFloat(raw.pacerBpm),
    targetBpm:            parseFloat(raw.targetBpm),
    pacerPhase:           raw.pacerPhase as PacerState['pacerPhase'],
    laryngealTensionIndex: parseFloat(raw.laryngealTensionIndex),
    rmsLevel:             parseFloat(raw.rmsLevel),
    peakRms:              parseFloat(raw.peakRms),
    fundamentalFreqHz:    parseFloat(raw.fundamentalFreqHz),
    isVoiceActive:        raw.isVoiceActive === '1',
    blockDetected:        raw.blockDetected  === '1',
    pipelineLatencyMs:    parseFloat(raw.pipelineLatencyMs),
    updatedAtMs:          parseInt(raw.updatedAtMs, 10),
  };
}

// Append a laryngeal tension sample to the session ring-buffer (capped LPUSH).
// The buffer holds the last 300 samples (~30s at 10-per-second cadence).
export async function pushTensionSample(
  sessionId: string,
  sample: TensionSample,
): Promise<void> {
  const redis = getRedisClient();
  const key   = KEY.tensionBuffer(sessionId);

  await (redis.pipeline() as Pipeline)
    .lpush(key, JSON.stringify(sample))
    .ltrim(key, 0, 299)
    .expire(key, TTL.FRAME_BUFFER_S)
    .exec();
}

// Read the N most recent tension samples (0-based, most recent first).
export async function getTensionBuffer(
  sessionId: string,
  count = 60,
): Promise<TensionSample[]> {
  const redis = getRedisClient();
  const items = await redis.lrange(KEY.tensionBuffer(sessionId), 0, count - 1);
  return items.map(s => JSON.parse(s) as TensionSample);
}

// Append a raw PCM frame pointer (metadata only — not the audio bytes).
export async function pushFrameRef(
  sessionId: string,
  frameRef: { frameIndex: number; rms: number; tsMs: number },
): Promise<void> {
  const redis = getRedisClient();
  const key   = KEY.frameBuffer(sessionId);

  await (redis.pipeline() as Pipeline)
    .lpush(key, JSON.stringify(frameRef))
    .ltrim(key, 0, 1499)   // last 1500 frames ≈ 15s at 100fps
    .expire(key, TTL.FRAME_BUFFER_S)
    .exec();
}

// Cleanly expire all session keys when the session ends, before Supabase flush.
export async function expireSessionKeys(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  await (redis.pipeline() as Pipeline)
    .expire(KEY.pacerSession(sessionId),  0)
    .expire(KEY.tensionBuffer(sessionId), 0)
    .expire(KEY.frameBuffer(sessionId),   0)
    .exec();
}

// ── Health probe ──────────────────────────────────────────────────────────────

export async function pingRedis(): Promise<boolean> {
  try {
    const pong = await getRedisClient().ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
