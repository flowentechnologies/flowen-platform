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
 *     avatarUrl="/models/facecap_clean.glb"
 *     systemPrompt="You are a speech therapy assistant..."
 *   />
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAgora } from '@/hooks/useAgora';
import { useAgoraConvoAI } from '@/hooks/useAgoraConvoAI';
import { useLipSync } from '@/hooks/useLipSync';
import type { RPMAvatarSceneHandle } from './RPMAvatarScene';
import type { VisemeBlends } from '@/lib/viseme';
import type { FaceHeadPose, ExtraBlends } from '@/lib/hooks/useFaceTracker';
import { createBrowserClient } from '@supabase/ssr';

// Three.js scene is SSR-unsafe — lazy-load it
const RPMAvatarScene = dynamic(
  () => import('./RPMAvatarScene').then(m => m.RPMAvatarScene),
  { ssr: false, loading: () => <AvatarSkeleton /> },
);

// ── Default avatar ────────────────────────────────────────────────────────────
// Stopgap: Ready Player Me (the original source of this avatar) was acquired
// by Netflix in Dec 2025 and fully shut down Jan 31 2026 — models.readyplayer.me
// has no DNS records at all any more, so every session using that URL 404'd
// at the network level before Three.js ever got a chance to load anything.
// Self-hosting instead of depending on any live third-party avatar service
// avoids this exact failure mode recurring.
//
// facecap_clean.glb is Three.js's own official demo asset (MIT licensed) —
// already in this repo (public/models/), and carries the full 52 ARKit
// blend shapes VisemeBlends needs (see git history: it briefly served the
// same role for the FaceAvatar calibration preview before that component
// moved to a canvas-2D approach for unrelated reasons) — though under
// Apple's raw underscore-suffix naming (browDown_L) rather than Ready
// Player Me's camelCase convention (browDownLeft); RPMAvatarScene
// normalizes this, see arkit-morph-names.ts. It's a face-only model with
// no shoulders/torso, so it's a visual downgrade from the old RPM avatar —
// swap in a proper branded, head-and-shoulders GLB (same ARKit blend-shape
// scheme) when one exists.
const DEFAULT_AVATAR_URL = '/models/facecap_clean.glb';

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

/**
 * Lets a parent push avatar updates without re-rendering. Two independent
 * paths, same as RPMAvatarSceneHandle: updateBlends drives mouth shapes
 * (used for the self-recording exercise's own formant-based lipsync —
 * ConvoAI sessions drive their own mouth shapes internally, from the
 * agent's TTS audio via useLipSync); updateHeadAndExpression drives
 * camera-tracked head pose + eye/brow shapes, always on top.
 */
export interface AgoraAvatarSessionHandle {
  updateBlends(blends: VisemeBlends, speaking: boolean): void;
  updateHeadAndExpression(pose: FaceHeadPose, extra: ExtraBlends): void;
}

export const AgoraAvatarSession = forwardRef<AgoraAvatarSessionHandle, Props>(
  function AgoraAvatarSession({
    avatarUrl    = DEFAULT_AVATAR_URL,
    systemPrompt,
    onSessionStart,
    onSessionEnd,
    onAmplitude,
  }, ref) {
  const [sessionActive, setSessionActive] = useState(false);
  const [statusLabel, setStatusLabel]     = useState('Ready');
  const [statusKey, setStatusKey]         = useState('idle');

  // ── Voice clone state ─────────────────────────────────────────────────────
  const [profileState, setProfileState]         = useState<ProfileState>('loading');
  const [voiceCloneId, setVoiceCloneId]         = useState<string | null>(null);
  const [voiceLabel, setVoiceLabel]             = useState('');

  const avatarRef = useRef<RPMAvatarSceneHandle | null>(null);

  // Forward camera-tracked head pose + eye/brow expression straight to the
  // 3D avatar, bypassing React state — same reasoning as the blends push
  // below: this needs to happen at up to 60fps.
  useImperativeHandle(ref, () => ({
    updateBlends(b, speaking) {
      avatarRef.current?.updateBlends(b, speaking);
    },
    updateHeadAndExpression(pose, extra) {
      avatarRef.current?.updateHeadAndExpression(pose, extra);
    },
  }));

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

  // Also stop the agent on a hard tab close/refresh — the unmount cleanup
  // above only fires on in-app navigation (a React unmount), not this.
  // That gap is exactly what leaves a stale agent blocking the next join
  // (see convoai-conflict.ts): close the tab mid-session and Agora still
  // considers that agent "running" under this user's deterministic name
  // until it eventually times out on its own. keepalive on stopAgent's
  // fetch (useAgoraConvoAI.ts) gives this a real chance of completing
  // before the page is actually gone.
  useEffect(() => {
    const handlePageHide = () => { void convoAI.stopAgent(); };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [convoAI]);

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

      {/* ── Voice clone status ────────────────────────────────────────────── */}
      {profileState === 'loaded' && !sessionActive && (
        <div className="text-center text-xs text-slate-500">
          {voiceCloneId ? (
            <span>
              Avatar voice:{' '}
              <span className="text-violet-400 font-medium">{voiceLabel}</span>
              {' '}·{' '}
              <Link
                href="/dashboard/settings/voice"
                className="text-slate-500 underline hover:text-slate-300 transition-colors"
              >
                Change
              </Link>
            </span>
          ) : (
            <Link
              href="/dashboard/settings/voice"
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              Set up your voice →
            </Link>
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
  },
);

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
