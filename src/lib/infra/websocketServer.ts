/**
 * Flowen WebSocket bridge — port 8081
 *
 * Standalone server (run via `node dist/lib/infra/websocketServer.js`, separate
 * from the Next.js process). Consumes three Kafka topics and fans out every
 * message to all WebSocket clients that subscribed to that topic.
 *
 * Client → server handshake message:
 *   { type: 'subscribe', topics: string[] }
 *
 * Server → client frame message:
 *   { topic: string, partition: number, offset: string, payload: unknown }
 *
 * Server → client heartbeat (every 30s):
 *   { type: 'ping' }
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Kafka, Consumer, EachMessagePayload, logLevel } from 'kafkajs';
import { IncomingMessage } from 'http';

// ── Config ────────────────────────────────────────────────────────────────────

const WS_PORT        = parseInt(process.env.WS_PORT        ?? '8081', 10);
const KAFKA_BROKERS  = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID ?? 'flowen-ws-bridge';

export const TOPICS = {
  TELEMETRY_FRAMES:   'flowen.telemetry.frames',
  BIOFEEDBACK_STATE:  'flowen.biofeedback.state',
  SESSION_EVENTS:     'flowen.session.events',
  INFRA_ALERTS:       'flowen.alerts.infra',
} as const;

export type TopicName = typeof TOPICS[keyof typeof TOPICS];

const ALL_TOPICS = Object.values(TOPICS);

// ── State ─────────────────────────────────────────────────────────────────────

interface FlowenSocket {
  ws:                WebSocket;
  subscribedTopics:  Set<string>;
  isAlive:           boolean;
}

const clients = new Map<WebSocket, FlowenSocket>();

// ── WebSocket server ──────────────────────────────────────────────────────────

function createWsServer(): WebSocketServer {
  const wss = new WebSocketServer({ port: WS_PORT });

  // Heartbeat — detect and evict stale connections every 30s.
  const heartbeat = setInterval(() => {
    clients.forEach(({ ws, isAlive }, key) => {
      if (!isAlive) {
        ws.terminate();
        clients.delete(key);
        return;
      }
      clients.get(key)!.isAlive = false;
      ws.send(JSON.stringify({ type: 'ping' }));
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const client: FlowenSocket = { ws, subscribedTopics: new Set(), isAlive: true };
    clients.set(ws, client);

    ws.on('pong', () => {
      const c = clients.get(ws);
      if (c) c.isAlive = true;
    });

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; topics?: string[] };
        if (msg.type === 'subscribe' && Array.isArray(msg.topics)) {
          const c = clients.get(ws);
          if (!c) return;
          c.subscribedTopics.clear();
          msg.topics
            .filter(t => ALL_TOPICS.includes(t as TopicName))
            .forEach(t => c.subscribedTopics.add(t));
        }
      } catch {
        // Malformed message — ignore, don't disconnect.
      }
    });

    ws.on('close', () => clients.delete(ws));

    ws.on('error', () => {
      ws.terminate();
      clients.delete(ws);
    });
  });

  console.log(`[ws-bridge] listening on port ${WS_PORT}`);
  return wss;
}

// ── Kafka consumer ────────────────────────────────────────────────────────────

function createKafkaConsumer(): Consumer {
  const kafka = new Kafka({
    brokers:  KAFKA_BROKERS,
    clientId: 'flowen-ws-bridge',
    logLevel: logLevel.WARN,
    retry: {
      initialRetryTime: 300,
      retries: 10,
    },
  });

  return kafka.consumer({ groupId: KAFKA_GROUP_ID });
}

function dispatch(topic: string, partition: number, offset: string, rawValue: Buffer | null): void {
  if (!rawValue) return;

  let payload: unknown;
  try {
    payload = JSON.parse(rawValue.toString('utf8'));
  } catch {
    payload = rawValue.toString('utf8');
  }

  const frame = JSON.stringify({ topic, partition, offset, payload });

  clients.forEach(({ ws, subscribedTopics }) => {
    if (!subscribedTopics.has(topic)) return;
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(frame);
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

export async function startWsBridge(): Promise<void> {
  createWsServer();

  const consumer = createKafkaConsumer();
  await consumer.connect();
  await consumer.subscribe({ topics: ALL_TOPICS, fromBeginning: false });

  await consumer.run({
    // eachBatch would be more efficient for high-throughput topics, but
    // eachMessage gives us per-record dispatch latency with minimal buffering.
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      dispatch(topic, partition, message.offset, message.value);
    },
  });

  const gracefulShutdown = async () => {
    console.log('[ws-bridge] shutting down…');
    await consumer.disconnect();
    process.exit(0);
  };

  process.once('SIGTERM', gracefulShutdown);
  process.once('SIGINT',  gracefulShutdown);
}

// Allow running directly: `node dist/lib/infra/websocketServer.js`
if (require.main === module) {
  startWsBridge().catch(err => {
    console.error('[ws-bridge] fatal startup error:', err);
    process.exit(1);
  });
}
