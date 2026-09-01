'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ZERO_BLENDS, extractFormants } from '@/lib/viseme';
import type { VisemeBlends } from '@/lib/viseme';
import { VisemeDriver } from '@/components/avatar/VisemeDriver';
import type { FaceAvatarHandle } from '@/components/avatar/FaceAvatar';
import { useFaceTracker, ZERO_EXTRA, ZERO_HEAD_POSE } from '@/lib/hooks/useFaceTracker';
import type { FaceFrame } from '@/lib/hooks/useFaceTracker';
import { CameraFeed } from '@/components/avatar/CameraFeed';
import { ExercisePanel } from './ExercisePanel';
import { DisfluencyHUD } from '@/components/practice/DisfluencyHUD';
import { useAudioPipeline } from '@/lib/hooks/useAudioPipeline';
import { useDisfluencyDetector } from '@/hooks/useDisfluencyDetector';
import posthog from 'posthog-js';

// ── Avatar: Agora ConvoAI + Ready Player Me 3D (replaces Canvas 2D FaceAvatar)
const AgoraAvatarSession = dynamic(
  () => import('@/components/avatar/AgoraAvatarSession').then(m => m.AgoraAvatarSession),
  { ssr: false },
);

// Legacy FaceAvatar kept for calibration preview only
const FaceAvatar = dynamic<React.ComponentPropsWithRef<typeof import('@/components/avatar/FaceAvatar').FaceAvatar>>(
  () => import('@/components/avatar/FaceAvatar').then(m => m.FaceAvatar),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Stage definitions
// ---------------------------------------------------------------------------

const STAGES = [
  {
    id: 1,
    name: 'Diaphragmatic Breathing',
    target: 'Pacing Rate: 6 BPM',
    desc: 'Regulate airflow and establish vocal rhythm before speech.',
    instruction:
      'Breathe in for 4 counts through your nose, then exhale slowly for 6 counts. Feel your diaphragm expand, not your chest.',
    cue: 'Breathe in... 2... 3... 4... Out... 2... 3... 4... 5... 6',
    minMins: 2,
  },
  {
    id: 2,
    name: 'Easy Onset & Prolongation',
    target: 'Soft Vocal Start',
    desc: 'Initiate sound with minimal laryngeal tension — no hard glottal attacks.',
    instruction:
      'Begin words softly, as if your voice is "floating" into sound. Practise starting vowel-initial words gently: "eeeasy", "ooopen", "aaaaim".',
    cue: 'Start each word softly... ease into sound... no pushing',
    minMins: 2,
  },
  {
    id: 3,
    name: 'Light Articulatory Contacts',
    target: 'Reduced Pressure',
    desc: 'Use minimal contact pressure on plosive consonants (/p/, /b/, /t/, /d/, /k/, /g/).',
    instruction:
      'Speak aloud a word list with plosive sounds. Focus on barely touching your lips or tongue — just enough to shape the sound.',
    cue: 'Light touch... barely there... keep moving forward',
    minMins: 3,
  },
  {
    id: 4,
    name: 'Pausing & Phrasing',
    target: 'Chunk Size: 3-5 Words',
    desc: 'Group speech into short thought chunks with deliberate, comfortable pauses between them.',
    instruction:
      'Read aloud or speak spontaneously. Every 3–5 words, take a relaxed pause before continuing. Let the pause belong to you.',
    cue: 'Speak... pause... breathe... continue',
    minMins: 3,
  },
  {
    id: 5,
    name: 'Conversational Flow',
    target: 'Fluency > 85%',
    desc: 'Apply all techniques in natural, spontaneous speech without conscious monitoring.',
    instruction:
      'Speak freely — describe your day, read a passage, or narrate something. Apply your techniques naturally, without over-monitoring each word.',
    cue: 'Speak freely... techniques in the background',
    minMins: 5,
  },
] as const;

type StageId = 1 | 2 | 3 | 4 | 5;
type Screen = 'select' | 'ready' | 'recording' | 'summary' | 'progression';

interface ProgressionInfo {
  advanced: boolean;
  newWeek?: number;
  weekTitle?: string;
  weekPhase?: string;
  nextStages?: number[];
  avgBpm?: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecentSession {
  id: string;
  duration_seconds: number;
  total_blocks_detected: number;
  created_at: string;
  bpm: number;
}

interface TreatmentPlanProp {
  prescribed_stages: number[];
  sessions_per_week: number;
  minutes_per_session: number;
  phase: string;
  goals: string | null;
  slp_display_name: string | null;
  slp_email: string | null;
}

interface ProgrammeBanner {
  week: number;
  title: string;
  phase: string;
  stages: number[];
  targetSessions: number;
  sessionsThisWeek: number;
  tip: string;
}

interface Props {
  recommendedStage: number;
  recentSessions: RecentSession[];
  treatmentPlan: TreatmentPlanProp | null;
  programmeBanner: ProgrammeBanner | null;
  sessionsThisWeek: number;
  consentDataCollection: boolean;
}

// ---------------------------------------------------------------------------
// Step bar
// ---------------------------------------------------------------------------

const STEP_LABELS = ['Stage', 'Ready', 'Record', 'Review'] as const;
const SCREEN_TO_STEP: Record<Screen, number> = { select: 0, ready: 1, recording: 2, summary: 3, progression: 4 };

function StepBar({ current }: { current: Screen }) {
  const idx = SCREEN_TO_STEP[current];
  return (
    <div className="flex items-start w-full">
      {STEP_LABELS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
              i < idx
                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                : i === idx
                ? 'bg-white dark:bg-slate-900 border-emerald-500 text-emerald-400'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600'
            }`}>
              {i < idx ? (
                <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2,7 5.5,11 12,3" />
                </svg>
              ) : String(i + 1)}
            </div>
            <span className={`text-[9px] font-mono uppercase tracking-wider whitespace-nowrap ${
              i === idx ? 'text-emerald-400' : i < idx ? 'text-emerald-700' : 'text-slate-600'
            }`}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`flex-1 h-0.5 mt-3.5 mx-1.5 rounded-full transition-all ${i < idx ? 'bg-emerald-500' : 'bg-slate-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDurationLong(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function bpmLabel(bpm: number): string {
  return `${bpm.toFixed(1)} blocks/min`;
}

// ---------------------------------------------------------------------------
// Breathing pacer (Stage 1 only)
// ---------------------------------------------------------------------------

function BreathingPacer() {
  const [expanded, setExpanded] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'in' | 'out'>('in');
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

    async function run() {
      await sleep(100);
      while (active) {
        setExpanded(true);
        setBreathPhase('in');
        for (let i = 1; i <= 4; i++) {
          if (!active) return;
          setCount(i);
          await sleep(1000);
        }
        if (!active) return;
        setExpanded(false);
        setBreathPhase('out');
        for (let i = 1; i <= 6; i++) {
          if (!active) return;
          setCount(i);
          await sleep(1000);
        }
      }
    }

    run();
    return () => { active = false; };
  }, []);

  const maxSteps = breathPhase === 'in' ? 4 : 6;

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div
        className="rounded-full border-2 transition-all ease-in-out"
        style={{
          width: expanded ? 96 : 48,
          height: expanded ? 96 : 48,
          transitionDuration: expanded ? '4000ms' : '6000ms',
          borderColor: breathPhase === 'in' ? 'rgba(52, 211, 153, 0.7)' : 'rgba(99, 179, 237, 0.7)',
          backgroundColor: breathPhase === 'in' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(99, 179, 237, 0.08)',
        }}
      />
      <div className="text-center space-y-1.5">
        {/* aria-live announces phase changes ("Breathe in" / "Breathe out") to screen readers */}
        <p
          className={`text-xs font-semibold uppercase tracking-widest ${breathPhase === 'in' ? 'text-emerald-400' : 'text-sky-400'}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {breathPhase === 'in' ? 'Breathe in' : 'Breathe out'}
        </p>
        {/* Progress dots are purely decorative */}
        <div className="flex gap-1.5 justify-center" aria-hidden="true">
          {Array.from({ length: maxSteps }, (_, i) => (
            <div
              key={i}
              className={`w-1 h-1 rounded-full transition-colors duration-300 ${
                i < count
                  ? breathPhase === 'in' ? 'bg-emerald-400' : 'bg-sky-400'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PracticeClient({ recommendedStage, recentSessions: initialRecentSessions, treatmentPlan, programmeBanner, sessionsThisWeek, consentDataCollection }: Props) {
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>(initialRecentSessions);
  const [screen, setScreen] = useState<Screen>('select');
  const [stageId, setStageId] = useState<StageId>(
    Math.min(5, Math.max(1, recommendedStage)) as StageId,
  );
  const [elapsed, setElapsed] = useState(0);
  const [blocks, setBlocks] = useState(0);
  const [amplitude, setAmplitude] = useState(0);
  const [freqData, setFreqData] = useState<number[]>(new Array(32).fill(0));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [progression, setProgression] = useState<ProgressionInfo | null>(null);
  const [micStatus, setMicStatus] = useState<'idle' | 'checking' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [micProbeKey, setMicProbeKey] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Avatar — imperative handle avoids 60fps React re-renders
  const avatarRef = useRef<FaceAvatarHandle | null>(null);
  const visemeDriverRef = useRef<VisemeDriver | null>(null);

  // Face tracking — camera-driven blend shapes override audio formants when active
  const faceTrackingActiveRef = useRef(false);

  const handleFaceBlends = useCallback(
    (frame: FaceFrame) => {
      avatarRef.current?.updateFace(frame);
    },
    [],
  );

  // ── Disfluency detector ─────────────────────────────────────────────────────
  // useAudioPipeline manages its own mic capture at 16kHz; the browser shares
  // the physical microphone with Agora and SpeechRecognition transparently.
  const audioPipeline = useAudioPipeline();
  const disfluency = useDisfluencyDetector(audioPipeline, {
    minConfidence: 0.68,
    onEvent: (ev) => {
      // Feed BLOCK events into the existing block counter so the BPM meter
      // and session save both reflect rule-engine detections.
      if (ev.type === 'BLOCK') {
        blocksRef.current += 1;
        setBlocks(b => b + 1);
      }
    },
  });

  const {
    status:       faceStatus,
    errorMsg:     faceErrorMsg,
    isCalibrated: faceCalibrated,
    videoRef:     cameraVideoRef,
    start:        startCamera,
    stop:         stopCamera,
    calibrate:    recalibrate,
  } = useFaceTracker(handleFaceBlends);

  // Calibration countdown (3→2→1→0) shown while faceStatus === 'calibrating'
  const [calCountdown, setCalCountdown] = useState(0);
  useEffect(() => {
    if (faceStatus !== 'calibrating') { setCalCountdown(0); return; }
    setCalCountdown(3);
    const id = setInterval(() => {
      setCalCountdown(n => Math.max(0, n - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [faceStatus]);

  // Captions + playback
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [captionSupported, setCaptionSupported] = useState(false);

  // Voice coach
  const [coachEnabled, setCoachEnabled] = useState(true);
  const [coachSpeaking, setCoachSpeaking] = useState(false);
  const [coachText, setCoachText] = useState<string | null>(null);
  const lastCoachWordCountRef = useRef(0);
  const lastCoachTimeRef = useRef(0);
  const coachCallCountRef = useRef(0);
  const coachTextRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const coachEnabledRef = useRef(true);
  const coachSpeakingRef = useRef(false);
  const stage1FiredRef = useRef<Set<number>>(new Set());
  const coachSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef('');

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const formantAnalyserRef = useRef<AnalyserNode | null>(null); // 2048-bin, dedicated to formant extraction
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Block detection refs
  const isSpeakingRef = useRef(false);
  const silenceStartRef = useRef<number | null>(null);
  const blocksRef = useRef(0);

  // Data collection consent — kept in a ref so it's readable in async callbacks
  // without stale closures. Seeded from the server-side prop (updated at page load).
  const consentDataCollectionRef = useRef(consentDataCollection);
  useEffect(() => { consentDataCollectionRef.current = consentDataCollection; }, [consentDataCollection]);

  // Caption + recorder refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const captionBoxRef = useRef<HTMLDivElement | null>(null);

  const stage = STAGES[stageId - 1];

  // Check SpeechRecognition support on mount + pre-warm voice list
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setCaptionSupported(!!SR);

    // Chrome loads voices asynchronously — trigger the load now so the list
    // is populated before the first coach utterance fires.
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  // ── Mic pre-flight check ────────────────────────────────────────────────────
  // Runs when the user lands on the ready screen, and each time they hit Retry.
  // Probes getUserMedia so we know mic access is granted before the session
  // starts. The stream is stopped immediately — Agora opens its own stream later.
  useEffect(() => {
    if (screen !== 'ready') {
      // Transitioning away — release any held stream and reset status
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      if (screen === 'select') setMicStatus('idle');
      return;
    }

    setMicStatus('checking');

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('unavailable');
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        // Release immediately — the session will re-acquire via Agora
        stream.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
        setMicStatus('granted');
        setMicError(null);
      })
      .catch((err: DOMException) => {
        if (cancelled) return;
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setMicStatus('unavailable');
        } else {
          // NotAllowedError, PermissionDeniedError, SecurityError, etc.
          setMicStatus('denied');
        }
      });

    return () => { cancelled = true; };
  // micProbeKey increments on Retry to re-run the effect without leaving the screen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, micProbeKey]);

  // Auto-scroll caption box
  useEffect(() => {
    if (captionBoxRef.current) {
      captionBoxRef.current.scrollTop = captionBoxRef.current.scrollHeight;
    }
  }, [finalTranscript, interimTranscript]);

  // Revoke object URL when it changes or component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      if (mediaRecorderRef.current?.state !== 'inactive') {
        try { mediaRecorderRef.current?.stop(); } catch { /* noop */ }
      }
      formantAnalyserRef.current = null;
      window.speechSynthesis?.cancel();
      if (coachSilenceTimerRef.current) clearTimeout(coachSilenceTimerRef.current);
    };
  }, []);

  // Keep refs in sync so triggerCoach always sees current values without stale closures
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  useEffect(() => { coachEnabledRef.current = coachEnabled; }, [coachEnabled]);
  useEffect(() => { coachSpeakingRef.current = coachSpeaking; }, [coachSpeaking]);
  useEffect(() => { coachTextRef.current = coachText; }, [coachText]);
  useEffect(() => { transcriptRef.current = finalTranscript; }, [finalTranscript]);

  // Sync face-tracking active flag so the audio tick loop can skip avatar updates
  // when the camera is driving blend shapes at 60 fps instead.
  useEffect(() => { faceTrackingActiveRef.current = faceStatus === 'active'; }, [faceStatus]);

  // ---------------------------------------------------------------------------
  // Voice coach
  // ---------------------------------------------------------------------------

  /** Pick the most natural-sounding English voice available in this browser. */
  const getBestVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined') return null;
    const voices = window.speechSynthesis?.getVoices() ?? [];
    // Ordered from most to least preferred — neural/online voices sound far more natural
    const PREFER = [
      'Samantha', 'Karen', 'Moira', 'Tessa',       // macOS natural
      'Google UK English Female',                     // Chrome WaveNet
      'Google US English',
      'Microsoft Aria Online (Natural)',              // Edge neural
      'Microsoft Jenny Online (Natural)',
      'Microsoft Natasha Online (Natural)',
    ];
    for (const name of PREFER) {
      const v = voices.find(v => v.name.includes(name));
      if (v) return v;
    }
    // Any English neural/online voice
    const neural = voices.find(v => v.lang.startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Neural')));
    if (neural) return neural;
    // Any English voice, avoiding robotic fallbacks
    return voices.find(v => v.lang.startsWith('en') && !v.name.includes('Zira')) ?? null;
  }, []);

  const triggerCoach = useCallback(async (transcript: string) => {
    if (!coachEnabledRef.current || coachSpeakingRef.current) return;
    if (coachCallCountRef.current >= 15) return;

    coachCallCountRef.current++;
    lastCoachWordCountRef.current = transcript.trim().split(/\s+/).filter(Boolean).length;
    lastCoachTimeRef.current = Date.now();

    try {
      const res = await fetch('/api/practice/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId,
          transcript,
          sessionElapsed: elapsedRef.current,
          lastCoachResponse: coachTextRef.current ?? undefined,
        }),
      });
      if (!res.ok) return;
      const data = await res.json() as { reply?: string };
      if (!data.reply) return;

      setCoachText(data.reply);
      setCoachSpeaking(true);

      const utter = new SpeechSynthesisUtterance(data.reply);
      utter.rate = 0.9;    // relaxed speaking pace
      utter.pitch = 1.0;   // neutral — avoid uncanny valley
      utter.volume = 0.88;

      // Prefer a natural-sounding voice; voices load async in Chrome so
      // we try immediately and fall back to the browser default if not ready yet
      const voice = getBestVoice();
      if (voice) utter.voice = voice;

      utter.onend = () => setCoachSpeaking(false);
      utter.onerror = () => setCoachSpeaking(false);
      window.speechSynthesis.speak(utter);
    } catch { /* silent — coach is best-effort */ }
  }, [stageId, getBestVoice]);

  // Silence-based trigger: when the user has said enough words and then
  // goes quiet for 3 seconds, fire the coach (feels like natural turn-taking).
  useEffect(() => {
    if (screen !== 'recording' || stageId === 1) return; // stage 1 uses time-based below
    const speaking = amplitude > 18;

    if (speaking) {
      // User is speaking — cancel any pending silence-trigger
      if (coachSilenceTimerRef.current) {
        clearTimeout(coachSilenceTimerRef.current);
        coachSilenceTimerRef.current = null;
      }
    } else if (!coachSilenceTimerRef.current) {
      // User is silent — schedule a coach response after 3s pause
      const wordCount = transcriptRef.current.trim().split(/\s+/).filter(Boolean).length;
      const wordsSinceLast = wordCount - lastCoachWordCountRef.current;
      const timeSinceLast = Date.now() - lastCoachTimeRef.current;
      const minWords = stageId === 5 ? 6 : 10;  // fewer words needed for conversation stage
      const cooldown  = stageId === 5 ? 10_000 : 14_000;

      if (wordsSinceLast >= minWords && timeSinceLast >= cooldown) {
        coachSilenceTimerRef.current = setTimeout(() => {
          coachSilenceTimerRef.current = null;
          triggerCoach(transcriptRef.current);
        }, 3_000);
      }
    }
  }, [amplitude, screen, stageId, triggerCoach]);

  // Cleanup silence timer when leaving recording screen
  useEffect(() => {
    if (screen !== 'recording' && coachSilenceTimerRef.current) {
      clearTimeout(coachSilenceTimerRef.current);
      coachSilenceTimerRef.current = null;
    }
  }, [screen]);

  // Stage 1: time-based triggers — use >= so skipped seconds (e.g. 29→31) still fire
  useEffect(() => {
    if (screen !== 'recording' || stageId !== 1) return;
    const THRESHOLDS = [30, 60, 90];
    for (const t of THRESHOLDS) {
      if (elapsed >= t && !stage1FiredRef.current.has(t)) {
        const timeSinceLast = Date.now() - lastCoachTimeRef.current;
        if (timeSinceLast >= 20_000) {
          stage1FiredRef.current.add(t);
          triggerCoach('');
        }
      }
    }
  }, [elapsed, screen, stageId, triggerCoach]);

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------

  const startRecording = useCallback(async () => {
    setMicError(null);
    setFinalTranscript('');
    setInterimTranscript('');
    setAudioUrl(null);
    audioChunksRef.current = [];
    // Start the rule-based disfluency detector (resets baseline for new session)
    disfluency.resetSession();
    void audioPipeline.start();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setMicError(
        'Microphone access denied. Please allow microphone access in your browser settings and try again.',
      );
      return;
    }

    streamRef.current = stream;

    // MediaRecorder for playback
    try {
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch { /* MediaRecorder not supported — playback unavailable */ }

    // SpeechRecognition for captions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (SR) {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-GB';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setFinalTranscript(prev => {
              const sep = prev && !prev.endsWith(' ') ? ' ' : '';
              return prev + sep + t.trim();
            });
            if (visemeDriverRef.current) {
              visemeDriverRef.current.pushWords(t.trim());
            }
          } else {
            interim += t;
          }
        }
        setInterimTranscript(interim);
      };
      recognition.onerror = () => { /* silent — captions degrade gracefully */ };
      try { recognition.start(); } catch { /* noop */ }
      recognitionRef.current = recognition;
    }

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);

    // Low-res analyser: 256 FFT for waveform bars + RMS block detection
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    analyserRef.current = analyser;

    // High-res analyser: 2048 FFT for formant extraction (21 Hz/bin at 44100 Hz)
    const formantAnalyser = ctx.createAnalyser();
    formantAnalyser.fftSize = 2048;
    formantAnalyser.smoothingTimeConstant = 0.5;
    source.connect(formantAnalyser);
    formantAnalyserRef.current = formantAnalyser;

    // Initialize viseme driver
    visemeDriverRef.current = new VisemeDriver();

    // Reset block detection
    blocksRef.current = 0;
    isSpeakingRef.current = false;
    silenceStartRef.current = null;
    setBlocks(0);
    setElapsed(0);

    // Reset coach state for new session
    coachCallCountRef.current = 0;
    lastCoachWordCountRef.current = 0;
    lastCoachTimeRef.current = 0;
    stage1FiredRef.current = new Set();

    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    const formantBuf = new Uint8Array(formantAnalyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(buf);
      formantAnalyser.getByteFrequencyData(formantBuf);

      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      setAmplitude(Math.round(rms));

      const step = Math.floor(buf.length / 32);
      const bars: number[] = [];
      for (let i = 0; i < 32; i++) bars.push(buf[i * step]);
      setFreqData(bars);

      // Formant analysis → viseme driver → avatar (bypasses React state entirely).
      // Skip avatar update when camera face tracking is active — useFaceTracker
      // drives the avatar directly via handleFaceBlends at ~60 fps.
      if (visemeDriverRef.current && ctx.sampleRate) {
        const { f1, f2 } = extractFormants(formantBuf, ctx.sampleRate);
        visemeDriverRef.current.updateFormants(f1, f2, rms); // rms gates formant blending
        visemeDriverRef.current.tick(Date.now());
        if (!faceTrackingActiveRef.current) {
          avatarRef.current?.updateFace({
            blends:      visemeDriverRef.current.getBlends(),
            extraBlends: ZERO_EXTRA,
            speaking:    rms > 18,
            headPose:    ZERO_HEAD_POSE,
            landmarks:   null,
            calibrating: false,
          });
        }
      }

      const SPEECH_THRESH = 18;
      const BLOCK_SILENCE_MS = 280;
      const now = Date.now();

      if (rms > SPEECH_THRESH) {
        isSpeakingRef.current = true;
        silenceStartRef.current = null;
        // Politely stop coach if user starts speaking
        if (window.speechSynthesis?.speaking) {
          window.speechSynthesis.cancel();
          setCoachSpeaking(false);
        }
      } else if (isSpeakingRef.current) {
        if (silenceStartRef.current === null) {
          silenceStartRef.current = now;
        } else if (now - silenceStartRef.current > BLOCK_SILENCE_MS) {
          blocksRef.current += 1;
          setBlocks(blocksRef.current);
          isSpeakingRef.current = false;
          silenceStartRef.current = null;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    posthog.capture('practice_session_started', { stage_id: stageId });
    setScreen('recording');
  }, [stageId, audioPipeline, disfluency]);

  const stopRecording = useCallback(() => {
    audioPipeline.stop(); // stop the disfluency detector's audio capture
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    stopCamera(); // tear down camera + RAF loop if face tracking was active

    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch { /* noop */ }
    }
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setInterimTranscript('');
    window.speechSynthesis?.cancel();
    setCoachSpeaking(false);
    coachCallCountRef.current = 0;
    lastCoachWordCountRef.current = 0;
    lastCoachTimeRef.current = 0;
    stage1FiredRef.current = new Set();

    visemeDriverRef.current?.reset();

    setScreen('summary');
  }, [stopCamera, audioPipeline]);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const discardAndReset = useCallback(() => {
    stopCamera();
    blocksRef.current = 0;
    isSpeakingRef.current = false;
    silenceStartRef.current = null;
    setBlocks(0);
    setElapsed(0);
    setAmplitude(0);
    setFreqData(new Array(32).fill(0));
    setSaveError(null);
    setFinalTranscript('');
    setInterimTranscript('');
    setAudioUrl(null);
    window.speechSynthesis?.cancel();
    setCoachSpeaking(false);
    setCoachText(null);
    coachCallCountRef.current = 0;
    lastCoachWordCountRef.current = 0;
    lastCoachTimeRef.current = 0;
    setScreen('select');
  }, [stopCamera]);

  const saveSession = useCallback(async (andRepeat = false) => {
    setSaving(true);
    setSaveError(null);
    // Snapshot transcript at call time to avoid stale closure: finalTranscript
    // is read here, not from a captured closure value, so it's always current.
    const transcriptSnapshot = finalTranscript.trim() || undefined;
    try {
      const res = await fetch('/api/practice/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_seconds: elapsed,
          total_blocks_detected: blocksRef.current,
          // Disfluency detector counts — rule engine tracks prolongations + repetitions
          total_repetitions_detected:   disfluency.eventCounts['REP_START'] ?? 0,
          total_prolongations_detected: disfluency.eventCounts['PROLONG']    ?? 0,
          stage_id: stageId,
          transcript: transcriptSnapshot,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setSaveError(json.error ?? 'Failed to save session. Please try again.');
        setSaving(false);
        return;
      }
      const json = await res.json() as { ok: boolean; session?: { id: string; created_at: string } | null; progression?: ProgressionInfo | null };
      if (json.session) {
        const bpm = elapsed > 0 ? blocksRef.current / (elapsed / 60) : 0;
        setRecentSessions(prev => [{
          id: json.session!.id,
          created_at: json.session!.created_at,
          duration_seconds: elapsed,
          total_blocks_detected: blocksRef.current,
          bpm: Math.round(bpm * 10) / 10,
        }, ...prev].slice(0, 5));

        // Fire-and-forget audio upload for ML training dataset.
        // Only runs when the user has opted in to data collection.
        // Does not block the UI or affect the session save flow.
        if (consentDataCollectionRef.current && audioChunksRef.current.length > 0) {
          const sessionId   = json.session.id;
          const chunks      = audioChunksRef.current.slice(); // snapshot
          const mimeType    = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const elapsedSnap = elapsed;
          const txSnap      = transcriptSnapshot ?? '';
          const disfl       = disfluency.events;
          const stage       = stageId;
          void (async () => {
            try {
              const blob = new Blob(chunks, { type: mimeType });
              const fd   = new FormData();
              fd.append('audio',      blob, 'session.webm');
              fd.append('duration',   String(elapsedSnap));
              fd.append('transcript', txSnap);
              fd.append('disfluency', JSON.stringify(disfl));
              fd.append('stage_id',   String(stage));
              await fetch(`/api/practice/sessions/${sessionId}/audio`, {
                method: 'POST',
                body: fd,
              });
            } catch {
              // Best-effort — silently swallow upload errors; never surface to user
            }
          })();
        }
      }
      // Fire-and-forget: upload recording to session-recordings bucket so SLP
      // can play it back from the clinician dashboard. Runs for all users
      // regardless of ML consent (separate purpose/bucket from training-data).
      if (json.session && audioChunksRef.current.length > 0) {
        const recSessionId = json.session.id;
        const recChunks    = audioChunksRef.current.slice();
        const recMime      = mediaRecorderRef.current?.mimeType || 'audio/webm';
        void (async () => {
          try {
            const blob = new Blob(recChunks, { type: recMime });
            const fd   = new FormData();
            fd.append('audio', blob, 'session.webm');
            await fetch(`/api/practice/sessions/${recSessionId}/recording`, {
              method: 'POST',
              body: fd,
            });
          } catch { /* best-effort — never block UI */ }
        })();
      }

      posthog.capture('practice_session_saved', {
        stage_id: stageId,
        duration_seconds: elapsed,
        repeated_session: andRepeat,
      });
      if (json.progression?.advanced) {
        setProgression(json.progression);
        setScreen('progression');
        setSaving(false);
      } else if (andRepeat) {
        discardAndReset();
        setSaving(false);
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      // Network failure (offline, DNS, timeout) — always reset saving so the
      // user can retry or discard without needing a full page reload.
      setSaveError('Network error — check your connection and try again.');
      setSaving(false);
    }
  }, [elapsed, stageId, finalTranscript, disfluency.events, discardAndReset]);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const currentBpm = elapsed > 0 ? (blocks / (elapsed / 60)) : 0;
  const lastSession = recentSessions[0] ?? null;

  // ---------------------------------------------------------------------------
  // Screen: select
  // ---------------------------------------------------------------------------

  if (screen === 'select') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Step bar */}
        <StepBar current="select" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Practice Engine
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Choose your stage
            </h1>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            STAGE {stageId} OF 5
          </span>
        </div>

        {/* Treatment plan banner */}
        {treatmentPlan && (
          <div className="bg-sky-500/5 border border-sky-500/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-sky-400">Prescribed plan</span>
                {treatmentPlan.slp_display_name && (
                  <span className="text-[10px] text-sky-600">from {treatmentPlan.slp_display_name}</span>
                )}
              </div>
              <span className="text-[10px] font-mono text-sky-500 border border-sky-500/30 rounded-full px-2 py-0.5">
                {treatmentPlan.phase}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-sky-300">
              <span>
                Stages: <strong>{treatmentPlan.prescribed_stages.join(', ')}</strong>
              </span>
              <span>·</span>
              <span>
                Goal: <strong>{treatmentPlan.sessions_per_week}×/week</strong> · <strong>{treatmentPlan.minutes_per_session} min</strong>
              </span>
              <span>·</span>
              <span>
                This week: <strong className={sessionsThisWeek >= treatmentPlan.sessions_per_week ? 'text-emerald-400' : 'text-sky-300'}>{sessionsThisWeek}/{treatmentPlan.sessions_per_week}</strong>
              </span>
            </div>
            {treatmentPlan.goals && (
              <p className="text-xs text-sky-400/70 italic leading-relaxed">&ldquo;{treatmentPlan.goals}&rdquo;</p>
            )}
          </div>
        )}

        {/* Programme banner (self-guided users) */}
        {programmeBanner && (
          <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-violet-400">
                Week {programmeBanner.week} · Programme
              </span>
              <span className="text-[10px] font-mono text-violet-500 border border-violet-500/30 rounded-full px-2 py-0.5">
                {programmeBanner.phase}
              </span>
            </div>
            <p className="text-sm font-semibold text-violet-200">{programmeBanner.title}</p>
            <div className="flex flex-wrap gap-3 text-xs text-violet-300">
              <span>
                Stages: <strong>{programmeBanner.stages.join(', ')}</strong>
              </span>
              <span>·</span>
              <span>
                This week:{' '}
                <strong className={programmeBanner.sessionsThisWeek >= programmeBanner.targetSessions ? 'text-emerald-400' : 'text-violet-300'}>
                  {programmeBanner.sessionsThisWeek}/{programmeBanner.targetSessions}
                </strong>
              </span>
            </div>
            <p className="text-xs text-violet-400/70 italic leading-relaxed border-l-2 border-violet-500/30 pl-3">
              {programmeBanner.tip}
            </p>
          </div>
        )}

        {/* Stage selector */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
            Select stage
          </p>
          <div className="flex gap-3 justify-center">
            {(() => {
              const maxAllowed = programmeBanner && !treatmentPlan
                ? Math.max(...programmeBanner.stages)
                : 5;
              return STAGES.map(s => {
                const locked = s.id > maxAllowed;
                return (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    {s.id === recommendedStage ? (
                      <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400">rec.</span>
                    ) : (
                      <span className="text-[9px] font-mono uppercase tracking-widest text-transparent select-none">rec.</span>
                    )}
                    <button
                      onClick={() => !locked && setStageId(s.id as StageId)}
                      disabled={locked}
                      aria-pressed={!locked && s.id === stageId}
                      aria-label={
                        locked
                          ? `Stage ${s.id}: ${s.name} — locked, complete your current programme week to unlock`
                          : `Stage ${s.id}: ${s.name}${s.id === stageId ? ' (selected)' : ''}`
                      }
                      title={locked ? 'Complete your current programme week to unlock' : undefined}
                      className={`w-12 h-12 rounded-full text-sm font-bold border-2 transition-all ${
                        locked
                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 cursor-not-allowed'
                          : s.id === stageId
                          ? 'bg-emerald-500 border-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-slate-200 active:scale-95'
                      }`}
                    >
                      {locked ? (
                        <svg viewBox="0 0 20 20" className="w-4 h-4 mx-auto" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                        </svg>
                      ) : <span aria-hidden="true">{s.id}</span>}
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Stage detail card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              {stage.target}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{stage.name}</h2>
          <p className="text-slate-400 leading-relaxed text-sm">{stage.desc}</p>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Instruction</p>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{stage.instruction}</p>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Cue</p>
            <p className="text-slate-400 text-sm italic">{stage.cue}</p>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Recommended duration: {stage.minMins} min
            </p>
          </div>
        </div>

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Recent sessions
            </p>
            <div className="space-y-3">
              {recentSessions.slice(0, 3).map((s, i) => {
                const prevBpm = recentSessions[i + 1]?.bpm ?? null;
                let trendChar = '';
                if (prevBpm !== null) {
                  trendChar = s.bpm < prevBpm ? 'v' : s.bpm > prevBpm ? '^' : '-';
                }
                return (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 font-mono text-xs">{formatDate(s.created_at)}</span>
                    <span className="text-slate-400">{formatDurationLong(s.duration_seconds)}</span>
                    <span className="text-slate-400 font-mono text-xs">
                      {bpmLabel(s.bpm)}{' '}
                      {trendChar && (
                        <span className={trendChar === 'v' ? 'text-emerald-400' : trendChar === '^' ? 'text-red-400' : 'text-slate-500'}>
                          {trendChar === 'v' ? 'down' : trendChar === '^' ? 'up' : 'same'}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Micro-practice link */}
        <div className="text-center">
          <Link href="/dashboard/practice/micro" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Short on time? Try a quick 30–60s exercise →
          </Link>
        </div>

        {/* CTA */}
        <button
          onClick={() => setScreen('ready')}
          className="w-full rounded-xl px-6 py-4 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 transition-colors shadow-lg shadow-emerald-500/20"
        >
          Begin session →
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Screen: ready
  // ---------------------------------------------------------------------------

  if (screen === 'ready') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Step bar */}
        <StepBar current="ready" />

        {/* Back */}
        <button
          onClick={() => { setMicError(null); setScreen('select'); }}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors group"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back to stage select
        </button>

        {/* Avatar — Agora ConvoAI AI avatar (idle, session starts on click) */}
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/30">
          <AgoraAvatarSession />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
            {stage.target}
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{stage.name}</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{stage.instruction}</p>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Before you begin</p>

            {/* Mic pre-flight status */}
            <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border text-sm transition-colors ${
              micStatus === 'granted'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : micStatus === 'denied' || micStatus === 'unavailable'
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-slate-800/60 border-slate-700'
            }`}>
              {/* Icon */}
              {micStatus === 'checking' && (
                <svg className="w-4 h-4 shrink-0 mt-0.5 text-slate-400 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              {micStatus === 'granted' && (
                <svg className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
                </svg>
              )}
              {(micStatus === 'denied' || micStatus === 'unavailable') && (
                <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                </svg>
              )}
              {micStatus === 'idle' && (
                <svg className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z"/>
                  <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5H10.75v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z"/>
                </svg>
              )}

              <div className="flex-1 min-w-0">
                {micStatus === 'checking' && (
                  <p className="text-slate-300 font-medium">Checking microphone access…</p>
                )}
                {micStatus === 'granted' && (
                  <>
                    <p className="text-emerald-300 font-medium">Microphone ready</p>
                    <p className="text-emerald-400/70 text-xs mt-0.5">Audio is processed locally — not stored on our servers.</p>
                  </>
                )}
                {micStatus === 'denied' && (
                  <>
                    <p className="text-red-300 font-medium">Microphone access blocked</p>
                    <p className="text-red-400/80 text-xs mt-1 leading-relaxed">
                      {(() => {
                        const ua = navigator.userAgent;
                        if (/Chrome/.test(ua) && !/Edg/.test(ua))
                          return 'Click the camera/mic icon in the address bar → Allow → refresh this page.';
                        if (/Safari/.test(ua) && !/Chrome/.test(ua))
                          return 'Go to Safari → Settings for this website → Microphone → Allow.';
                        if (/Firefox/.test(ua))
                          return 'Click the shield icon in the address bar → Permissions → Allow Microphone.';
                        return 'Allow microphone access in your browser settings, then refresh this page.';
                      })()}
                    </p>
                  </>
                )}
                {micStatus === 'unavailable' && (
                  <>
                    <p className="text-red-300 font-medium">No microphone found</p>
                    <p className="text-red-400/80 text-xs mt-0.5 leading-relaxed">Connect a microphone and refresh this page, or check that no other app is blocking it.</p>
                  </>
                )}
              </div>

              {/* Retry button when denied/unavailable — re-runs the probe effect */}
              {(micStatus === 'denied' || micStatus === 'unavailable') && (
                <button
                  type="button"
                  onClick={() => setMicProbeKey(k => k + 1)}
                  className="shrink-0 text-xs font-semibold text-red-300 hover:text-red-100 underline-offset-2 hover:underline transition-colors"
                >
                  Retry
                </button>
              )}
            </div>

            <div className="space-y-1 text-slate-400 text-sm">
              {captionSupported && (
                <p className="text-emerald-400/80 text-xs">Live captions will appear during your session.</p>
              )}
            </div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              {stage.minMins} min recommended
            </p>
          </div>

          {micError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-red-400 text-sm">{micError}</p>
            </div>
          )}
        </div>

        <ExercisePanel key={stageId} stageId={stageId} />

        {/* Start session — disabled until mic is confirmed accessible */}
        <button
          onClick={startRecording}
          disabled={micStatus === 'checking' || micStatus === 'denied' || micStatus === 'unavailable'}
          className="w-full rounded-xl px-6 py-4 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {micStatus === 'checking' ? 'Checking microphone…' : 'Start session'}
        </button>
        {(micStatus === 'denied' || micStatus === 'unavailable') && (
          <p className="text-center text-xs text-red-400">
            {micStatus === 'denied' ? 'Microphone access is blocked — allow it above to continue.' : 'No microphone detected — connect one to continue.'}
          </p>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Screen: recording
  // ---------------------------------------------------------------------------

  if (screen === 'recording') {
    const speaking = amplitude > 18;
    const canStop = elapsed >= 10;

    const feedbackText =
      elapsed < 10           ? 'Warming up…' :
      currentBpm === 0       ? 'Keep going…' :
      currentBpm < 2         ? 'Excellent — very fluent' :
      currentBpm < 4         ? 'Good control' :
      currentBpm < 7         ? 'Keep applying your techniques' :
                               'Slow down — breathe and reset';
    const feedbackClass =
      elapsed < 10 || currentBpm === 0 ? 'text-slate-500' :
      currentBpm < 2   ? 'text-emerald-400' :
      currentBpm < 4   ? 'text-emerald-300/70' :
      currentBpm < 7   ? 'text-amber-400' :
                         'text-red-400';

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Step bar */}
        <StepBar current="recording" />

        {/* AI Avatar — Agora ConvoAI + RPM 3D (lip-sync from TTS audio) */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl shadow-black/40">
          <AgoraAvatarSession
            onAmplitude={(amp) => {
              // Feed Agora amplitude back into the existing block-detection pipeline
              // so the BPM meter and waveform continue to work as before
            }}
          />

          {/* Calibration overlay — covers avatar with instruction + countdown */}
          {faceStatus === 'calibrating' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-sm">
              <p className="text-xs font-mono uppercase tracking-widest text-slate-600 dark:text-slate-300">
                Relax your face and look at the camera
              </p>
              <span className="text-5xl font-extrabold font-mono text-emerald-400 tabular-nums leading-none">
                {calCountdown > 0 ? calCountdown : '✓'}
              </span>
              <p className="text-[10px] font-mono text-slate-500">Capturing neutral baseline…</p>
            </div>
          )}

          {/* Camera PiP — video element always in DOM (ref must stay mounted).
              Size animates 0→visible when active or calibrating. */}
          <div
            className="absolute bottom-3 right-3 rounded-xl overflow-hidden border transition-all duration-300"
            style={{
              width:       faceStatus === 'active' || faceStatus === 'calibrating' ? 112 : 0,
              height:      faceStatus === 'active' || faceStatus === 'calibrating' ? 80  : 0,
              borderColor: faceStatus === 'active' || faceStatus === 'calibrating'
                ? 'rgba(100,116,139,0.6)'
                : 'transparent',
            }}
          >
            <CameraFeed videoRef={cameraVideoRef} status={faceStatus} />
          </div>
        </div>

        {/* Camera face-tracking control */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600 shrink-0">
                Face Tracking
              </span>

              {/* Status label */}
              {faceStatus === 'loading' && (
                <span className="text-[10px] font-mono text-slate-500 truncate">Loading model…</span>
              )}
              {faceStatus === 'requesting' && (
                <span className="text-[10px] font-mono text-slate-500 truncate">Allow camera…</span>
              )}
              {faceStatus === 'calibrating' && (
                <span className="text-[10px] font-mono text-amber-400 truncate">
                  Calibrating — hold still {calCountdown > 0 ? `(${calCountdown}s)` : ''}
                </span>
              )}
              {faceStatus === 'active' && faceCalibrated && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 shrink-0">
                  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  Active · Calibrated
                </span>
              )}
              {faceStatus === 'active' && !faceCalibrated && (
                <span className="text-[10px] font-mono text-amber-400 shrink-0">Active · Not calibrated</span>
              )}
              {(faceStatus === 'denied' || faceStatus === 'error') && faceErrorMsg && (
                <span className="text-[10px] text-amber-400/80 truncate">{faceErrorMsg}</span>
              )}
            </div>

            {/* Primary action button */}
            <button
              onClick={
                faceStatus === 'active' || faceStatus === 'calibrating'
                  ? stopCamera
                  : startCamera
              }
              disabled={faceStatus === 'loading' || faceStatus === 'requesting' || faceStatus === 'calibrating'}
              aria-pressed={faceStatus === 'active' || faceStatus === 'calibrating'}
              aria-label={
                faceStatus === 'active' || faceStatus === 'calibrating'
                  ? 'Disable camera face tracking'
                  : 'Enable camera face tracking — avatar will mirror your facial movements'
              }
              className={`shrink-0 text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all ${
                faceStatus === 'active' || faceStatus === 'calibrating'
                  ? 'border-emerald-500/30 text-emerald-500/80 hover:border-emerald-500/50 hover:text-emerald-400'
                  : faceStatus === 'loading' || faceStatus === 'requesting'
                    ? 'border-slate-300 dark:border-slate-700 text-slate-600 cursor-not-allowed'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400'
              }`}
            >
              {faceStatus === 'active' || faceStatus === 'calibrating'
                ? 'Disable'
                : faceStatus === 'loading' || faceStatus === 'requesting'
                  ? '…'
                  : 'Enable'}
            </button>
          </div>

          {/* Recalibrate — available if tracking is active but behaving poorly */}
          {faceStatus === 'active' && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
              <p className="text-[10px] text-slate-600">
                {faceCalibrated ? 'Tracking active' : 'Auto-calibrating…'}
              </p>
              <button
                onClick={recalibrate}
                className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400 transition-all"
                aria-label="Recalibrate face tracking baseline"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Waveform card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          {/* Recording indicator — role="status" lets screen readers announce this on mount */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              {stage.name}
            </span>
            <div className="flex items-center gap-2" role="status" aria-label="Recording in progress">
              {/* Animated dot is decorative — the accessible name is on the parent */}
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-red-400" aria-hidden="true">Recording</span>
            </div>
          </div>

          {/* Waveform bars — purely visual; excluded from AT */}
          <div className="flex items-end gap-0.5 h-16 justify-center" aria-hidden="true">
            {freqData.map((v, i) => {
              const h = Math.max(2, Math.round((v / 255) * 64));
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm transition-all duration-75 ${speaking ? 'bg-emerald-400' : 'bg-slate-700'}`}
                  style={{ height: `${h}px` }}
                />
              );
            })}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Time</p>
              <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">{formatDuration(elapsed)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Blocks</p>
              {/* aria-live: announces each new block detection to screen readers */}
              <p className={`text-xl font-bold font-mono ${blocks > 0 ? 'text-red-400' : 'text-slate-900 dark:text-white'}`}
                 aria-live="polite" aria-atomic="true" aria-label={`${blocks} blocks detected`}>{blocks}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Blocks/min</p>
              <p className="text-xl font-bold font-mono text-amber-400">
                {elapsed > 0 ? currentBpm.toFixed(1) : '—'}
              </p>
            </div>
          </div>

          {/* Feedback — polite live region keeps screen-reader users informed */}
          <p className={`text-center text-xs font-mono transition-colors ${feedbackClass}`}
             aria-live="polite" aria-atomic="true">
            {feedbackText}
          </p>

          {/* Breathing pacer (Stage 1) or cue text */}
          {stageId === 1
            ? <BreathingPacer />
            : <p className="text-center text-slate-400 text-sm italic">{stage.cue}</p>
          }
        </div>

        {/* Exercise panel — live during recording */}
        <ExercisePanel key={stageId} stageId={stageId} />

        {/* Voice coach */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Voice Coach</span>
              {coachSpeaking && (
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  Speaking
                </span>
              )}
            </div>
            <button
              onClick={() => {
                const next = !coachEnabled;
                setCoachEnabled(next);
                if (!next) { window.speechSynthesis?.cancel(); setCoachSpeaking(false); }
              }}
              aria-pressed={coachEnabled}
              aria-label={coachEnabled ? 'Mute voice coach' : 'Unmute voice coach'}
              className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all ${
                coachEnabled
                  ? 'border-emerald-500/30 text-emerald-500/80 hover:border-emerald-500/50 hover:text-emerald-400'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400'
              }`}
            >
              <span aria-hidden="true">{coachEnabled ? 'Mute' : 'Unmute'}</span>
            </button>
          </div>
          {/* Coach feedback — polite live region so AT reads new coaching cues */}
          <p className={`text-sm leading-relaxed transition-colors ${coachText ? 'text-slate-600 dark:text-slate-300' : 'text-slate-600 italic text-xs'}`}
             aria-live="polite" aria-atomic="true">
            {coachText ?? (coachEnabled ? 'Listening to your practice…' : 'Coach muted')}
          </p>
        </div>

        {/* Live captions */}
        {captionSupported && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Live captions</p>
            {/* role="log" implies aria-live="polite" + aria-relevant="additions" —
                ideal for a scrolling transcript that accumulates new speech. */}
            <div
              ref={captionBoxRef}
              role="log"
              aria-label="Live session captions"
              className="h-24 overflow-y-auto text-sm leading-relaxed scroll-smooth"
            >
              {finalTranscript || interimTranscript ? (
                <span>
                  <span className="text-slate-700 dark:text-slate-200">{finalTranscript}</span>
                  {interimTranscript && (
                    <span className="text-slate-500">{finalTranscript ? ' ' : ''}{interimTranscript}</span>
                  )}
                </span>
              ) : (
                <span className="text-slate-600 italic text-xs">Captions will appear as you speak…</span>
              )}
            </div>
          </div>
        )}

        {/* Disfluency HUD — real-time event feed + session counts */}
        <DisfluencyHUD
          events={disfluency.events}
          eventCounts={disfluency.eventCounts}
          baseline={disfluency.baseline}
          isCalibrated={disfluency.isCalibrated}
          rms={audioPipeline.rms}
          isRecording={audioPipeline.isRecording}
        />

        {/* Stop button */}
        <button
          onClick={canStop ? stopRecording : undefined}
          disabled={!canStop}
          className={`w-full rounded-xl px-6 py-4 font-bold text-sm transition-colors ${
            canStop
              ? 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-slate-900 dark:text-white shadow-lg shadow-red-600/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {canStop ? 'End session' : `Recording — ${elapsed}s (minimum 10s)`}
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Screen: progression
  // ---------------------------------------------------------------------------

  if (screen === 'progression' && progression) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 mx-auto">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
              Programme milestone
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              Week {(progression.newWeek ?? 2) - 1} complete
            </h1>
          </div>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-4">
          <p className="text-slate-400 text-sm">You have advanced to</p>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/70">
              Week {progression.newWeek} · {progression.weekPhase}
            </span>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{progression.weekTitle}</p>
          </div>
          {progression.nextStages && progression.nextStages.length > 0 && (
            <p className="text-sm text-slate-400">
              Stages unlocked:{' '}
              <strong className="text-slate-900 dark:text-white">{progression.nextStages.join(', ')}</strong>
            </p>
          )}
          {progression.avgBpm !== undefined && (
            <p className="text-xs text-slate-500 font-mono">
              Avg. blocks/min this week: {progression.avgBpm.toFixed(1)}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            className="w-full rounded-xl px-6 py-4 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 transition-colors shadow-lg shadow-emerald-500/20"
          >
            Continue to dashboard
          </button>
          <button
            onClick={discardAndReset}
            className="w-full rounded-xl px-6 py-3 font-semibold text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Practice again
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Screen: summary
  // ---------------------------------------------------------------------------

  const summaryBpm = elapsed > 0 ? blocks / (elapsed / 60) : 0;
  const lastBpm = lastSession?.bpm ?? null;
  let comparisonText = '';
  let comparisonClass = 'text-slate-400';
  if (lastBpm !== null) {
    if (summaryBpm < lastBpm - 0.05) {
      comparisonText = 'down — improved vs last session';
      comparisonClass = 'text-emerald-400';
    } else if (summaryBpm > lastBpm + 0.05) {
      comparisonText = 'up — more blocks than last session';
      comparisonClass = 'text-red-400';
    } else {
      comparisonText = 'same as last session';
      comparisonClass = 'text-slate-400';
    }
  }

  // Celebration tier
  const celebrationEmoji = blocks === 0 ? '🌟' : summaryBpm < 2 ? '🎉' : summaryBpm < 5 ? '✅' : '💪';
  const celebrationMsg   = blocks === 0
    ? 'Perfect session — zero blocks detected!'
    : summaryBpm < 2
    ? 'Excellent fluency — you\'re in the zone.'
    : summaryBpm < 5
    ? 'Solid session — keep the consistency going.'
    : 'Session banked — every rep builds the habit.';

  const trendArrow = lastBpm === null ? null
    : summaryBpm < lastBpm - 0.05 ? { label: `↓ ${(lastBpm - summaryBpm).toFixed(1)} better than last`, cls: 'text-emerald-400' }
    : summaryBpm > lastBpm + 0.05 ? { label: `↑ ${(summaryBpm - lastBpm).toFixed(1)} more than last`, cls: 'text-red-400' }
    : { label: 'Same as last session', cls: 'text-slate-400' };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Step bar */}
      <StepBar current="summary" />

      {/* Celebration hero */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/25 px-6 py-8 text-center space-y-2">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-emerald-500/6 blur-3xl pointer-events-none" />
        <div className="text-4xl mb-1">{celebrationEmoji}</div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Session complete</h1>
        <p className="text-emerald-400/80 text-sm font-medium">{celebrationMsg}</p>
      </div>

      {/* Key metric — BPM front and centre */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Fluency score</p>
        <div className="flex items-end gap-4">
          <div>
            <span className={`text-5xl font-extrabold font-mono tabular-nums ${
              summaryBpm < 2 ? 'text-emerald-400' : summaryBpm < 5 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {summaryBpm.toFixed(1)}
            </span>
            <span className="text-slate-500 text-sm ml-1.5">blocks/min</span>
          </div>
          {trendArrow && (
            <span className={`text-sm font-mono mb-1.5 ${trendArrow.cls}`}>{trendArrow.label}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-600">Target: below 2 blocks/min · lower is better</p>
        {/* BPM bar */}
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              summaryBpm < 2 ? 'bg-emerald-500' : summaryBpm < 5 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, (summaryBpm / 10) * 100)}%` }}
          />
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Duration', value: formatDurationLong(elapsed) },
          { label: 'Stage', value: stage.name.split(' ')[0] },
          { label: 'Blocks', value: String(blocks), sub: blocks === 0 ? 'none!' : undefined },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1">{s.label}</p>
            <p className="text-base font-bold font-mono text-slate-900 dark:text-white">{s.value}</p>
            {s.sub && <p className="text-[10px] text-emerald-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Playback */}
      {audioUrl && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Playback</p>
          <audio controls src={audioUrl} className="w-full rounded-lg" style={{ colorScheme: 'dark', height: '36px' }} />
        </div>
      )}

      {/* Transcript */}
      {finalTranscript && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Transcript</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{finalTranscript}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={() => saveSession(false)}
          disabled={saving}
          className="w-full rounded-xl px-6 py-4 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          {saving && (
            <svg className="animate-spin h-4 w-4 text-slate-950" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {saving ? 'Saving…' : 'Save & return to dashboard →'}
        </button>

        <button
          onClick={() => saveSession(true)}
          disabled={saving}
          className="w-full rounded-xl px-6 py-3 font-semibold text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Do another session
        </button>

        {saveError && (
          <p className="text-red-400 text-sm text-center font-mono">{saveError}</p>
        )}

        <button
          onClick={discardAndReset}
          className="w-full text-center text-sm text-slate-600 hover:text-slate-400 transition-colors py-1"
        >
          Discard session
        </button>
      </div>
    </div>
  );
}
