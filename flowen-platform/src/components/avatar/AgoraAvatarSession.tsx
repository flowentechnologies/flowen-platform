'use client';

/**
 * AgoraAvatarSession — orchestrates the full Agora ConvoAI + RPM avatar stack.
 *
 * Wires together:
 *   useAgora        → RTC channel join/leave + remote audio track
 *   useAgoraConvoAI → start/stop AI agent
 *   useLipSync      → WebAudio FFT → VisemeBlends
 *   RPMAvatarScene  → Three.js GLB avatar with morph target updates
 *   VoiceCalibration → 60-second recording UI for ElevenLabs IVC
 *
 * First-run flow:
 *   Profile has no voice_clone_id → show VoiceCalibration prompt
 *   After clone is saved → avatar speaks back in user's own voice
 *   User can skip calibration to use the default OpenAI nova voice
 *
 * Usage:
 *   <AgoraAvatarSession
 *     avatarUrl="https://models.readyplayer.me/[id].glb?morphTargets=ARKit"
 *     systemPrompt="You are a speech therapy assistant..."
 *   />
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAgora } from '@/hooks/useAgora';
import { useAgoraConvoAI } from '@/hooks/useAgoraConvoAI';
import { useLipSync } from '@/hooks/useLipSync';
import type { RPMAvatarSceneHandle } from './RPMAvatarScene';
import { VoiceCalibration } from './VoiceCalibration';
import { createBrowserClient } from '@supabase/ssr';

// Three.js scene is SSR-unsafe — lazy-load it
const RPMAvatarScene = dynamic(
  () => import('./RPMAvatarScene').then(m => m.RPMAvatarScene),
  { ssr: false, loading: () => <AvatarSkeleton /> },
);

// ── Default avatar — Flowen branded RPM avatar (ARKit + Oculus Visemes) ──────
const DEFAULT_AVATAR_URL =
  'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb' +
  '?morphTargets=ARKit,Oculus%20Visemes&textureAtlas=512&lod=0';

interface Props {
  avatarUrl?:    string;
  systemPrompt?: string;
  /** Called when the session starts successfully */
  onSessionStart?: () => void;
  /** Called when the session ends */
  onSessionEnd?:   () => void;
  /** Called with each amplitude tick (0–1) for waveform display */
  onAmplitude?:    (amplitude: number) => void;
}

// ── Status chip colours ───────────────────────────────────────────────────────
const STATUS_CHIP: Record<string, string> = {
  idle:        'bg-slate-800 text-slate-400',
  connecting:  'bg-amber-500/10 text-amber-400',
  active:      'bg-emerald-500/10 text-emerald-400',
  speaking:    'bg-emerald-500/20 text-emerald-300',
  error:       'bg-red-500/10 text-red-400',
};

type ProfileState = 'loading' | 'loaded' | 'error';

