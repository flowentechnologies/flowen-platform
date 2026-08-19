'use client';

/**
 * VoiceCalibration — 60-second guided voice recording for ElevenLabs IVC.
 *
 * Shows a phonetically diverse script that covers all English phonemes.
 * Records via MediaRecorder (webm/opus preferred, falls back to webm).
 * Uploads to /api/voice/clone on completion.
 *
 * Usage:
 *   <VoiceCalibration onComplete={(voiceId) => setVoiceCloneId(voiceId)} onSkip={() => …} />
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Phonetically diverse calibration script (~60 s of natural speech) ─────────
// Covers vowels, fricatives, plosives, nasals, lateral/rhotic sonorants, clusters.
const CALIBRATION_SCRIPT = [
  'Hello, my name is — and I want to get better at speaking clearly and with confidence.',
  'The quick brown fox jumps over the lazy dog sitting by the stream.',
  'She sells seashells by the seashore, where the shining sun reflects on the water.',
  'I would like to practise slow, steady breathing before I begin each sentence.',
  'Purple penguins playfully paddle past the painted pier every single evening.',
  'Unique New York — you know you need unique New York whenever you feel nervous.',
  'A big black bear sat on a big black rug and began to breathe very deeply.',
  'Three thin thistles thrust their tips through the thick brown earth near the theatre.',
  'How much wood would a woodchuck chuck if a woodchuck could chuck wood today?',
  'I am working on my fluency, my rhythm, and my confidence every single day.',
].join(' ');

const MIN_DURATION_MS  = 30_000; // Minimum 30 s accepted
const TARGET_DURATION_MS = 60_000; // Target 60 s

type Phase = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

interface Props {
  /** Called with the new voice_id after a successful clone */
  onComplete: (voiceId: string) => void;
  /** Skip calibration and use the default AI voice */
  onSkip: () => void;
}

export function VoiceCalibration({ onComplete, onSkip }: Props) {
  const [phase, setPhase]           = useState<Phase>('idle');
  const [elapsed, setElapsed]       = useState(0);          // ms
  const [amplitude, setAmplitude]   = useState(0);          // 0–1
  const [errorMsg, setErrorMsg]     = useState('');

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const streamRef         = useRef<MediaStream | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const intervalRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef            = useRef<number>(0);
  const startTimeRef      = useRef<number>(0);

  // ── Amplitude meter via WebAudio ──────────────────────────────────────────
  function startAmplitudeMeter(stream: MediaStream) {
    const ctx      = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current  = ctx;
    analyserRef.current  = analyser;

    const buf = new Uint8Array(analyser.frequencyBinCount);
    function tick() {
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
      setAmplitude(Math.min(1, avg / 80));
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();
  }

  function stopAmplitudeMeter() {
    cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setAmplitude(0);
  }

  // ── Start recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000); // collect chunks every 1 s
      startTimeRef.current = Date.now();
      setPhase('recording');
      startAmplitudeMeter(stream);

      // Timer
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 200);

      // Auto-stop at 90 s
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          void stopAndUpload();
        }
      }, 90_000);
    } catch (err) {
      console.error('[VoiceCalibration] getUserMedia error:', err);
      setErrorMsg('Microphone access was denied. Please allow microphone use and try again.');
      setPhase('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stop & upload ─────────────────────────────────────────────────────────
  const stopAndUpload = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    // Collect final chunk
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    // Stop tracks
    streamRef.current?.getTracks().forEach(t => t.stop());
    stopAmplitudeMeter();
    if (intervalRef.current) clearInterval(intervalRef.current);

    const durationMs = Date.now() - startTimeRef.current;
    if (durationMs < MIN_DURATION_MS) {
      setErrorMsg(`Please record at least 30 seconds (you recorded ${Math.round(durationMs / 1000)} s).`);
      setPhase('error');
      return;
    }

    const blob     = new Blob(chunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', blob, 'calibration.webm');

    setPhase('uploading');

    try {
      const res = await fetch('/api/voice/clone', { method: 'POST', body: formData });
      if (!res.ok) {
        const { error } = await res.json() as { error?: string };
        throw new Error(error ?? `Server returned ${res.status}`);
      }
      const { voiceId } = await res.json() as { voiceId: string };
      setPhase('done');
      onComplete(voiceId);
    } catch (err) {
      console.error('[VoiceCalibration] upload error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed — please try again.');
      setPhase('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      stopAmplitudeMeter();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const elapsedSec  = Math.floor(elapsed / 1000);
  const targetSec   = TARGET_DURATION_MS / 1000;
  const progress    = Math.min(1, elapsed / TARGET_DURATION_MS);
  const canStop     = elapsed >= MIN_DURATION_MS;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto p-6
                    bg-slate-900 border border-slate-700 rounded-2xl text-white">

      {/* Header */}
      <div className="text-center">
        <div className="text-3xl mb-2">🎙️</div>
        <h2 className="text-lg font-bold">Voice Calibration</h2>
        <p className="text-sm text-slate-400 mt-1">
          Read the passage below aloud so your avatar can sound exactly like you.
          Aim for {targetSec} seconds — natural pace, clear voice.
        </p>
      </div>

      {/* Script */}
      <div className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700
                      text-sm text-slate-200 leading-relaxed max-h-48 overflow-y-auto">
        {CALIBRATION_SCRIPT}
      </div>

      {/* Amplitude + progress ring */}
      {phase === 'recording' && (
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Level bar */}
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width:      `${amplitude * 100}%`,
                background: amplitude > 0.6 ? '#f59e0b' : '#10b981',
              }}
            />
          </div>
          {amplitude < 0.05 && (
            <p className="text-xs text-amber-400">We can&apos;t hear you — check your microphone.</p>
          )}

          {/* Timer */}
          <div className="flex items-center gap-2 font-mono text-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className={canStop ? 'text-slate-200' : 'text-slate-400'}>
              {elapsedSec}s / {targetSec}s
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Uploading spinner */}
      {phase === 'uploading' && (
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <svg className="w-5 h-5 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Cloning your voice… this takes 10–20 seconds
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <p className="text-sm text-emerald-400 font-medium">
          ✓ Voice clone ready! Your avatar will now sound just like you.
        </p>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30
                        px-4 py-2 rounded-lg text-center">
          {errorMsg}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 w-full">
        {phase === 'idle' && (
          <>
            <button
              type="button"
              onClick={() => void startRecording()}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400
                         text-slate-950 font-bold text-sm transition-colors"
            >
              Start Recording
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-400
                         hover:text-slate-200 text-sm transition-colors"
            >
              Skip
            </button>
          </>
        )}

        {phase === 'recording' && (
          <button
            type="button"
            onClick={() => void stopAndUpload()}
            disabled={!canStop}
            className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20
                       text-red-400 border border-red-500/30 font-bold text-sm
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {canStop ? 'Stop & Clone Voice' : `Keep recording… (${Math.max(0, 30 - elapsedSec)}s left)`}
          </button>
        )}

        {phase === 'error' && (
          <>
            <button
              type="button"
              onClick={() => { setPhase('idle'); setErrorMsg(''); setElapsed(0); }}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400
                         text-slate-950 font-bold text-sm transition-colors"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-400
                         hover:text-slate-200 text-sm transition-colors"
            >
              Use Default Voice
            </button>
          </>
        )}
      </div>
    </div>
  );
}
