'use client';

/**
 * useAgora — manages Agora RTC lifecycle for the AI avatar session.
 *
 * Joins a channel in 'live' / 'host' mode (bidirectional audio).
 * Tracks the remote audio track published by the ConvoAI TTS agent.
 *
 * Usage:
 *   const { join, leave, remoteAudioTrack, localTrack, state } = useAgora();
 *   await join({ appId, channel, token, uid });
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// Agora SDK is browser-only — import lazily to avoid SSR issues.
type AgoraRTC = typeof import('agora-rtc-sdk-ng').default;
type IAgoraRTCClient = import('agora-rtc-sdk-ng').IAgoraRTCClient;
type ILocalAudioTrack = import('agora-rtc-sdk-ng').ILocalAudioTrack;
type IRemoteAudioTrack = import('agora-rtc-sdk-ng').IRemoteAudioTrack;

export type AgoraConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AgoraJoinOptions {
  appId:   string;
  channel: string;
  token:   string;
  uid?:    number;
}

export interface UseAgoraReturn {
  join:             (opts: AgoraJoinOptions) => Promise<void>;
  leave:            () => Promise<void>;
  remoteAudioTrack: IRemoteAudioTrack | null;
  localTrack:       ILocalAudioTrack | null;
  state:            AgoraConnectionState;
  error:            string | null;
}

export function useAgora(): UseAgoraReturn {
  const [state, setState]           = useState<AgoraConnectionState>('disconnected');
  const [error, setError]           = useState<string | null>(null);
  const [remoteAudioTrack, setRemote] = useState<IRemoteAudioTrack | null>(null);
  const [localTrack, setLocal]      = useState<ILocalAudioTrack | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const AgoraRef  = useRef<AgoraRTC | null>(null);

  // Lazy-load Agora SDK on first use
  const getAgora = useCallback(async (): Promise<AgoraRTC> => {
    if (AgoraRef.current) return AgoraRef.current;
    const AgoraRTCModule = await import('agora-rtc-sdk-ng');
    AgoraRef.current = AgoraRTCModule.default;
    AgoraRef.current.setLogLevel(3); // errors only in production
    return AgoraRef.current;
  }, []);

  const join = useCallback(async (opts: AgoraJoinOptions) => {
    try {
      setState('connecting');
      setError(null);

      const AgoraRTC = await getAgora();

      // Create client in 'live' mode — same mode the ConvoAI agent uses
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      clientRef.current = client;

      // Set role to host so we can publish our mic
      await client.setClientRole('host');

      // Listen for ConvoAI agent's audio track
      client.on('user-published', async (remoteUser, mediaType) => {
        if (mediaType !== 'audio') return;
        await client.subscribe(remoteUser, 'audio');
        const track = remoteUser.audioTrack ?? null;
        setRemote(track);
        track?.play(); // play through speakers
      });

      client.on('user-unpublished', (remoteUser, mediaType) => {
        if (mediaType === 'audio') setRemote(null);
      });

      client.on('connection-state-change', (cur) => {
        if (cur === 'CONNECTED')     setState('connected');
        if (cur === 'DISCONNECTED')  setState('disconnected');
        if (cur === 'DISCONNECTING') setState('disconnected');
      });

      // Join the channel
      await client.join(opts.appId, opts.channel, opts.token, opts.uid ?? null);

      // Create and publish local microphone track
      const micTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,  // echo cancellation
        ANS: true,  // noise suppression
        AGC: true,  // auto gain
        encoderConfig: { sampleRate: 48000, bitrate: 128, stereo: false },
      });
      await client.publish(micTrack);
      setLocal(micTrack);
      setState('connected');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useAgora] join error:', msg);
      setError(msg);
      setState('error');
    }
  }, [getAgora]);

  const leave = useCallback(async () => {
    try {
      // Stop local mic
      if (localTrack) {
        localTrack.stop();
        localTrack.close();
        setLocal(null);
      }
      // Stop remote audio
      if (remoteAudioTrack) {
        remoteAudioTrack.stop();
        setRemote(null);
      }
      // Leave channel
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
        await clientRef.current.leave();
        clientRef.current = null;
      }
      setState('disconnected');
    } catch (err) {
      console.error('[useAgora] leave error:', err);
    }
  }, [localTrack, remoteAudioTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { join, leave, remoteAudioTrack, localTrack, state, error };
}
