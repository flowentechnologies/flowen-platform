/**
 * useAgoraConvoAI (mobile)
 *
 * Manages the full Agora ConvoAI session lifecycle for the native app:
 *
 *   1. GET /api/agora/token  — server generates a short-lived RTC token so
 *      AGORA_APP_CERTIFICATE never leaves the server.
 *   2. POST /api/agora/convoai — server starts the AI agent in the channel.
 *   3. Joins the Agora channel locally via react-native-agora so the device
 *      sends/receives audio to/from the AI agent.
 *   4. On leave: stops the agent and leaves the channel.
 *
 * Auth: Bearer token header (same pattern as all other mobile API calls).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  IRtcEngine,
} from 'react-native-agora';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ConvoAIStatus =
  | 'idle'       // not joined
  | 'joining'    // token + agent starting
  | 'active'     // in channel, agent running
  | 'leaving'    // stopping agent + leaving channel
  | 'error';

export interface UseAgoraConvoAIReturn {
  /** Call to start a conversation session. */
  join:       (token: string) => Promise<void>;
  /** Call to end the conversation session. */
  leave:      () => Promise<void>;
  /** Toggle local mic mute (does not stop the agent). */
  toggleMute: () => void;
  status:     ConvoAIStatus;
  isMuted:    boolean;
  error:      string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const API_BASE    = process.env.EXPO_PUBLIC_API_BASE  ?? 'https://flowen.digital';
const APP_ID      = process.env.EXPO_PUBLIC_AGORA_APP_ID ?? '';
const AGENT_UID   = 9999; // fixed UID for the ConvoAI bot (must match server)

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAgoraConvoAI(): UseAgoraConvoAIReturn {
  const [status,  setStatus]  = useState<ConvoAIStatus>('idle');
  const [error,   setError]   = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Refs — mutable state that shouldn't trigger re-renders
  const engineRef   = useRef<IRtcEngine | null>(null);
  const channelRef  = useRef<string | null>(null);
  const agentIdRef  = useRef<string | null>(null);

  // ── Initialise the RTC engine once ──────────────────────────────────────────

  useEffect(() => {
    if (!APP_ID) {
      console.warn('[useAgoraConvoAI] EXPO_PUBLIC_AGORA_APP_ID is not set');
      return;
    }

    const engine = createAgoraRtcEngine();
    engine.initialize({
      appId:          APP_ID,
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
    });
    engine.enableAudio();
    engineRef.current = engine;

    return () => {
      engine.release();
      engineRef.current = null;
    };
  }, []);

  // ── Join ─────────────────────────────────────────────────────────────────────

  const join = useCallback(async (bearerToken: string) => {
    if (!APP_ID) {
      setError('Agora App ID not configured — set EXPO_PUBLIC_AGORA_APP_ID');
      setStatus('error');
      return;
    }

    setStatus('joining');
    setError(null);
    setIsMuted(false);

    try {
      // 1. Get RTC token from server
      const tokenRes = await fetch(`${API_BASE}/api/agora/token`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({ uid: 0 }),
      });

      const tokenData = await tokenRes.json() as {
        token?: string; appId?: string; channel?: string; uid?: number; error?: string;
      };

      if (!tokenRes.ok || !tokenData.token || !tokenData.channel) {
        throw new Error(tokenData.error ?? `Token request failed (${tokenRes.status})`);
      }

      const { token, channel, uid = 0 } = tokenData;
      channelRef.current = channel;

      // 2. Start the ConvoAI agent on the server
      const agentRes = await fetch(`${API_BASE}/api/agora/convoai`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({ channel, token, agentUid: AGENT_UID }),
      });

      const agentData = await agentRes.json() as { agentId?: string; error?: string };

      if (!agentRes.ok || !agentData.agentId) {
        throw new Error(agentData.error ?? `Agent start failed (${agentRes.status})`);
      }

      agentIdRef.current = agentData.agentId;

      // 3. Join the Agora channel locally
      const engine = engineRef.current;
      if (!engine) throw new Error('RTC engine not initialised');

      engine.joinChannel(token, channel, uid, {
        clientRoleType:        ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        autoSubscribeAudio:    true,
      });

      setStatus('active');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start conversation';
      console.error('[useAgoraConvoAI] join error:', err);
      setError(msg);
      setStatus('error');
      // Best-effort cleanup
      engineRef.current?.leaveChannel();
      if (agentIdRef.current && channelRef.current) {
        void stopAgent(agentIdRef.current, channelRef.current, bearerToken);
      }
      agentIdRef.current = null;
      channelRef.current = null;
    }
  }, []);

  // ── Leave ─────────────────────────────────────────────────────────────────────

  const leave = useCallback(async () => {
    if (status === 'idle') return;
    setStatus('leaving');

    engineRef.current?.leaveChannel();

    const agentId = agentIdRef.current;
    const channel = channelRef.current;
    agentIdRef.current = null;
    channelRef.current = null;

    if (agentId && channel) {
      // Fire-and-forget — the server will clean up even if we don't wait
      void stopAgent(agentId, channel, null);
    }

    setStatus('idle');
    setIsMuted(false);
    setError(null);
  }, [status]);

  // ── Toggle mute ───────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      engineRef.current?.muteLocalAudioStream(next);
      return next;
    });
  }, []);

  return { join, leave, toggleMute, status, isMuted, error };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function stopAgent(
  agentId: string,
  channel: string,
  bearerToken: string | null,
): Promise<void> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

    await fetch(`${API_BASE}/api/agora/convoai`, {
      method:  'DELETE',
      headers,
      body:    JSON.stringify({ agentId, channel }),
    });
  } catch (err) {
    console.warn('[useAgoraConvoAI] stopAgent error (non-fatal):', err);
  }
}
