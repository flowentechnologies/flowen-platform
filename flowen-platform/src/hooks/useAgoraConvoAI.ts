'use client';

/**
 * useAgoraConvoAI — manages the ConvoAI agent lifecycle.
 *
 * Calls our /api/agora/convoai proxy (which holds the customer credentials)
 * to start and stop the AI agent in an Agora channel.
 *
 * Usage:
 *   const { startAgent, stopAgent, agentId, agentUid, status } = useAgoraConvoAI();
 *   const { agentId, agentUid } = await startAgent({ channel, token, systemPrompt });
 */
import { useCallback, useRef, useState } from 'react';

export type ConvoAIStatus = 'idle' | 'starting' | 'active' | 'stopping' | 'error';

export interface StartAgentOptions {
  channel:       string;
  token:         string;
  systemPrompt?:  string;
  /** ElevenLabs voice_id for the user's cloned voice (from profiles.voice_clone_id).
   *  When set, the avatar speaks back in the user's own voice. */
  voiceCloneId?: string;
}

export interface UseAgoraConvoAIReturn {
  startAgent: (opts: StartAgentOptions) => Promise<{ agentId: string; agentUid: number }>;
  stopAgent:  () => Promise<void>;
  agentId:    string | null;
  agentUid:   number | null;
  status:     ConvoAIStatus;
  error:      string | null;
}

export function useAgoraConvoAI(): UseAgoraConvoAIReturn {
  const [status, setStatus]   = useState<ConvoAIStatus>('idle');
  const [error, setError]     = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentUid, setAgentUid] = useState<number | null>(null);

  const agentIdRef = useRef<string | null>(null);

  const startAgent = useCallback(async (opts: StartAgentOptions) => {
    setStatus('starting');
    setError(null);

    const res = await fetch('/api/agora/convoai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel:      opts.channel,
        token:        opts.token,
        agentUid:     9999, // fixed UID for the ConvoAI bot
        systemPrompt: opts.systemPrompt,
        voiceCloneId: opts.voiceCloneId,
      }),
    });

    const data = await res.json() as { agentId?: string; agentUid?: number; error?: string };

    if (!res.ok || !data.agentId) {
      const msg = data.error ?? 'Failed to start ConvoAI agent';
      setError(msg);
      setStatus('error');
      throw new Error(msg);
    }

    agentIdRef.current = data.agentId;
    setAgentId(data.agentId);
    setAgentUid(data.agentUid ?? 9999);
    setStatus('active');

    return { agentId: data.agentId, agentUid: data.agentUid ?? 9999 };
  }, []);

  const stopAgent = useCallback(async () => {
    const id = agentIdRef.current;
    if (!id) return;

    setStatus('stopping');

    try {
      await fetch('/api/agora/convoai', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: id }),
      });
    } catch (err) {
      console.warn('[useAgoraConvoAI] stopAgent error (non-fatal):', err);
    }

    agentIdRef.current = null;
    setAgentId(null);
    setAgentUid(null);
    setStatus('idle');
  }, []);

  return { startAgent, stopAgent, agentId, agentUid, status, error };
}