export function AgoraAvatarSession({
  avatarUrl    = DEFAULT_AVATAR_URL,
  systemPrompt,
  onSessionStart,
  onSessionEnd,
  onAmplitude,
}: Props) {
  const [sessionActive, setSessionActive] = useState(false);
  const [statusLabel, setStatusLabel]     = useState('Ready');
  const [statusKey, setStatusKey]         = useState('idle');

  // ── Voice clone state ─────────────────────────────────────────────────────
  const [profileState, setProfileState]         = useState<ProfileState>('loading');
  const [voiceCloneId, setVoiceCloneId]         = useState<string | null>(null);
  const [showCalibration, setShowCalibration]   = useState(false);
  const [voiceLabel, setVoiceLabel]             = useState('');

  const avatarRef = useRef<RPMAvatarSceneHandle | null>(null);

  const agora   = useAgora();
  const convoAI = useAgoraConvoAI();
  const { blends, isSpeaking, amplitude } = useLipSync(agora.remoteAudioTrack);

  // ── Fetch profile to get voice_clone_id ───────────────────────────────────
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setProfileState('loaded'); return; }

        const { data: profile } = await supabase
          .from('profiles')
          .select('voice_clone_id, voice_clone_name')
          .eq('id', user.id)
          .single();

        if (profile?.voice_clone_id) {
          setVoiceCloneId(profile.voice_clone_id);
          setVoiceLabel(profile.voice_clone_name ?? 'Your voice');
        }
        setProfileState('loaded');
      } catch {
        setProfileState('error');
      }
    })();
  }, []);

  // Push amplitude to parent (for waveform display)
  useEffect(() => {
    onAmplitude?.(amplitude);
  }, [amplitude, onAmplitude]);

  // Push blends directly to avatar ref (avoids React re-render at 60fps)
  useEffect(() => {
    avatarRef.current?.updateBlends(blends, isSpeaking);
  }, [blends, isSpeaking]);

  // Reflect connection state in UI
  useEffect(() => {
    if (agora.state === 'connecting' || convoAI.status === 'starting') {
      setStatusLabel('Connecting…');
      setStatusKey('connecting');
    } else if (agora.state === 'connected' && convoAI.status === 'active') {
      setStatusLabel(isSpeaking ? 'Avatar speaking' : 'Listening…');
      setStatusKey(isSpeaking ? 'speaking' : 'active');
    } else if (agora.state === 'error') {
      setStatusLabel(agora.error ?? 'Connection error');
      setStatusKey('error');
    } else if (convoAI.status === 'error') {
      setStatusLabel(convoAI.error ?? 'Agent error');
      setStatusKey('error');
    } else {
      setStatusLabel('Ready');
      setStatusKey('idle');
    }
  }, [agora.state, agora.error, convoAI.status, convoAI.error, isSpeaking]);

  // ── Start session ───────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    try {
      setSessionActive(true);

      // 1. Get RTC token + join details from server
      const tokenRes = await fetch('/api/agora/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!tokenRes.ok) throw new Error('Failed to get Agora token');
      const { token, appId, channel } = await tokenRes.json() as {
        token: string; appId: string; channel: string;
      };

      // 2. Join the RTC channel
      await agora.join({ appId, channel, token });

      // 3. Start the ConvoAI agent — pass voiceCloneId so it speaks in user's voice
      await convoAI.startAgent({
        channel,
        token,
        systemPrompt,
        voiceCloneId: voiceCloneId ?? undefined,
      });

      onSessionStart?.();
    } catch (err) {
      console.error('[AgoraAvatarSession] startSession error:', err);
      setSessionActive(false);
      setStatusKey('error');
      setStatusLabel(err instanceof Error ? err.message : 'Failed to start session');
    }
  }, [agora, convoAI, systemPrompt, voiceCloneId, onSessionStart]);

  // ── End session ─────────────────────────────────────────────────────────────
  const endSession = useCallback(async () => {
    await convoAI.stopAgent();
    await agora.leave();
    setSessionActive(false);
    onSessionEnd?.();
  }, [agora, convoAI, onSessionEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Voice calibration handlers ─────────────────────────────────────────────
  const handleCloneComplete = useCallback((newVoiceId: string) => {
    setVoiceCloneId(newVoiceId);
    setVoiceLabel('Your voice');
    setShowCalibration(false);
  }, []);

  const handleSkipCalibration = useCallback(() => {
    setShowCalibration(false);
  }, []);

  // ── Calibration modal ──────────────────────────────────────────────────────
  if (showCalibration) {
    return (
      <VoiceCalibration
        onComplete={handleCloneComplete}
        onSkip={handleSkipCalibration}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* ── Avatar canvas ─────────────────────────────────────────────────── */}
      <div className="relative w-full aspect-[3/4] max-w-xs rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
        <RPMAvatarScene
          ref={avatarRef}
          avatarUrl={avatarUrl}
          blends={blends}
          isSpeaking={isSpeaking}
          className="absolute inset-0"
        />

        {/* Status chip */}
        <div className="absolute top-3 left-3">
          <span className={`
            px-2.5 py-1 rounded-full text-[10px] font-mono font-bold
            border border-white/5 backdrop-blur-sm
            ${STATUS_CHIP[statusKey] ?? STATUS_CHIP.idle}
          `}>
            {isSpeaking && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
            )}
            {statusLabel}
          </span>
        </div>

        {/* Voice clone badge */}
        {voiceCloneId && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 rounded-full text-[10px] font-mono font-bold
                             bg-violet-500/15 text-violet-300 border border-violet-500/20
                             backdrop-blur-sm">
              🎙 {voiceLabel}
            </span>
          </div>
        )}

        {/* Amplitude waveform bar */}
        {sessionActive && (
          <div className="absolute bottom-3 left-3 right-3 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-75"
              style={{ width: `${Math.min(100, amplitude * 100 * 3)}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {!sessionActive ? (
          <button
            type="button"
            onClick={() => void startSession()}
            disabled={
              profileState === 'loading' ||
              agora.state === 'connecting' ||
              convoAI.status === 'starting'
            }
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400
                       text-slate-950 font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            <MicIcon />
            {profileState === 'loading' ? 'Loading…' : 'Start AI Session'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void endSession()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20
                       text-red-400 border border-red-500/30 font-bold text-sm transition-colors"
          >
            <StopIcon />
            End Session
          </button>
        )}
      </div>

      {/* ── Voice clone prompt / controls ─────────────────────────────────── */}
      {profileState === 'loaded' && !sessionActive && (
        <div className="text-center text-xs text-slate-400">
          {voiceCloneId ? (
            <span>
              Avatar speaks in{' '}
              <span className="text-violet-400 font-medium">{voiceLabel}</span>
              {' '}·{' '}
              <button
                type="button"
                onClick={() => setShowCalibration(true)}
                className="text-slate-400 underline hover:text-slate-200 transition-colors"
              >
                Re-calibrate
              </button>
            </span>
          ) : (
            <span>
              <button
                type="button"
                onClick={() => setShowCalibration(true)}
                className="text-emerald-400 underline hover:text-emerald-300 transition-colors"
              >
                Calibrate your voice
              </button>
              {' '}so the avatar sounds exactly like you
            </span>
          )}
        </div>
      )}

      {/* Error display */}
      {(agora.error || convoAI.error) && (
        <p className="text-xs text-red-400 font-mono text-center max-w-xs">
          {agora.error ?? convoAI.error}
        </p>
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function AvatarSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-950">
      <div className="w-24 h-24 rounded-full bg-slate-800 animate-pulse" />
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
      <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm5-2.25A.75.75 0 017.75 7h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5z" clipRule="evenodd" />
    </svg>
  );
}
