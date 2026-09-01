/**
 * SessionScreen
 *
 * Full session UI with live ASR transcript:
 *   - Owns the AudioPipeline (moved here from App.tsx)
 *   - Accumulates PCM frames → flushes every 15 s to /api/practice/asr (Whisper)
 *   - Builds rolling transcript, shown live as captions
 *   - AI coach message, triggered on transcript growth or silence
 *   - On Stop: POSTs full session to /api/practice/sessions
 *   - Post-session summary with duration, blocks, transcript snippet
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAudioPipeline }  from '../lib/audio/AudioPipeline';
import { WavEncoder }        from '../lib/audio/WavEncoder';
import type { UserProfile }  from '../../App';
import { supabase }          from '../../App';

// ── Constants ──────────────────────────────────────────────────────────────────

const API_BASE          = process.env.EXPO_PUBLIC_API_BASE ?? 'https://flowen.digital';
const ASR_FLUSH_MS      = 15_000;  // flush PCM buffer every 15 s
const ASR_MIN_BYTES     = 16_000;  // ~0.5 s of PCM — skip tiny flushes
const COACH_INTERVAL_MS = 60_000;  // poll coach every 60 s
const DEFAULT_STAGE_ID  = 1;

// ── Types ──────────────────────────────────────────────────────────────────────

type ScreenPhase = 'idle' | 'recording' | 'saving' | 'summary';

interface SessionResult {
  sessionId:       string;
  durationSeconds: number;
  blocksDetected:  number;
  transcript:      string;
  progression:     { advanced: boolean; newWeek?: number } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiFetch(path: string, body: unknown, token: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify(body),
  });
}

// ── SessionScreen ──────────────────────────────────────────────────────────────

interface Props {
  profile:   UserProfile;
  onSignOut: () => void;
}

export function SessionScreen({ profile, onSignOut }: Props) {
  const ORB = 152;
  const orbScale = useRef(new Animated.Value(1)).current;

  // Session accumulators (refs = no re-render on update)
  const elapsedRef      = useRef(0);
  const blocksRef       = useRef(0);
  const transcriptRef   = useRef('');
  const lastVadRef      = useRef(false);
  const lastCoachRef    = useRef<string | undefined>(undefined);
  const wavEncoderRef   = useRef(new WavEncoder());
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const coachTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const asrTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI state
  const [phase,          setPhase]         = useState<ScreenPhase>('idle');
  const [elapsedSecs,    setElapsedSecs]   = useState(0);
  const [blocksDetected, setBlocksDetected] = useState(0);
  const [transcript,     setTranscript]    = useState('');
  const [interimText,    setInterimText]   = useState(''); // "transcribing…" hint
  const [coachMsg,       setCoachMsg]      = useState<string | null>(null);
  const [result,         setResult]        = useState<SessionResult | null>(null);
  const [saveError,      setSaveError]     = useState<string | null>(null);

  // ── PCM frame callback (passed to AudioPipeline) ─────────────────────────────

  const handlePCMFrame = useCallback((base64: string) => {
    wavEncoderRef.current.push(base64);
  }, []);

  const pipeline = useAudioPipeline(handlePCMFrame);

  // ── Orb animation ─────────────────────────────────────────────────────────────

  useEffect(() => {
    Animated.spring(orbScale, {
      toValue:         1 + Math.min(pipeline.rms / 0.3, 1) * 0.5,
      useNativeDriver: true,
      tension:         80,
      friction:        6,
    }).start();
  }, [pipeline.rms, orbScale]);

  // ── Block counting (VAD falling edge) ────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'recording') return;
    if (lastVadRef.current && !pipeline.isVoiceActive) {
      blocksRef.current += 1;
      setBlocksDetected(blocksRef.current);
    }
    lastVadRef.current = pipeline.isVoiceActive;
  }, [pipeline.isVoiceActive, phase]);

  // ── ASR flush ─────────────────────────────────────────────────────────────────

  const flushASR = useCallback(async () => {
    const enc = wavEncoderRef.current;
    if (enc.bytes < ASR_MIN_BYTES) return; // too short to transcribe
    const wavBase64 = enc.flush();         // resets encoder
    if (!wavBase64) return;

    const durationSeconds = enc.durationSeconds; // captured before reset
    setInterimText('Transcribing…');
    const token = await getToken();
    if (!token) { setInterimText(''); return; }

    try {
      const res = await apiFetch('/api/practice/asr', { audio: wavBase64, durationSeconds }, token);
      if (res.ok) {
        const json = await res.json() as { text?: string };
        const text = (json.text ?? '').trim();
        if (text) {
          transcriptRef.current = `${transcriptRef.current} ${text}`.trim();
          setTranscript(transcriptRef.current);
        }
      }
    } catch { /* network error — skip, next flush will catch up */ }

    setInterimText('');
  }, []);

  // ── Coach polling ─────────────────────────────────────────────────────────────

  const fetchCoach = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await apiFetch('/api/practice/coach', {
        stageId:           DEFAULT_STAGE_ID,
        transcript:        transcriptRef.current.slice(-400),
        sessionElapsed:    elapsedRef.current,
        lastCoachResponse: lastCoachRef.current,
      }, token);
      if (res.ok) {
        const json = await res.json() as { reply?: string };
        if (json.reply) {
          setCoachMsg(json.reply);
          lastCoachRef.current = json.reply;
        }
      }
    } catch { /* skip */ }
  }, []);

  // ── Start ─────────────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    // Reset everything
    elapsedRef.current     = 0;
    blocksRef.current      = 0;
    transcriptRef.current  = '';
    lastVadRef.current     = false;
    lastCoachRef.current   = undefined;
    wavEncoderRef.current.reset();
    setElapsedSecs(0);
    setBlocksDetected(0);
    setTranscript('');
    setInterimText('');
    setCoachMsg(null);
    setResult(null);
    setSaveError(null);

    await pipeline.start();
    setPhase('recording');

    timerRef.current     = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSecs(elapsedRef.current);
    }, 1000);

    asrTimerRef.current  = setInterval(flushASR, ASR_FLUSH_MS);
    coachTimerRef.current = setInterval(fetchCoach, COACH_INTERVAL_MS);
    setTimeout(fetchCoach, 12_000); // first coach message after 12 s
  }, [pipeline, flushASR, fetchCoach]);

  // ── Stop + save ───────────────────────────────────────────────────────────────

  const handleStop = useCallback(async () => {
    if (timerRef.current)     { clearInterval(timerRef.current);     timerRef.current     = null; }
    if (asrTimerRef.current)  { clearInterval(asrTimerRef.current);  asrTimerRef.current  = null; }
    if (coachTimerRef.current){ clearInterval(coachTimerRef.current); coachTimerRef.current = null; }

    await pipeline.stop();
    setPhase('saving');

    // Flush any remaining audio before saving
    await flushASR();

    const durationSeconds = elapsedRef.current;
    const blocks          = blocksRef.current;
    const fullTranscript  = transcriptRef.current;

    if (durationSeconds < 5) { setPhase('idle'); return; }

    const token = await getToken();
    if (!token) {
      setSaveError('Could not authenticate — session not saved.');
      setPhase('summary');
      return;
    }

    try {
      const res = await apiFetch('/api/practice/sessions', {
        duration_seconds:      durationSeconds,
        total_blocks_detected: blocks,
        stage_id:              DEFAULT_STAGE_ID,
        transcript:            fullTranscript.slice(0, 20_000) || undefined,
      }, token);

      const json = await res.json() as {
        ok?: boolean;
        session?: { id: string };
        progression?: { advanced: boolean; newWeek?: number } | null;
        error?: string;
      };

      if (!res.ok || !json.ok) {
        setSaveError(json.error ?? `Server error ${res.status}`);
      } else {
        setResult({
          sessionId:       json.session?.id ?? '',
          durationSeconds,
          blocksDetected:  blocks,
          transcript:      fullTranscript,
          progression:     json.progression ?? null,
        });
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Network error');
    }

    setPhase('summary');
  }, [pipeline, flushASR]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────

  useEffect(() => () => {
    if (timerRef.current)     clearInterval(timerRef.current);
    if (asrTimerRef.current)  clearInterval(asrTimerRef.current);
    if (coachTimerRef.current) clearInterval(coachTimerRef.current);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────

  const isRecording = phase === 'recording';
  const isSaving    = phase === 'saving';

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>FLOWEN</Text>
        <Pressable onPress={onSignOut} hitSlop={12}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tier chip */}
        <View style={styles.tierChip}>
          <Text style={styles.tierText}>
            {profile.display_name ? `${profile.display_name} · ` : ''}{profile.tier}
          </Text>
        </View>

        {/* ── Summary ── */}
        {phase === 'summary' && (
          <View style={styles.summaryBox}>
            {saveError ? (
              <>
                <Text style={styles.summaryEmoji}>⚠️</Text>
                <Text style={styles.summaryHeading}>Session not saved</Text>
                <Text style={styles.summaryBody}>{saveError}</Text>
              </>
            ) : result ? (
              <>
                <Text style={styles.summaryEmoji}>🎉</Text>
                <Text style={styles.summaryHeading}>Session complete</Text>
                <View style={styles.statsRow}>
                  <Metric label="Duration" value={fmt(result.durationSeconds)} />
                  <Metric label="Blocks"   value={`${result.blocksDetected}`} />
                </View>
                {result.progression?.advanced && (
                  <View style={styles.progressionBanner}>
                    <Text style={styles.progressionText}>
                      🏆 Advanced to week {result.progression.newWeek}!
                    </Text>
                  </View>
                )}
                {result.transcript.length > 0 && (
                  <View style={styles.transcriptBox}>
                    <Text style={styles.transcriptLabel}>TRANSCRIPT</Text>
                    <Text style={styles.transcriptText} numberOfLines={6}>
                      {result.transcript}
                    </Text>
                  </View>
                )}
              </>
            ) : null}
            <Pressable style={styles.cta} onPress={() => setPhase('idle')}>
              <Text style={styles.ctaText}>New Session</Text>
            </Pressable>
          </View>
        )}

        {/* ── Recording / Idle ── */}
        {phase !== 'summary' && (
          <>
            {/* Pacer orb */}
            <View style={[styles.orbWrap, { width: ORB, height: ORB }]}>
              <Animated.View
                style={[
                  styles.glow,
                  {
                    width: ORB, height: ORB, borderRadius: ORB / 2,
                    transform:   [{ scale: orbScale }],
                    opacity:     Math.min(0.2 + pipeline.rms * 2.5, 0.9),
                  },
                ]}
              />
              <View style={styles.core} />
            </View>

            {/* Live metrics */}
            {isRecording && (
              <View style={styles.metricsRow}>
                <MetricPill label="Time"   value={fmt(elapsedSecs)} />
                <MetricPill label="Blocks" value={`${blocksDetected}`} />
                <MetricPill label="dBFS"   value={`${Math.round(pipeline.decibelLevel)}`} />
              </View>
            )}

            {/* VAD */}
            <Text style={[styles.vad, pipeline.isVoiceActive && styles.vadActive]}>
              {isRecording
                ? pipeline.isVoiceActive ? '● Voice detected' : '○ Listening…'
                : 'Ready to start'}
            </Text>

            {/* Meter */}
            <View style={styles.meterTrack}>
              <View
                style={[
                  styles.meterFill,
                  { height: `${Math.max(0, (pipeline.decibelLevel + 60) / 60) * 100}%` },
                ]}
              />
            </View>

            {/* Live transcript + interim */}
            {isRecording && (transcript || interimText) && (
              <View style={styles.captionBox}>
                {transcript.length > 0 && (
                  <Text style={styles.captionText} numberOfLines={4}>
                    {transcript}
                  </Text>
                )}
                {interimText.length > 0 && (
                  <Text style={styles.interimText}>{interimText}</Text>
                )}
              </View>
            )}

            {/* Coach */}
            {coachMsg && (
              <View style={styles.coachBox}>
                <Text style={styles.coachLabel}>COACH</Text>
                <Text style={styles.coachText}>{coachMsg}</Text>
              </View>
            )}

            {/* Pipeline error */}
            {pipeline.error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{pipeline.error}</Text>
              </View>
            )}

            {/* CTA */}
            <Pressable
              style={[styles.cta, isRecording && styles.ctaStop, isSaving && styles.ctaDisabled]}
              onPress={isRecording ? handleStop : handleStart}
              disabled={isSaving}
            >
              {isSaving
                ? <ActivityIndicator color="#ffffff" />
                : <Text style={styles.ctaText}>
                    {isRecording ? 'Stop Session' : 'Start Session'}
                  </Text>
              }
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  wordmark: { fontSize: 18, fontWeight: '900', color: '#ffffff', letterSpacing: 3 },
  signOut:  { fontSize: 13, color: '#475569' },

  scroll: {
    alignItems: 'center', paddingHorizontal: 24, paddingBottom: 40,
    gap: 16, flexGrow: 1, justifyContent: 'center',
  },

  tierChip: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b',
    borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12,
  },
  tierText: {
    fontSize: 11, color: '#64748b', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
  },

  // Orb
  orbWrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute', backgroundColor: '#2563eb',
    shadowColor: '#3b82f6', shadowRadius: 40, shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  core: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#bfdbfe',
    shadowColor: '#93c5fd', shadowRadius: 12, shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
  },

  // Metrics
  metricsRow: { flexDirection: 'row', gap: 24, justifyContent: 'center' },
  metric:      { alignItems: 'center' },
  metricValue: {
    fontSize: 20, fontWeight: '800', color: '#f1f5f9',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: { fontSize: 10, color: '#475569', marginTop: 2, letterSpacing: 0.5 },

  // VAD / meter
  vad:      { fontSize: 13, color: '#334155', fontWeight: '600' },
  vadActive: { color: '#22d3ee' },
  meterTrack: {
    width: 12, height: 80, backgroundColor: '#0f172a',
    borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end',
  },
  meterFill: { width: '100%', backgroundColor: '#22d3ee', borderRadius: 4 },

  // Captions
  captionBox: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b',
    borderRadius: 14, padding: 14, width: '100%',
  },
  captionText:  { fontSize: 13, color: '#cbd5e1', lineHeight: 20 },
  interimText:  { fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 4 },

  // Coach
  coachBox: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b',
    borderRadius: 16, padding: 16, width: '100%',
  },
  coachLabel: { fontSize: 9, color: '#3b82f6', fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  coachText:  { fontSize: 14, color: '#cbd5e1', lineHeight: 22 },

  // Error
  errorBox:  { backgroundColor: '#450a0a', borderRadius: 10, padding: 12, width: '100%' },
  errorText: { color: '#fca5a5', fontSize: 12, textAlign: 'center' },

  // CTA
  cta: {
    backgroundColor: '#3b82f6', paddingVertical: 15, paddingHorizontal: 40,
    borderRadius: 14, alignItems: 'center', minWidth: 180,
  },
  ctaStop:     { backgroundColor: '#ef4444' },
  ctaDisabled: { opacity: 0.6 },
  ctaText:     { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  // Summary
  summaryBox:    { alignItems: 'center', gap: 16, width: '100%' },
  summaryEmoji:  { fontSize: 52 },
  summaryHeading:{ fontSize: 22, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  summaryBody:   { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 },
  statsRow:      { flexDirection: 'row', gap: 32, justifyContent: 'center', marginTop: 4 },
  stat:          { alignItems: 'center' },
  statValue:     { fontSize: 28, fontWeight: '900', color: '#f1f5f9', fontVariant: ['tabular-nums'] },
  statLabel:     { fontSize: 11, color: '#475569', marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' },
  progressionBanner: {
    backgroundColor: '#052e16', borderWidth: 1, borderColor: '#16a34a',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20,
  },
  progressionText: { color: '#4ade80', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  transcriptBox: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b',
    borderRadius: 12, padding: 14, width: '100%',
  },
  transcriptLabel: { fontSize: 9, color: '#475569', fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  transcriptText:  { fontSize: 13, color: '#64748b', lineHeight: 20 },
});
